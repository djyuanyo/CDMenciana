"""Import only public RFAF calendars requested by the pinned club administrator."""
import datetime, http.cookiejar, json, re, urllib.parse, urllib.request
from pathlib import Path
from sync_fixtures import ROOT,Document,normalize,is_club

KEY=re.compile(r'^(first|filial|infantil|rfaf_[0-9]{1,12}_[0-9]{1,12})$')
BASE={'first':'2137495','filial':'48536795','infantil':'34369965'}
def source_config(source):
    p=urllib.parse.urlsplit(source)
    if p.scheme!='https' or p.netloc!='www.rfaf.es' or p.path!='/pnfg/NPcd/NFG_VisCalendario_Vis':raise ValueError('Invalid calendar source')
    q={k.lower():v for k,v in urllib.parse.parse_qs(p.query).items()}
    if any(len(v)!=1 for v in q.values()):raise ValueError('Duplicate source parameter')
    values=[q.get(k,[''])[0] for k in ('codcompeticion','codgrupo','codtemporada')]
    if not all(re.fullmatch(r'\d{1,12}',v) for v in values):raise ValueError('Calendar identity missing')
    return dict(competition_id=values[0],group_id=values[1],season_id=values[2],initial_round=int(q.get('codjornada',['1'])[0]),source=source,calendar_source=source)

def validate_catalog(value):
    if value.get('version')!=1 or not 3<=len(value.get('teams',[]))<=30:raise ValueError('Invalid club catalog')
    seen=set();identities=set()
    for t in value['teams']:
        key=t.get('key','');s=source_config(t['source'])
        if not KEY.fullmatch(key) or key in seen or not re.fullmatch(r'\d{1,12}',t.get('team_id','')):raise ValueError('Invalid team key')
        if any(t[k]!=s[k] for k in ('competition_id','group_id','season_id')):raise ValueError('Source identity mismatch')
        if key in BASE and t['team_id']!=BASE[key] or key not in BASE and key!=f"rfaf_{t['group_id']}_{t['team_id']}":raise ValueError('Invalid club identity')
        if t.get('filename')!=('fixtures.json' if key=='first' else 'fixtures-'+key+'.json'):raise ValueError('Unsafe team filename')
        if not isinstance(t.get('label'),str) or not 1<=len(t['label'].strip())<=80 or not isinstance(t.get('team_name'),str) or not is_club(t['team_name']):raise ValueError('Invalid club team name')
        if type(t.get('order')) is not int or not 1<=t['order']<=99 or t.get('status')!='active':raise ValueError('Invalid team order')
        identity=(t['group_id'],t['team_id'],t['season_id'])
        if identity in identities:raise ValueError('Duplicate club team')
        identities.add(identity);seen.add(key)
    if not set(BASE)<=seen:raise ValueError('Missing original club teams')
    return sorted(value['teams'],key=lambda t:(t['order'],t['key']))

def load_teams():
    path=ROOT/'data/club-teams.json'
    return validate_catalog(json.loads(path.read_text())) if path.exists() else []

def preview(calendar_html,round_html,source):
    config=source_config(source);root=Document(calendar_html).root
    title=next((n.text() for n in root.find('h4') if 'Grupo' in n.text()),'')
    title=' '.join(title.split()).strip()
    title=re.sub(r'\s+Temporada.*$','',title)
    match=re.match(r'^(.*?)\s*,?\s*(Grupo\s+[^,]+)$',title)
    if not match:raise ValueError('Competition title unavailable')
    config.update(competition=match[1].rstrip(' ,'),group=match[2].strip())
    numbers=[];names=set();bye_rounds=[]
    for table in root.find('table'):
        if 'table-hover' not in table.attrs.get('class',''):continue
        heading=re.search(r'Jornada\s+(\d+)\s*\((\d{2}-\d{2}-\d{4})\)',table.text())
        if not heading:continue
        n=int(heading[1]);numbers.append(n)
        for row in table.find('tr'):
            cells=[x for x in row.children if x.tag=='td']
            if len(cells) not in (2,3):continue
            for c in (cells[0],cells[-1]):
                name=c.text().strip()
                if normalize(name) in ('DESCANSA','DESCANSO','LIBRE'):bye_rounds.append(n)
                elif name:names.add(name)
    if not numbers or numbers!=list(range(1,max(numbers)+1)) or not 2<=len(names)<=30:raise ValueError('Incomplete official calendar')
    config.update(team_count=len(names),round_count=len(numbers),has_byes=bool(bye_rounds))
    season=re.search(r'Temporada\s+(20\d\d)\s*[-/]\s*(20\d\d)',root.text())
    if not season:raise ValueError('Official season missing')
    config['season']=season[1]+'-'+season[2]
    candidates={}
    for link in Document(round_html).root.find('a'):
        href=urllib.parse.urljoin('https://www.rfaf.es/pnfg/NPcd/',link.attrs.get('href',''))
        parsed=urllib.parse.urlsplit(href);q={k.lower():v[0] for k,v in urllib.parse.parse_qs(parsed.query).items()}
        name=link.text().strip();team_id=q.get('codigo_equipo','')
        if parsed.scheme=='https' and parsed.netloc=='www.rfaf.es' and parsed.path=='/pnfg/NPcd/NFG_VisEquipos' and re.fullmatch(r'\d{1,12}',team_id) and is_club(name) and name in names:
            candidates[team_id]=dict(team_id=team_id,team_name=name)
    if not candidates:raise ValueError('Official club team not found')
    config['candidates']=list(candidates.values());return config

class PublicSource:
    def __init__(self,browser):
        self.browser=browser
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def get(self,url):
        source_config(url) if 'NFG_VisCalendario_Vis' in url else None
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml'})
        with self.opener.open(req,timeout=40) as response:
            raw=response.read(3_000_000)
            encoding=response.headers.get_content_charset() or 'iso-8859-15'
        if not raw:return self.browser.read(url)
        html=raw.decode(encoding)
        if not Document(html).root.find('table'):return self.browser.read(url)
        return html
    def discover(self,source):
        from official_rfaf import PREFIX,team_query
        config=source_config(source);calendar_html=self.get(source)
        round_html=self.get(PREFIX+'NFG_CmpJornada?'+team_query(config)+'&CodJornada='+str(config['initial_round']))
        try:return preview(calendar_html,round_html,source)
        except ValueError as error:
            if str(error)!='Official club team not found':raise
            alternate=1 if config['initial_round']!=1 else 2
            other=self.get(PREFIX+'NFG_CmpJornada?'+team_query(config)+'&CodJornada='+str(alternate))
            return preview(calendar_html,other,source)

def write_catalog(teams):
    value={'version':1,'teams':teams};validate_catalog(value)
    raw=json.dumps(value,ensure_ascii=False,indent=2)+'\n'
    for folder in ('data','server/static','android/app/src/main/assets'):(ROOT/folder/'club-teams.json').write_text(raw)

def process_jobs():
    from official_rfaf import sync
    from rfaf_browser import PublicBrowserReader
    with PublicBrowserReader() as browser:
        reader=PublicSource(browser)
        for path in sorted((ROOT/'data/team-imports').glob('*.json')):
            job=json.loads(path.read_text())
            if job.get('status') not in ('preview_pending','import_pending'):continue
            importing=job['status']=='import_pending'
            try:
                if not re.fullmatch(r'[a-f0-9]{32}',job.get('id','')) or path.stem!=job['id']:raise ValueError('Invalid import identifier')
                official=reader.discover(job['source']);job['preview']=official
                if importing:
                    teams=load_teams();candidate=next(c for c in official['candidates'] if c['team_id']==job['selectedTeam'])
                    if type(job.get('order')) is not int or not 1<=job['order']<=len(teams)+1 or not isinstance(job.get('label'),str) or not 1<=len(job['label'].strip())<=80:raise ValueError('Invalid name/order')
                    existing=next((t for t in teams if t['team_id']==candidate['team_id'] and t['group_id']==official['group_id'] and t['season_id']==official['season_id']),None)
                    if existing:
                        job.update(status='complete',teamKey=existing['key'])
                    else:
                        if len(teams)>=30:raise ValueError('Team limit reached')
                        key=f"rfaf_{official['group_id']}_{candidate['team_id']}"
                        config={k:v for k,v in official.items() if k!='candidates'}
                        config.update(candidate,key=key,filename='fixtures-'+key+'.json',label=job['label'].strip(),status='active',order=job['order'])
                        validate_catalog({'version':1,'teams':teams+[config]})
                        sync(config,browser)
                        # Publish only after an official calendar has been written successfully.
                        teams.insert(min(job['order']-1,len(teams)),config)
                        for i,t in enumerate(teams):t['order']=i+1
                        write_catalog(teams);job.update(status='complete',teamKey=key)
                else:job.update(status='preview_ready')
                job.pop('error',None)
            except Exception as error:
                print('Public import error: '+type(error).__name__+': '+str(error)[:180],flush=True)
                job.update(status='import_error' if importing else 'error',error='No se pudo leer toda la información pública de RFAF. Puedes reintentar; los equipos existentes se conservan.')
                print('::warning::Importación RFAF pendiente; se conservan los equipos publicados.',flush=True)
            job['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
            path.write_text(json.dumps(job,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':process_jobs()

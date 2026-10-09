"""Public RFAF calendar and standings; no account or browser required."""
import concurrent.futures, datetime, http.cookiejar, json, re, urllib.request, urllib.parse
from sync_fixtures import Document, is_club, normalize, ROOT
from club_content import scorers
PREFIX='https://www.rfaf.es/pnfg/NPcd/'
DATA_QUERY='cod_primaria=1000120&codcompeticion=48466108&codgrupo=48466109&codtemporada=22'
QUERY='cod_primaria=1000120&CodCompeticion=48466108&CodGrupo=48466109&CodTemporada=22'
SOURCE=PREFIX+'NFG_CmpJornada?'+QUERY
TEAMS={
    'first':dict(key='first',label='Primer equipo',team_id='2137495',competition_id='48466108',group_id='48466109',competition='3ª División F.S.',group='Grupo 17',team_count=16,round_count=30,filename='fixtures.json'),
    'infantil':dict(key='infantil',label='Infantil',team_id='34369965',competition_id='49520234',group_id='49520774',competition='2ª Andaluza Infantil F.S. (Córdoba)',group='Grupo B',team_count=10,round_count=18,filename='fixtures-infantil.json',initial_round=2),
    'filial':dict(key='filial',label='Filial Senior',team_id='48536795',competition_id='49113015',group_id='49113036',competition='2ª Andaluza Senior F.S. (Córdoba)',group='Grupo A',team_count=8,round_count=14,filename='fixtures-filial.json'),
}
def team_query(config,lower=False):
    keys=('codcompeticion','codgrupo','codtemporada') if lower else ('CodCompeticion','CodGrupo','CodTemporada')
    return urllib.parse.urlencode(dict(zip(('cod_primaria',*keys),('1000120',config['competition_id'],config['group_id'],'22'))))
DIGITS=[2,5,9,4,1,0,8,6,3,7,1,3,5,7,9,0,2,4,6,8,0,2,4,6,8,1,3,5,7,9,7,5,2,0,9,6,3,8,4,1]

def visible(node,css=""):
    if node.tag in ('style','script') or re.search(r'display\s*:\s*none',node.attrs.get('style','')):return ''
    scripts=node.find('script');icon=''
    if node.attrs.get('id'):
        call=next((re.search(r'ntype\("'+re.escape(node.attrs['id'])+r'",(\d+),(\d+),',s.text()) for s in scripts),None)
        if call:
            n,i=map(int,call.groups());icon=str(DIGITS[i*10+n])
    text=icon+''.join(x if isinstance(x,str) else visible(x,css) for x in node.content)
    for side,rule in re.findall(r'#'+re.escape(node.attrs.get('id','__missing__'))+r':(before|after)\s*\{([^}]+)\}',css):
        if re.search(r'display\s*:\s*none',rule):continue
        value=re.search(r'content\s*:\s*[\"\']([^\"\']*)',rule)
        if value:
            digit=re.sub(r'\\([0-9a-fA-F]{1,6})',lambda m:chr(int(m[1],16)),value[1])
            text=digit+text if side=='before' else text+digit
    return text

def scores(cell):
    sides=cell.find('strong')
    if not sides:return None,None
    if len(sides)!=2:raise ValueError('Unexpected score markup')
    values=[visible(n,' '.join(x.text() for x in n.find('style'))).strip() for n in sides]
    if values==['','']:return None,None
    if not all(re.fullmatch(r'\d{1,2}',n) for n in values):raise ValueError('Unrecognized rendered score')
    return tuple(map(int,values))

def calendar(html,all_teams=False,config=None):
    config=config or TEAMS['first'];source=PREFIX+'NFG_CmpJornada?'+team_query(config)
    tables=[t for t in Document(html).root.find('table') if 'table-hover' in t.attrs.get('class','')]
    out=[];numbers=[]
    for t in tables:
        header=re.search(r'Jornada\s+(\d+)\s*\((\d{2}-\d{2}-\d{4})\)',t.text())
        if not header:continue
        n=int(header[1]);numbers.append(n)
        for row in t.find('tr'):
            cells=[c for c in row.children if c.tag=='td']
            if len(cells)!=3:continue
            if not all_teams and not (is_club(cells[0].text()) or is_club(cells[2].text())):continue
            h,a=scores(cells[1]);played=h is not None
            out.append(dict(id=f"{config['group_id']}-{n}"+('-'+str(len([m for m in out if m['round']==n])+1) if all_teams else ''),round=n,home=cells[0].text(),away=cells[2].text(),home_crest='',away_crest='',date=datetime.datetime.strptime(header[2],'%d-%m-%Y').date().isoformat(),time='',venue='',state='Finalizado' if played else 'Fecha de jornada',played=played,home_score=h,away_score=a,source=source+'&CodJornada='+str(n),date_provisional=True))
    expected=config['round_count']*(config['team_count']//2 if all_teams else 1)
    if len(out)!=expected or numbers!=list(range(1,config['round_count']+1)):raise ValueError('Incomplete official calendar: '+str(len(out))+' matches; rounds '+str(numbers)+'; page '+Document(html).root.text()[:350])
    return out,numbers

def standings(html,team_count=16):
    for t in Document(html).root.find('table'):
        if 'table-bordered' not in t.attrs.get('class',''):continue
        out=[]
        for row in t.find('tr'):
            c=[n for n in row.children if n.tag=='td']
            if len(c) not in (16,17) or not c[1].text().isdigit():continue
            # Regional leagues omit the coefficient column shown in national leagues.
            shift=1 if len(c)==16 else 0
            num=lambda i:int(c[i-shift].text())
            out.append(dict(position=int(c[1].text()),team=c[2].text(),points=num(4),played=num(5)+num(9),won=num(6)+num(10),drawn=num(7)+num(11),lost=num(8)+num(12),gf=num(13),ga=num(14),gd=num(13)-num(14),form=c[15-shift].text(),sanction=num(16)))
        if len(out)==team_count and sum(is_club(r['team']) for r in out)==1:return out
    raise ValueError('Incomplete standings')

def team_crests(html):
    logos={}
    for t in Document(html).root.find('table'):
        h=[n for n in t.find('div','font_widgetL') if n.find('h4')]
        a=[n for n in t.find('div','font_widgetV') if n.find('h4')]
        imgs=t.find('img','escudo_widget2')
        if len(h)==1 and len(a)==1 and len(imgs)==2:
            for team,img in zip([h[0].text(),a[0].text()],imgs):
                logos[normalize(team)]=img.attrs.get('src','')
    return logos

def apply_crests(matches,table,logos):
    for match in matches:
        for side in ('home','away'):
            match[side+'_crest']=logos.get(normalize(match[side]),match.get(side+'_crest',''))
    for row in table:row['crest']=logos.get(normalize(row['team']),'')
    if any(not m[side+'_crest'] for m in matches for side in ('home','away')):
        raise ValueError('Incomplete official crests')

def staff_source(config):
    return PREFIX+'NFG_VisEquipos?cod_primaria=1000119&Codigo_Equipo='+config['team_id']

def team_staff(html):
    root=Document(html).root
    if not any(n.text().startswith('Club:') and is_club(n.text()) for n in root.find('h5')):
        raise ValueError('Official club staff page missing')
    groups={'TECNICOS':('technicians','Técnico'),'DELEGADOS':('delegates','Delegado'),'AUXILIARES':('assistants','Auxiliar')}
    result=[];seen=set()
    for table in root.find('table'):
        header=None
        for node in table.find('th'):
            header=re.fullmatch(r'(TECNICOS|DELEGADOS|AUXILIARES)\s*\((\d+)\)',normalize(visible(node)).strip())
            if header:break
        if not header:continue
        group,count=header.groups()
        if group in seen:raise ValueError('Duplicate staff section')
        seen.add(group);members=[]
        for row in table.find('tr'):
            cells=[n for n in row.children if n.tag=='td']
            if not cells:continue
            name=' '.join(' '.join(visible(c).split()) for c in cells).strip()
            if not name:continue
            if ',' not in name or len(name)>120:raise ValueError('Invalid official staff member')
            members.append(dict(name=name,group=groups[group][0],role=groups[group][1]))
        if len(members)!=int(count):raise ValueError('Incomplete official staff section')
        if len({normalize(m['name']) for m in members})!=len(members):raise ValueError('Duplicate staff member')
        result.extend(members)
    if not seen:raise ValueError('Official staff sections missing')
    return result

def team_players(html):
    root=Document(html).root
    if not any(n.text().startswith('Club:') and is_club(n.text()) for n in root.find('h5')):
        raise ValueError('Official club roster page missing')
    for table in root.find('table'):
        headers=[re.fullmatch(r'JUGADORES\s*\((\d+)\)',normalize(visible(n)).strip()) for n in table.find('th')]
        header=next((h for h in headers if h),None)
        if not header:continue
        names=[' '.join(visible(c).split()) for row in table.find('tr') for c in row.children if c.tag=='td']
        if len(names)!=int(header[1]) or any(',' not in name for name in names) or len(set(map(normalize,names)))!=len(names):
            raise ValueError('Incomplete official roster section')
        return names
    raise ValueError('Official roster section missing')

def official_roster(matches,team,names):
    rows={normalize(p['name']):p for p in report_roster(matches,team)}
    players=[]
    for name in names:
        player=rows.get(normalize(name))
        if not player or not player.get('id') or not player.get('profile_url') or not player.get('rfaf_id'):
            raise ValueError('Official dorsal/profile not yet published for '+name)
        players.append(dict(player,name=name,position='Jugador'))
    if len({p['number'] for p in players})!=len(players):raise ValueError('Ambiguous official shirt numbers')
    return sorted(players,key=lambda p:p['number'])

def write_roster_snapshot(config,payload):
    path=ROOT/'data/roster-snapshot.json'
    try:teams=json.loads(path.read_text())
    except (OSError,ValueError):teams={}
    keys=('team_key','roster','roster_source','roster_status','roster_updated_at','staff','staff_source','staff_status','staff_updated_at')
    teams[config['key']]={key:payload[key] for key in keys if key in payload}
    path.write_text(json.dumps(teams,ensure_ascii=False,indent=2)+'\n')
    script='/* Official roster identities and staff survive older cached calendars. */\nwindow.ClubRosterSnapshot='+json.dumps(teams,ensure_ascii=False,separators=(',',':'))+';\n'
    for folder in ('server/static','android/app/src/main/assets'):(ROOT/folder/'roster-snapshot.js').write_text(script)

def enrich(match,html):
    root=Document(html).root
    homes=[n for n in root.find('div','font_widgetL') if n.find('h4')];aways=[n for n in root.find('div','font_widgetV') if n.find('h4')]
    for h,a in zip(homes,aways):
        if normalize(h.text())!=normalize(match['home']) or normalize(a.text())!=normalize(match['away']):continue
        # Find the smallest containing match table, including venue and kickoff.
        tables=[t for t in root.find('table') if h in t.find('div') and a in t.find('div')]
        table=tables[-1]
        match['home'],match['away']=h.text(),a.text()
        imgs=table.find('img','escudo_widget2')
        if len(imgs)==2:match['home_crest'],match['away_crest']=[i.attrs.get('src','') for i in imgs]
        acta=next((a.attrs.get('href','') for a in table.find('a') if 'btn-success' in a.attrs.get('class','') and re.search(r'[?&]CodActa=\d+',a.attrs.get('href',''),re.I)),'')
        match['acta_url']=urllib.parse.urljoin('https://www.rfaf.es',acta) if acta else ''
        team_links=[link for link in table.find('a') if 'NFG_VisEquipos' in link.attrs.get('href','')]
        for side,name in (('home',h.text()),('away',a.text())):
            exact=next((link for link in team_links if normalize(link.text())==normalize(name)),None)
            if exact:match[side+'_team_url']=urllib.parse.urljoin('https://www.rfaf.es',exact.attrs.get('href',''))
        if len(team_links)==2:
            match.setdefault('home_team_url',urllib.parse.urljoin('https://www.rfaf.es',team_links[0].attrs.get('href','')))
            match.setdefault('away_team_url',urllib.parse.urljoin('https://www.rfaf.es',team_links[1].attrs.get('href','')))
        dates=table.find('span','horario')
        text=' '.join(d.text() for d in dates)
        date=re.search(r'\b(\d{2}-\d{2}-\d{4})\b',text)
        hour=re.search(r'\b(\d{2}:\d{2})\b',text)
        if date:match['date']=datetime.datetime.strptime(date[1],'%d-%m-%Y').date().isoformat();match['date_provisional']=False
        match['time']=hour[1] if hour else ''
        venue=next((l.text() for l in table.find('a') if 'NFG_VisCampos' in l.attrs.get('href','')),'')
        match['venue']=venue
        if not match['played']:match['state']='Programado' if date else 'Por confirmar'
        return
    raise ValueError('Match missing from official round')

def verify_results(matches,club,previous):
    played=[m for m in matches if m['played']]
    gf=sum(m['home_score'] if is_club(m['home']) else m['away_score'] for m in played)
    ga=sum(m['away_score'] if is_club(m['home']) else m['home_score'] for m in played)
    if (len(played),gf,ga)==(club['played'],club['gf'],club['ga']):return 'verified'
    old={m['id']:m for m in previous.get('matches',[])}
    for match in played:
        prior=old.get(match['id'])
        if prior and prior.get('played') and all(normalize(prior[s])==normalize(match[s]) for s in ('home','away')):
            match['home_score'],match['away_score']=prior['home_score'],prior['away_score']
        else:
            match.update(played=False,home_score=None,away_score=None,state='Resultado por verificar')
    print('Score verification pending; retaining verified results and refreshing kickoff times',flush=True)
    return 'pending'

def sync(config=None):
    config=config or TEAMS['first'];source=PREFIX+'NFG_CmpJornada?'+team_query(config)
    opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def get(url,encoding="iso-8859-15"):
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml','Referer':source})
        with opener.open(req,timeout=40) as response:
            raw=response.read(3_000_000)
            if (not raw or b'No se ha aceptado el cookie' in raw) and ('NFG_CmpPartido' in url or 'NFG_EstadisticasJugador' in url):
                import subprocess,tempfile
                with tempfile.TemporaryDirectory() as directory:
                    path=directory+'/public-cookies.txt'
                    jar=http.cookiejar.MozillaCookieJar(path)
                    cookies=next(h.cookiejar for h in opener.handlers if isinstance(h,urllib.request.HTTPCookieProcessor))
                    for cookie in cookies:jar.set_cookie(cookie)
                    jar.save(ignore_discard=True,ignore_expires=True)
                    raw=subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','40','--cookie',path,'--cookie-jar',path,'--referer',source,url],timeout=45)
            html=raw.decode(encoding)
            if 'No se ha aceptado el cookie' in html:raise ValueError('Public RFAF session failed')
            return html
    get('https://www.rfaf.es/pnfg/NPortada')
    print('Public session initialized',flush=True)
    initial_round=config.get('initial_round',1)
    first_page=get(source+'&CodJornada='+str(initial_round))
    def menu_link(html,leaf):
        links=[n.attrs.get('href','') for n in Document(html).root.find('a') if leaf in n.attrs.get('href','')]
        if not links:
            if config['key']!='infantil':raise ValueError('Official competition link missing: '+leaf)
            # The supplied public Infantil page exposes these same menu routes.
            query=team_query(config,lower=True)+'&CodJornada='+str(config.get('initial_round',1))
            return PREFIX+leaf+'?'+query
        url=urllib.parse.urljoin(source,links[0]);parsed=urllib.parse.urlparse(url)
        if parsed.scheme!='https' or parsed.hostname!='www.rfaf.es':raise ValueError('Unexpected official source')
        return url
    round_matches,numbers=calendar(get(menu_link(first_page,'NFG_VisCalendario_Vis')),all_teams=True,config=config)
    matches=[m for m in round_matches if is_club(m['home']) or is_club(m['away'])]
    for match in matches:match['id']=f"{config['group_id']}-{match['round']}"
    current=max((m['round'] for m in matches if m['played']),default=1)
    current_page=first_page if current==initial_round else get(source+'&CodJornada='+str(current))
    standings_url=menu_link(current_page,'NFG_VisClasificacion')
    table=standings(get(standings_url),team_count=config['team_count'])
    print(f'Calendar: {len(matches)} matches; standings: {len(table)} teams',flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        next_round=min((m['round'] for m in matches if not m['played']),default=31)
        published=matches  # Every published future kickoff must be refreshed.
        pages=dict(pool.map(lambda match:(match['source'],get(match['source'])),published))
        for match in round_matches:
            try:enrich(match,pages[match['source']])
            except ValueError as error:
                if match['played'] or str(error)!='Match missing from official round':raise
                print(f"Round {match['round']}: kickoff not published yet",flush=True)
    logos={}
    for html in pages.values():logos.update(team_crests(html))
    apply_crests(round_matches,table,logos)
    previous=json.loads((ROOT/'data'/config['filename']).read_text()) if (ROOT/'data'/config['filename']).exists() else {}
    scorers_url=menu_link(current_page,'NFG_CMP_Goleadores')
    try:goal_rows=scorers(get(scorers_url))
    except (ValueError,OSError) as error:
        if not previous.get('scorers'):raise
        goal_rows=previous['scorers']
        scorers_url=previous.get('scorers_source',scorers_url)
        print(f'Goleadores pendientes: {error}; se actualizan los horarios',flush=True)
    roster_rows=previous.get('roster',[])
    club=next(r for r in table if is_club(r['team']))
    results_status=verify_results(matches,club,previous)
    payload=dict(team_key=config['key'],team_label=config['label'],competition_id=config['competition_id'],group_id=config['group_id'],round_matches=round_matches,results_status=results_status,scorers=goal_rows,scorers_source=scorers_url,roster=roster_rows,roster_source=previous.get('roster_source',staff_source(config)),photo_assets=json.loads((ROOT/'data/player-assets.json').read_text()) if (ROOT/'data/player-assets.json').exists() else {},competition=config['competition'],group=config['group'],season='2026-2027',team=next(r['team'] for r in table if is_club(r['team'])),source=source,updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),rounds=numbers,unpublished_rounds=[],matches=matches,standings=table,standings_source=standings_url,crest_assets=json.loads((ROOT/'data/crest-assets.json').read_text()) if (ROOT/'data/crest-assets.json').exists() else {})
    payload.update(staff=previous.get('staff',[]),staff_source=staff_source(config),staff_updated_at=previous.get('staff_updated_at',''),staff_status='cached')
    team_html=''
    try:
        team_html=get(payload['staff_source'])
        payload.update(staff=team_staff(team_html),staff_updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),staff_status='verified')
    except (ValueError,OSError) as error:
        print(f'Cuerpo técnico pendiente: {error}; se conserva la última copia válida',flush=True)
    raw=json.dumps(payload,ensure_ascii=False,indent=2)+'\n'
    targets=[ROOT/folder/config['filename'] for folder in ('data','android/app/src/main/assets','server/static')]
    for target in targets:target.write_text(raw,encoding='utf-8')
    from match_report import sync_reports
    sync_reports(round_matches,get,ROOT,fixtures_filename=config['filename'])
    try:
        payload['roster']=official_roster(matches,payload['team'],team_players(team_html)) if config['key']=='first' else report_roster(matches,payload['team']) or roster_rows
        payload.update(roster_source=staff_source(config),roster_status='verified',roster_updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
    except ValueError as error:
        payload.update(roster_status=previous.get('roster_status','cached'),roster_updated_at=previous.get('roster_updated_at',''))
        print(f'Plantilla RFAF pendiente: {error}; se conservan las identidades verificadas',flush=True)
    raw=json.dumps(payload,ensure_ascii=False,indent=2)+'\n'
    for target in targets:target.write_text(raw,encoding='utf-8')
    write_roster_snapshot(config,payload)
    print(f"Updated {len(matches)} matches, {len(table)} teams, {len(goal_rows)} scorers and {len(payload['roster'])} players")
def report_roster(matches,team):
    players={}
    for match in sorted(matches,key=lambda m:m['round']):
        acta=urllib.parse.parse_qs(urllib.parse.urlparse(match.get('acta_url','')).query).get('CodActa',[''])[0]
        try:data=json.loads((ROOT/'data/actas'/(acta+'.json')).read_text())
        except (OSError,ValueError):continue
        refs={normalize(p['name']):p for p in data.get('players',[])};side='';section=''
        for block in data.get('blocks',[]):
            if block.get('kind')!='table':
                text=block.get('text','');
                if text in (match['home'],match['away']):side=text;section=''
                elif text in ('Titulares','Suplentes','Cuerpo Técnico','Tarjetas','Goles','Árbitros'):section=text
                continue
            if normalize(side)!=normalize(team) or section not in ('Titulares','Suplentes'):continue
            for row in block.get('rows',[]):
                cells=[str(c).strip() for c in row if str(c).strip()]
                if len(cells)<2 or not cells[0].isdigit():continue
                name=' '.join(cells[1:]);ref=refs.get(normalize(name),{})
                rfaf_id=urllib.parse.parse_qs(urllib.parse.urlparse(ref.get('profile_url','')).query).get('jugador',[''])[0]
                players[normalize(name)]=dict(name=name,number=int(cells[0]),position='Jugador de pista',photo=ref.get('photo',''),id=ref.get('id',''),acta_id=acta,profile_url=ref.get('profile_url',''),rfaf_id=rfaf_id,stats=ref.get('stats',[]),profile_updated_at=ref.get('profile_updated_at',''),competition_summary=ref.get('competition_summary',{}))
    return sorted(players.values(),key=lambda p:(p['number'],p['name']))

def sync_all():
    errors=[];updated=0
    for config in TEAMS.values():
        try:
            sync(config)
            updated+=1
        except Exception as error:
            errors.append(error)
            print(f"::warning::{config['label']}: se conserva la última copia válida ({error})",flush=True)
    # Publish verified updates even when another competition is unavailable.
    # Keep a failing run when no team could be refreshed.
    if not updated and errors:raise RuntimeError('No se pudo actualizar ningún equipo') from errors[0]
if __name__=='__main__':sync_all()

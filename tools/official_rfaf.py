"""Public RFAF calendar and standings; no account or browser required."""
import concurrent.futures, datetime, http.cookiejar, json, re, urllib.request
from sync_fixtures import Document, is_club, normalize, ROOT
from club_content import scorers,roster,ROSTER_SOURCE
PREFIX='https://www.rfaf.es/pnfg/NPcd/'
DATA_QUERY='cod_primaria=1000120&codcompeticion=48466108&codgrupo=48466109&codtemporada=22'
QUERY='cod_primaria=1000120&CodCompeticion=48466108&CodGrupo=48466109&CodTemporada=22'
SOURCE=PREFIX+'NFG_CmpJornada?'+QUERY
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

def calendar(html,all_teams=False):
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
            out.append(dict(id=f'48466109-{n}-'+str(len([m for m in out if m['round']==n])+1) if all_teams else f'48466109-{n}',round=n,home=cells[0].text(),away=cells[2].text(),home_crest='',away_crest='',date=datetime.datetime.strptime(header[2],'%d-%m-%Y').date().isoformat(),time='',venue='',state='Finalizado' if played else 'Fecha de jornada',played=played,home_score=h,away_score=a,source=SOURCE+'&CodJornada='+str(n),date_provisional=True))
    if len(out)!=(240 if all_teams else 30) or numbers!=list(range(1,31)):raise ValueError('Incomplete official calendar')
    return out,numbers

def standings(html):
    for t in Document(html).root.find('table'):
        if 'table-bordered' not in t.attrs.get('class',''):continue
        out=[]
        for row in t.find('tr'):
            c=[n for n in row.children if n.tag=='td']
            if len(c)!=17 or not c[1].text().isdigit():continue
            num=lambda i:int(c[i].text())
            out.append(dict(position=num(1),team=c[2].text(),points=num(4),played=num(5)+num(9),won=num(6)+num(10),drawn=num(7)+num(11),lost=num(8)+num(12),gf=num(13),ga=num(14),gd=num(13)-num(14),form=c[15].text(),sanction=num(16)))
        if len(out)==16 and sum(is_club(r['team']) for r in out)==1:return out
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

def sync():
    opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def get(url,encoding="iso-8859-15"):
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 CDMenciana public sports data'})
        with opener.open(req,timeout=40) as response:
            raw=response.read(3_000_000)
            html=raw.decode(encoding)
            if 'No se ha aceptado el cookie' in html:raise ValueError('Public RFAF session failed')
            return html
    get('https://www.rfaf.es/')
    print('Public session initialized',flush=True)
    round_matches,numbers=calendar(get(PREFIX+'NFG_VisCalendario_Vis?'+DATA_QUERY+'&CodJornada=5'),all_teams=True)
    matches=[m for m in round_matches if is_club(m['home']) or is_club(m['away'])]
    for match in matches:match['id']=f"48466109-{match['round']}"
    current=max((m['round'] for m in matches if m['played']),default=1)
    standings_url=PREFIX+'NFG_VisClasificacion?'+DATA_QUERY+'&codjornada='+str(current)
    table=standings(get(standings_url))
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
    previous=json.loads((ROOT/'data/fixtures.json').read_text()) if (ROOT/'data/fixtures.json').exists() else {}
    scorers_url=PREFIX+'NFG_CMP_Goleadores?'+DATA_QUERY+'&CodJornada='+str(current)
    try:goal_rows=scorers(get(scorers_url))
    except (ValueError,OSError) as error:
        if not previous.get('scorers'):raise
        goal_rows=previous['scorers']
        scorers_url=previous.get('scorers_source',scorers_url)
        print(f'Goleadores pendientes: {error}; se actualizan los horarios',flush=True)
    try:roster_rows=roster(get(ROSTER_SOURCE,'utf-8'))
    except (ValueError,OSError) as error:
        if not previous.get('roster'):raise
        roster_rows=previous['roster']
        print(f'Plantilla pendiente: {error}; se actualizan los horarios',flush=True)
    club=next(r for r in table if is_club(r['team']))
    results_status=verify_results(matches,club,previous)
    payload=dict(round_matches=round_matches,results_status=results_status,scorers=goal_rows,scorers_source=scorers_url,roster=roster_rows,roster_source=ROSTER_SOURCE,photo_assets=json.loads((ROOT/'data/player-assets.json').read_text()) if (ROOT/'data/player-assets.json').exists() else {},competition='3ª División F.S.',group='Grupo 17',season='2026-2027',team=next(r['team'] for r in table if is_club(r['team'])),source=SOURCE,updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),rounds=numbers,unpublished_rounds=[],matches=matches,standings=table,standings_source=standings_url,crest_assets=json.loads((ROOT/'data/crest-assets.json').read_text()) if (ROOT/'data/crest-assets.json').exists() else {})
    raw=json.dumps(payload,ensure_ascii=False,indent=2)+'\n'
    for target in [ROOT/'data/fixtures.json',ROOT/'android/app/src/main/assets/fixtures.json',ROOT/'server/static/fixtures.json']:target.write_text(raw,encoding='utf-8')
    print(f'Updated {len(matches)} matches, {len(table)} teams, {len(goal_rows)} scorers and {len(roster_rows)} players')
if __name__=='__main__':sync()

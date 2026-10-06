"""Public RFAF calendar and standings; no account or browser required."""
import concurrent.futures, datetime, http.cookiejar, json, re, urllib.request
from sync_fixtures import Document, is_club, ROOT
PREFIX='https://www.rfaf.es/pnfg/NPcd/'
DATA_QUERY='cod_primaria=1000120&codcompeticion=48466108&codgrupo=48466109&codtemporada=22'
QUERY='cod_primaria=1000120&CodCompeticion=48466108&CodGrupo=48466109&CodTemporada=22'
SOURCE=PREFIX+'NFG_CmpJornada?'+QUERY
DIGITS=[2,5,9,4,1,0,8,6,3,7,1,3,5,7,9,0,2,4,6,8,0,2,4,6,8,1,3,5,7,9,7,5,2,0,9,6,3,8,4,1]

def visible(node,css=""):
    if node.tag in ('style','script') or re.search(r'display\s*:\s*none',node.attrs.get('style','')):return ''
    scripts=node.find('script')
    if node.attrs.get('id'):
        call=next((re.search(r'ntype\("'+re.escape(node.attrs['id'])+r'",(\d+),(\d+),',s.text()) for s in scripts),None)
        if call:
            n,i=map(int,call.groups());return str(DIGITS[i*10+n])
    text=''.join(x if isinstance(x,str) else visible(x,css) for x in node.content)
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

def calendar(html):
    tables=[t for t in Document(html).root.find('table') if 'table-hover' in t.attrs.get('class','')]
    out=[];numbers=[]
    for t in tables:
        header=re.search(r'Jornada\s+(\d+)\s*\((\d{2}-\d{2}-\d{4})\)',t.text())
        if not header:continue
        n=int(header[1]);numbers.append(n)
        for row in t.find('tr'):
            cells=[c for c in row.children if c.tag=='td']
            if len(cells)!=3 or not (is_club(cells[0].text()) or is_club(cells[2].text())):continue
            h,a=scores(cells[1]);played=h is not None
            out.append(dict(id=f'48466109-{n}',round=n,home=cells[0].text(),away=cells[2].text(),home_crest='',away_crest='',date=datetime.datetime.strptime(header[2],'%d-%m-%Y').date().isoformat(),time='',venue='',state='Finalizado' if played else 'Fecha de jornada',played=played,home_score=h,away_score=a,source=SOURCE+'&CodJornada='+str(n),date_provisional=True))
    if len(out)!=30 or numbers!=list(range(1,31)):raise ValueError('Incomplete official calendar')
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

def enrich(match,html):
    root=Document(html).root
    homes=[n for n in root.find('div','font_widgetL') if n.find('h4')];aways=[n for n in root.find('div','font_widgetV') if n.find('h4')]
    for h,a in zip(homes,aways):
        if not (is_club(h.text()) or is_club(a.text())):continue
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
    raise ValueError('Club missing from official round')

def sync():
    opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def get(url):
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 CDMenciana public sports data'})
        with opener.open(req,timeout=40) as response:
            raw=response.read(3_000_000)
            html=raw.decode('iso-8859-15')
            if 'No se ha aceptado el cookie' in html:raise ValueError('Public RFAF session failed')
            return html
    get('https://www.rfaf.es/')
    print('Public session initialized',flush=True)
    matches,numbers=calendar(get(PREFIX+'NFG_VisCalendario_Vis?'+DATA_QUERY+'&CodJornada=5'))
    current=max((m['round'] for m in matches if m['played']),default=1)
    standings_url=PREFIX+'NFG_VisClasificacion?'+DATA_QUERY+'&codjornada='+str(current)
    table=standings(get(standings_url))
    print(f'Calendar: {len(matches)} matches; standings: {len(table)} teams',flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        next_round=min((m['round'] for m in matches if not m['played']),default=31)
        published=[m for m in matches if m['played'] or m['round']==next_round]
        list(pool.map(lambda match:enrich(match,get(match['source'])),published))
    club=next(r for r in table if is_club(r['team']))
    played=[m for m in matches if m['played']]
    gf=sum(m['home_score'] if is_club(m['home']) else m['away_score'] for m in played)
    ga=sum(m['away_score'] if is_club(m['home']) else m['home_score'] for m in played)
    if (len(played),gf,ga)!=(club['played'],club['gf'],club['ga']):raise ValueError('Scores disagree with official standings; retaining previous data')
    payload=dict(competition='3ª División F.S.',group='Grupo 17',season='2026-2027',team=next(r['team'] for r in table if is_club(r['team'])),source=SOURCE,updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),rounds=numbers,unpublished_rounds=[],matches=matches,standings=table,standings_source=standings_url)
    raw=json.dumps(payload,ensure_ascii=False,indent=2)+'\n'
    for target in [ROOT/'data/fixtures.json',ROOT/'android/app/src/main/assets/fixtures.json',ROOT/'server/static/fixtures.json']:target.write_text(raw,encoding='utf-8')
    print(f'Updated {len(matches)} matches and {len(table)} standings rows')
if __name__=='__main__':sync()

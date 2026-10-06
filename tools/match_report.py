"""Extract the public acta into data, never federation HTML or scripts."""
import re,subprocess
from sync_fixtures import Document
from official_rfaf import visible

def report(html):
    root=Document(html).root
    containers=[n for n in root.find('div','container') if any(h.text()=='Ficha de Partido' for h in n.find('h4'))]
    if not containers:raise ValueError('Acta not published: '+str([n.text()[:150] for n in root.find('title')+root.find('h4')])+ ' '+repr(html[:300])+ ' bytes='+str(len(html)))
    root=containers[-1];css=' '.join(n.text() for n in root.find('style'))
    blocks=[];pending=[]
    def clean(text):return ' '.join(text.split())
    def flush():
        text=clean(' '.join(pending));pending.clear()
        if text:blocks.append({'kind':'text','text':text})
    def cell(n):
        text=clean(visible(n,css))
        labels=[]
        for img in n.find('img'):
            src=img.attrs.get('src','').lower()
            label='Tarjeta amarilla' if 'tarj_amar' in src else 'Tarjeta roja' if 'tarj_roja' in src else 'Segunda amarilla' if 'tarj_2' in src else img.attrs.get('alt','')
            if label:labels.append(label)
        for i in n.find('i'):
            if 'fa-futbol' in i.attrs.get('class',''):
                style=i.attrs.get('style','').lower()
                labels.append('Gol en propia puerta' if 'red' in style else 'Gol de penalti' if 'blue' in style else 'Gol')
        return clean(' · '.join(labels+([text] if text else [])))
    def walk(n):
        if isinstance(n,str):pending.append(n);return
        if n.tag in ('script','style','button') or re.search(r'display\s*:\s*none',n.attrs.get('style','')):return
        if n.tag=='table':
            flush();rows=[]
            for tr in n.find('tr'):
                cells=[cell(c) for c in tr.children if c.tag in ('td','th')]
                if any(cells):rows.append(cells)
            if rows:blocks.append({'kind':'table','rows':rows})
            return
        if n.tag in ('h1','h2','h3','h4','h5') and not n.find('table'):
            flush();text=cell(n)
            if text:blocks.append({'kind':'heading','text':text})
            return
        if n.tag=='br':flush();return
        for c in n.content:walk(c)
    walk(root);flush()
    if len(blocks)<10:raise ValueError('Incomplete acta')
    return {'blocks':blocks}

def sync_reports(matches,get,root):
    import concurrent.futures,datetime,json,urllib.parse
    urls={urllib.parse.parse_qs(urllib.parse.urlparse(m['acta_url']).query)['CodActa'][0]:m['acta_url'] for m in matches if m.get('played') and m.get('acta_url')}
    def fetch(item):
        id,url=item
        try:
            html=get(url)
            if not html.strip():html=get('https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&cod_acta='+id)
            data=report(html);data.update(id=id,source=url,updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
            raw=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
            for folder in ['data/actas','server/static/actas','android/app/src/main/assets/actas']:
                target=root/folder/(id+'.json');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(raw)
            return 1
        except (ValueError,OSError,subprocess.SubprocessError) as error:
            print(f'Acta {id} pendiente: {error}',flush=True);return 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:count=sum(pool.map(fetch,urls.items()))
    print(f'Updated {count} public match reports',flush=True)

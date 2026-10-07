"""Read public RFAF results, retaining only CD Menciana fixtures."""
import argparse, concurrent.futures, datetime, json, re, time, unicodedata, urllib.request
from html.parser import HTMLParser
from pathlib import Path
BASE='https://stars.rfaf.es/?delegacion=9&competicion=48466108&grupo=48466109&widget_view=results'
ROOT=Path(__file__).resolve().parents[1]

class Node:
    def __init__(self,tag='',attrs=None): self.tag=tag;self.attrs=dict(attrs or []);self.children=[];self.parts=[];self.content=[]
    def text(self): return ' '.join(' '.join(self.parts).split())
    def find(self,tag=None,cls=None):
        result=[]
        for child in self.children:
            if (tag is None or child.tag==tag) and (cls is None or cls in child.attrs.get('class','').split()):result.append(child)
            result.extend(child.find(tag,cls))
        return result
class Document(HTMLParser):
    def __init__(self,html):super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root];self.feed(html)
    def handle_starttag(self,tag,attrs):
        node=Node(tag,attrs);self.stack[-1].children.append(node);self.stack[-1].content.append(node)
        if tag not in ('img','input','meta','link','br','hr','source','area','wbr','embed'):self.stack.append(node)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:del self.stack[i:];break
    def handle_data(self,text):
        self.stack[-1].content.append(text)
        for n in self.stack:n.parts.append(text)

def normalize(name):return ''.join(c for c in unicodedata.normalize('NFKD',name.upper()) if not unicodedata.combining(c))
def is_club(name):return 'APAGA Y VAMONOS' in normalize(name)
def fetch(url):
    last=None
    for retry in range(3):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'CDMenciana/0.3 public-fixture-sync','Accept':'text/html'})
            with urllib.request.urlopen(req,timeout=30) as r:return r.read(3_000_000).decode('utf-8')
        except Exception as e:last=e;time.sleep(retry+1)
    raise RuntimeError('RFAF fetch failed') from last

def rounds(html):
    root=Document(html).root
    select=next((n for n in root.find('select') if n.attrs.get('name')=='jornada'),None)
    if not select:raise ValueError('RFAF round selector missing')
    values=[int(n.attrs['value']) for n in select.find('option') if n.attrs.get('value','').isdigit()]
    if not values or len(values)>50:raise ValueError('Unexpected RFAF calendar')
    return values

def parse(html,round_number):
    root=Document(html).root;out=[]
    rows=root.find('article','novanet-match-row')
    if not rows:
        if 'No hay partidos publicados para esta jornada.' in root.text():return []
        raise ValueError(f'No match rows in round {round_number}')
    for row in rows:
        imgs=row.find('img')
        if len(imgs)!=2:raise ValueError('Expected home/away crests')
        home,away=[x.attrs.get('alt','').strip() for x in imgs]
        if not (is_club(home) or is_club(away)):continue
        info={}
        for div in row.find('div'):
            spans=div.find('span')
            if len(spans)==1 and spans[0].text() in ('Fecha:','Hora:','Lugar:','Estado:'):
                label=spans[0].text();text=div.text()
                if text.startswith(label):info[label[:-1]]=text[len(label):].strip()
        scores=row.find('div','novanet-score-value')
        if len(scores)!=1:raise ValueError('Missing score cell')
        score=scores[0].text();m=re.fullmatch(r'(\d+)\s*[-:]\s*(\d+)',score)
        # The cell can contain a kick-off time. Only Jugado implies a final score.
        state=info.get('Estado','')
        played=normalize(state) in ('JUGADO','FINALIZADO')
        if played and not m:raise ValueError('Played fixture without final score')
        date=info.get('Fecha','')
        if date and date not in ('-','Por determinar'):
            try:date=datetime.datetime.strptime(date,'%d/%m/%Y').date().isoformat()
            except ValueError:date=''
        else:date=''
        hour=info.get('Hora','');hour=hour if re.fullmatch(r'\d{2}:\d{2}',hour) else ''
        out.append({'id':f'48466109-{round_number}','round':round_number,'home':home,'away':away,'home_crest':imgs[0].attrs.get('src',''),'away_crest':imgs[1].attrs.get('src',''),'date':date,'time':hour,'venue':info.get('Lugar',''),'state':state,'played':played,'home_score':int(m[1]) if played else None,'away_score':int(m[2]) if played else None,'source':BASE+'&jornada='+str(round_number)})
    if len(out)>1:raise ValueError('Ambiguous club fixtures')
    return out

def sync():
    first=fetch(BASE);numbers=rounds(first)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        # All rounds must succeed before overwriting the last known good data.
        batches=list(pool.map(lambda n:parse(fetch(BASE+'&jornada='+str(n)),n),numbers))
    matches=[m for batch in batches for m in batch]
    if not matches:raise ValueError('No CD Menciana fixtures found')
    payload={'competition':'3ª División F.S.','group':'Grupo 17','team':'C.D. APAGA Y VAMONOS RAVI OBRAS & SERVICIOS','source':BASE,'updated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rounds':numbers,'unpublished_rounds':[n for n,batch in zip(numbers,batches) if not batch],'matches':sorted(matches,key=lambda m:m['round'])}
    raw=json.dumps(payload,ensure_ascii=False,indent=2)+'\n'
    for target in [ROOT/'data/fixtures.json',ROOT/'android/app/src/main/assets/fixtures.json',ROOT/'server/static/fixtures.json']:
        target.parent.mkdir(parents=True,exist_ok=True);target.write_text(raw,encoding='utf-8')
    print(f'Updated {len(matches)} fixtures across {len(numbers)} rounds')
if __name__=='__main__':
    from official_rfaf import sync_all as official_sync
    official_sync()

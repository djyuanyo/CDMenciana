"""Public category scorers and the club's first-team roster."""
import re
from urllib.parse import urljoin, urlsplit
from sync_fixtures import Document
ROSTER_SOURCE='https://cdmenciana.es/equipos/'

def scorers(html):
    for table in Document(html).root.find('table'):
        if 'table-hover' not in table.attrs.get('class',''):continue
        result=[]
        for row in table.find('tr'):
            cells=[n for n in row.children if n.tag=='td']
            if len(cells)!=6:continue
            text=[n.text() for n in cells]
            goals=re.fullmatch(r'(\d+)(?:\s*\((\d+)\s*P\))?',text[4])
            if not text[0] or not text[1] or not goals or not text[3].isdigit():raise ValueError('Invalid official scorer row')
            average=float(text[5].replace(',','.')) if text[5] else None
            result.append(dict(name=text[0],team=text[1],played=int(text[3]),goals=int(goals[1]),penalties=int(goals[2] or 0),average=average))
        if result:
            if any(a['goals']<b['goals'] for a,b in zip(result,result[1:])):raise ValueError('Unexpected scorer order')
            return result
    raise ValueError('Official scorer table missing')

def roster(html):
    players=[]
    for card in Document(html).root.find('article','player-card'):
        names=card.find('h3');images=card.find('img');number=re.search(r'#\s*(\d+)\b',card.text())
        if len(names)!=1 or len(images)!=1 or not number:raise ValueError('Incomplete club player card')
        photo=urljoin(ROSTER_SOURCE,images[0].attrs.get('src',''))
        if not photo.startswith('https://cdmenciana.es/images/jugadores/'):raise ValueError('Unexpected player photo source')
        players.append(dict(name=names[0].text(),number=int(number[1]),position='Portero' if any(n.text()=='Portero' for n in card.find('span')) else 'Jugador de pista',photo=photo))
    if not players or len(players)>50:raise ValueError('Club roster missing')
    if len({p['number'] for p in players})!=len(players):raise ValueError('Duplicate club shirt number')
    return players

NEWS_SOURCE='https://cdmenciana.es/noticias/'
def news(html):
    root=Document(html).root;items=[]
    for card in root.find('section','news-lead')+root.find('article','news-card'):
        headings=card.find('h3') or card.find('h2');times=card.find('time');links=card.find('a');imgs=card.find('img')
        if not headings or not times or not links:raise ValueError('Incomplete club news card')
        url=urljoin(NEWS_SOURCE,links[0].attrs.get('href',''))
        if not url.startswith(NEWS_SOURCE):raise ValueError('Unexpected news link')
        date=times[0].attrs.get('datetime','')[:10]
        import datetime
        datetime.date.fromisoformat(date)
        category=next((n.text() for n in card.find('span') if n.text()),'Noticias')
        items.append(dict(title=headings[0].text(),date=date,category=category,url=url,image=urljoin(NEWS_SOURCE,imgs[0].attrs.get('src','')) if imgs else ''))
    if len(items)>100:raise ValueError('Unexpected news count')
    if not items and not any('noticias' in h.text().lower() for h in root.find('h1')):raise ValueError('Club news index missing')
    if len({n['url'] for n in items})!=len(items):raise ValueError('Duplicate news links')
    return sorted(items,key=lambda n:n['date'],reverse=True)

def news_article(html, url):
    """Keep article text and pictures in order, excluding navigation and related stories."""
    root=Document(html).root
    candidates=[n for n in root.find() if any(c in n.attrs.get('class','').split() for c in ('article-content','news-content','post-content','entry-content','prose','article-body','news-detail-body'))]
    if not candidates:
        candidates=[n for n in root.find('article') if n.find('h1')] or root.find('main')
    if not candidates:raise ValueError('Club article body missing')
    body=candidates[0];blocks=[]
    def text(node):return node.text().strip()
    def image(node,caption=''):
        src=urljoin(url,node.attrs.get('src',''));parsed=urlsplit(src)
        if parsed.scheme=='https' and parsed.hostname in ('cdmenciana.es','cms.cdmenciana.es'):
            blocks.append(dict(kind='image',src=src,alt=node.attrs.get('alt',''),caption=caption))
    def walk(node):
        cls=node.attrs.get('class','').split()
        if node.tag in ('script','style','nav','footer','aside','header','form','button') or any(c in cls for c in ('news-meta','article-meta','related-news','news-card','news-lead','breadcrumbs','share-buttons','article-header','news-detail-header')):return
        value=text(node)
        if node.tag in ('p','h2','h3','h4','blockquote'):
            if value:blocks.append(dict(kind='paragraph' if node.tag=='p' else 'quote' if node.tag=='blockquote' else 'heading',text=value))
            for img in node.find('img'):image(img)
        elif node.tag in ('ul','ol'):
            rows=[text(child) for child in node.children if child.tag=='li' and text(child)]
            if rows:blocks.append(dict(kind='list',items=rows,ordered=node.tag=='ol'))
        elif node.tag=='figure':
            caption=' '.join(text(child) for child in node.find('figcaption'))
            for img in node.find('img'):image(img,caption)
        elif node.tag=='img':image(node)
        else:
            for child in node.children:walk(child)
    walk(body)
    if not any(block['kind']=='paragraph' for block in blocks):raise ValueError('Club article text missing')
    return blocks

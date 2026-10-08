"""Synchronize public club news independently of RFAF availability."""
import datetime,json,urllib.request
from sync_fixtures import ROOT
from club_content import news,news_article,NEWS_SOURCE

def sync():
    request=urllib.request.Request(NEWS_SOURCE,headers={'User-Agent':'CDMenciana club-news-sync','Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=40) as response:html=response.read(3_000_000).decode('utf-8')
    rows=news(html)
    previous={}
    try:previous={row['url']:row for row in json.loads((ROOT/'data/news.json').read_text(encoding='utf-8'))['news']}
    except (OSError,ValueError,KeyError):pass
    for row in rows:
        try:
            req=urllib.request.Request(row['url'],headers={'User-Agent':'CDMenciana club-news-sync','Cache-Control':'no-cache'})
            with urllib.request.urlopen(req,timeout=30) as response:article_html=response.read(3_000_000).decode('utf-8')
            row['content']=news_article(article_html,row['url'])
        except Exception as error:
            if previous.get(row['url'],{}).get('content'):row['content']=previous[row['url']]['content']
            print(f"Article pending: {row['url']}: {error}")
    payload=dict(source=NEWS_SOURCE,updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),news=rows)
    raw=json.dumps(payload,ensure_ascii=False,indent=2)+'\n'
    for path in [ROOT/'data/news.json',ROOT/'server/static/news.json',ROOT/'android/app/src/main/assets/news.json']:path.write_text(raw,encoding='utf-8')
    print(f'Updated {len(rows)} club news articles')
if __name__=='__main__':sync()

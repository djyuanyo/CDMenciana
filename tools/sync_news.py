"""Synchronize public club news independently of RFAF availability."""
import datetime,json,urllib.request
from sync_fixtures import ROOT
from club_content import news,NEWS_SOURCE

def sync():
    request=urllib.request.Request(NEWS_SOURCE,headers={'User-Agent':'CDMenciana club-news-sync','Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=40) as response:html=response.read(3_000_000).decode('utf-8')
    rows=news(html)
    payload=dict(source=NEWS_SOURCE,updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),news=rows)
    raw=json.dumps(payload,ensure_ascii=False,indent=2)+'\n'
    for path in [ROOT/'data/news.json',ROOT/'server/static/news.json',ROOT/'android/app/src/main/assets/news.json']:path.write_text(raw,encoding='utf-8')
    print(f'Updated {len(rows)} club news articles')
if __name__=='__main__':sync()

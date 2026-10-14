"""Publish the club's YouTube channel (CDM TV) in the same order YouTube shows it."""
import datetime, json, pathlib, re, subprocess, sys, urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
HANDLE = '@cdmencianaapagayvamonosfs3459'
CHANNEL = 'https://www.youtube.com/' + HANDLE
# YouTube's own tabs, newest first as on the channel page.
TABS = [('videos', 'Vídeos'), ('streams', 'Directos'), ('shorts', 'Shorts')]
VIDEO_ID = re.compile(r'[A-Za-z0-9_-]{11}')
AGENT = {'User-Agent': 'Mozilla/5.0 (CDMenciana CDM TV sync)', 'Accept-Language': 'es-ES,es;q=0.9'}


def flat(tab):
    """Every entry of one channel tab, in YouTube's order (yt-dlp, no download)."""
    result = subprocess.run([sys.executable, '-m', 'yt_dlp', '--flat-playlist', '--dump-single-json', '--no-warnings', '--extractor-args', 'youtubetab:approximate_date', CHANNEL + '/' + tab],
                            capture_output=True, text=True, timeout=180)
    if result.returncode != 0:
        # A channel without that tab is not an error.
        if 'does not have a' in result.stderr: return None, []
        raise RuntimeError(result.stderr.strip()[-400:] or 'yt-dlp failed')
    data = json.loads(result.stdout)
    return data.get('channel_id') or data.get('id'), data.get('entries') or []


def video(entry, kind):
    vid = entry.get('id') or ''
    if not VIDEO_ID.fullmatch(vid): return None
    stamp = entry.get('timestamp') or entry.get('release_timestamp')
    published = datetime.datetime.fromtimestamp(stamp, datetime.timezone.utc).isoformat() if stamp else ''
    duration = entry.get('duration')
    status = entry.get('live_status') or ('is_live' if entry.get('is_live') else '')
    return {'id': vid, 'title': (entry.get('title') or '').strip()[:200], 'published': published,
            'duration': int(duration) if isinstance(duration, (int, float)) and status != 'is_live' else None, 'kind': kind,
            'live': {'is_live': 'now', 'is_upcoming': 'upcoming'}.get(status, '')}


def live_now():
    """The stream on air right now, if any (the channel's /live page points to it)."""
    result = subprocess.run([sys.executable, '-m', 'yt_dlp', '--dump-single-json', '--skip-download', '--no-warnings', CHANNEL + '/live'],
                            capture_output=True, text=True, timeout=120)
    if result.returncode != 0: return None  # Not live (or not readable): nothing to feature.
    data = json.loads(result.stdout)
    if not (data.get('is_live') or data.get('live_status') == 'is_live'): return None
    return video({**data, 'live_status': 'is_live'}, 'streams')


def feed(channel_id):
    """Fallback: the channel's public feed (latest 15 uploads, newest first)."""
    url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channel_id
    with urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=30) as response:
        root = ET.fromstring(response.read(2_000_000))
    ns = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
    rows = []
    for item in root.findall('a:entry', ns):
        vid = item.findtext('yt:videoId', '', ns)
        if VIDEO_ID.fullmatch(vid):
            link = item.find('a:link', ns)
            kind = 'shorts' if link is not None and '/shorts/' in link.get('href', '') else 'videos'
            rows.append({'id': vid, 'title': item.findtext('a:title', '', ns).strip()[:200], 'published': item.findtext('a:published', '', ns), 'duration': None, 'kind': kind})
    return rows


def channel_id_from_page():
    with urllib.request.urlopen(urllib.request.Request(CHANNEL, headers=AGENT), timeout=30) as response:
        page = response.read(3_000_000).decode('utf-8', 'replace')
    found = re.search(r'"(?:externalId|channelId)":"(UC[A-Za-z0-9_-]{22})"', page) or re.search(r'youtube\.com/channel/(UC[A-Za-z0-9_-]{22})', page)
    if not found: raise RuntimeError('Channel id not found')
    return found.group(1)


def sync():
    path = ROOT / 'data/videos.json'
    try: previous = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError): previous = {}
    channel_id, sections, problems = previous.get('channel_id', ''), [], []
    for tab, label in TABS:
        try:
            found_id, entries = flat(tab)
            channel_id = channel_id or found_id or ''
            rows = [v for v in (video(e, tab) for e in entries) if v]
            sections.append({'key': tab, 'title': label, 'videos': rows})
        except Exception as error:
            problems.append(f'{tab}: {error}')
    if not any(sec['videos'] for sec in sections):
        sections = []
        # yt-dlp can be blocked from cloud runners; the feed still lists the latest uploads.
        try:
            channel_id = channel_id or channel_id_from_page()
            rows = feed(channel_id)
            for tab, label in TABS:
                sections.append({'key': tab, 'title': label, 'videos': [r for r in rows if r['kind'] == tab]})
        except Exception as error:
            problems.append(f'feed: {error}')
    live = None
    try: live = live_now()
    except Exception as error: problems.append(f'live: {error}')
    live = live or next((v for sec in sections for v in sec['videos'] if v.get('live') == 'now'), None)
    if not any(sec['videos'] for sec in sections) and not live:
        print('::warning::No videos read; keeping the previous list. ' + ' | '.join(problems))
        return
    payload = {'source': CHANNEL, 'channel_id': channel_id, 'updated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'live': live, 'sections': sections, 'videos': [v for s in sections for v in s['videos']]}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    summary = ', '.join('%d %s' % (len(s['videos']), s['key']) for s in sections)
    print('CDM TV: ' + summary + (' · EN DIRECTO: ' + live['id'] if live else '') + (' (problems: ' + ' | '.join(problems) + ')' if problems else ''))


if __name__ == '__main__': sync()

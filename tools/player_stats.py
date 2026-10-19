"""Refresh club player totals independently from historical acta downloads."""
import concurrent.futures, datetime, hashlib, json, time, urllib.parse, subprocess
from match_report import Document, person_key, player_identity, player_profile, profile_for_acta, safe_profile_url, since

TTL=datetime.timedelta(minutes=15)
RETRY=datetime.timedelta(minutes=5)
def save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def refresh_stats(config,get,root,now=None,budget=90):
    now=now or datetime.datetime.now(datetime.timezone.utc)
    deadline=time.monotonic()+budget
    filename=config['filename']
    snapshot=root/'data'/filename
    data=json.loads(snapshot.read_text())
    matches=data.get('matches',[])
    played=[m for m in matches if m.get('played') and m.get('acta_url')]
    if not played:return 0
    latest=max(played,key=lambda m:(int(m.get('round',0)),m.get('date','')))
    acta=urllib.parse.parse_qs(urllib.parse.urlparse(latest['acta_url']).query).get('CodActa',[''])[0]
    if not acta.isdigit():return 0
    round_number=int(latest.get('round',0))
    signature=hashlib.sha256(json.dumps([[m.get('round'),m.get('home_score'),m.get('away_score'),m.get('acta_url')] for m in played],sort_keys=True).encode()).hexdigest()[:16]
    cache_path=root/('data/rfaf-player-profiles.json' if filename=='fixtures.json' else 'data/rfaf-player-profiles'+filename.removeprefix('fixtures').removesuffix('.json')+'.json')
    try:cache=json.loads(cache_path.read_text()).get('profiles',{})
    except (OSError,ValueError):cache={}
    # Keep identity and each match's participation unchanged; only cumulative stats are refreshed.
    refs={player_identity(p):p for p in data.get('roster',[]) if safe_profile_url(p.get('profile_url','')) and p.get('rfaf_id')}
    def newest(identity):
        rows=[p for u,p in cache.items() if player_identity({'profile_url':u})==identity and (p.get('sections') or p.get('failed_at'))]
        return max(rows,key=lambda p:max(p.get('updated_at',''),p.get('failed_at','')),default={})
    def fetch(item):
        identity,ref=item;known=newest(identity)
        age=since(known.get('updated_at',''),now)
        if known.get('stats_signature')==signature and age is not None and datetime.timedelta(0)<=age<TTL:return identity,known
        attempted=since(known.get('failed_at',''),now)
        if attempted is not None and datetime.timedelta(0)<=attempted<RETRY:return identity,known
        if time.monotonic()>deadline:return identity,known
        candidate=profile_for_acta(ref,acta).get('profile_url','')
        for url in dict.fromkeys([candidate,ref['profile_url']]):
            try:
                html=get(url)
                headings=[person_key(n.text()) for n in Document(html).root.find('h4') if ',' in n.text()]
                if headings and person_key(ref['name']) not in headings:raise ValueError('La fuente devolvió otro jugador')
                result=player_profile(html,url,ref['name'])
                result.update(stats_signature=signature,stats_round=round_number)
                return identity,result
            except (ValueError,OSError,RuntimeError,subprocess.SubprocessError):pass
        print('::warning::Estadísticas pendientes: '+ref['name']+'; se conserva la última copia válida',flush=True)
        return identity,{**known,'failed_at':now.isoformat()}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:profiles=dict(pool.map(fetch,refs.items()))
    count=0
    for identity,profile in profiles.items():
        ref=refs[identity]
        cache[ref['profile_url']]=profile
        for url in list(cache):
            if player_identity({'profile_url':url})==identity:cache[url]=profile
        if profile.get('sections') and profile.get('stats_signature')==signature:
            ref.update(stats=profile['sections'],profile_updated_at=profile['updated_at'],stats_round=profile['stats_round'])
            count+=1
    save(cache_path,{'updated_at':now.isoformat(),'profiles':cache})
    if not count:return 0
    data['roster_updated_at']=now.isoformat()
    data['stats_updated_at']=now.isoformat()
    for folder in ('data','server/static','android/app/src/main/assets'):save(root/folder/filename,data)
    from official_rfaf import write_roster_snapshot
    write_roster_snapshot(config,data)
    # The same totals appear when a player is opened from an older acta.
    ids={urllib.parse.parse_qs(urllib.parse.urlparse(m.get('acta_url','')).query).get('CodActa',[''])[0] for m in data.get('round_matches',matches)}
    for report_id in ids:
        if not report_id.isdigit():continue
        try:report=json.loads((root/'data/actas'/(report_id+'.json')).read_text())
        except (OSError,ValueError):continue
        changed=False
        for player in report.get('players',[]):
            profile=profiles.get(player_identity(player),{})
            if profile.get('sections') and profile.get('stats_signature')==signature:
                player.update(stats=profile['sections'],profile_updated_at=profile['updated_at'],stats_round=round_number);changed=True
        if changed:
            for folder in ('data/actas','server/static/actas','android/app/src/main/assets/actas'):save(root/folder/(report_id+'.json'),report)
    print(f"Estadísticas {config['key']}: {count}/{len(refs)} perfiles verificados; jornada {round_number}",flush=True)
    return count

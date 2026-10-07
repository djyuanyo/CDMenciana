"""Extract the public acta into data, never federation HTML or scripts."""
import base64, binascii, concurrent.futures, datetime, hashlib, html as html_lib, json, re, subprocess, urllib.parse
from sync_fixtures import Document,normalize
from official_rfaf import visible

RFAF_HOSTS={'www.rfaf.es','rfaf.es'}
PROFILE_CACHE='data/rfaf-player-profiles.json'

def clean(text):return ' '.join(str(text or '').split())
def person_key(name):return re.sub(r'\s+',' ',clean(name)).upper()

def safe_profile_url(href):
    try:
        url=urllib.parse.urljoin('https://www.rfaf.es/pnfg/NPcd/',href or '')
        p=urllib.parse.urlparse(url);host=(p.hostname or '').lower()
        if p.scheme!='https' or host not in RFAF_HOSTS or p.username or p.password:return ''
        path=p.path.lower();q=urllib.parse.parse_qs(p.query)
        if not re.fullmatch(r'/pnfg/(?:npcd/)?nfg_estadisticasjugador',path):return ''
        if not re.fullmatch(r'\d{1,12}',q.get('jugador',[''])[0]):return ''
        return url
    except ValueError:return ''

def profile_href(node):
    values=[node.attrs.get(k,'') for k in ('href','onclick','data-href','data-url','data-link','data-target','formaction')]
    for value in values:
        if not value:continue
        value=value.replace(r'\x26','&').replace(r'\u0026','&').replace('&amp;','&')
        direct=safe_profile_url(value)
        if direct:return direct
        # onclick wrappers frequently contain the real route inside quotes.
        for match in re.findall(r'''(?:https?://(?:www\.)?rfaf\.es)?/?(?:pnfg/(?:NPcd/)?)?[^'"<> ]*(?:Jugador|Estadisticas|Persona|Licencia|Ficha)[^'"<> ]*''',value,re.I):
            direct=safe_profile_url(match)
            if direct:return direct
    return ''

def player_refs_from_node(root,css=''):
    players={}
    nodes=[root]+root.find()
    row_for={id(n):row for row in root.find('tr') for n in [row]+row.find()}
    for node in nodes:
        url=profile_href(node)
        if not url:continue
        cells=[c for c in node.children if c.tag in ('td','th')] if node.tag=='tr' else []
        name=clean(visible(cells[-1] if cells else node,css))
        if ',' not in name:name=clean(node.attrs.get('title','') or node.attrs.get('aria-label',''))
        if ',' not in name or not 4<=len(name)<=120:continue
        photo=''
        for img in row_for.get(id(node),node).find('img'):
            for attr in ('src','data-src','data-original','data-lazy-src'):
                photo=safe_image(img.attrs.get(attr,''),url)
                if photo:break
            if photo:break
        players[person_key(name)]={'id':hashlib.sha256(url.encode()).hexdigest()[:16],'name':name,'profile_url':url,'photo':photo}
    # Some RFAF team pages expose player ids in script/onclick data rather than anchors.
    raw=' '.join(clean(n.text()) for n in root.find('script'))
    for match in re.finditer(r'''(?:NFG_[A-Za-z]*(?:Jugador|Estadisticas|Persona|Licencia|Ficha)[A-Za-z]*\?[^"'<> ]+)''',raw,re.I):
        url=safe_profile_url(match.group(0).replace(r'\x26','&').replace(r'\u0026','&'))
        if not url:continue
        window=raw[max(0,match.start()-180):min(len(raw),match.end()+180)]
        names=re.findall(r'''([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ' -]{2,},\s*[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ' -]{1,60})''',window)
        if names:
            name=clean(names[-1]);players.setdefault(person_key(name),{'id':hashlib.sha256(url.encode()).hexdigest()[:16],'name':name,'profile_url':url,'photo':''})
    return list(players.values())

def raw_player_refs(source,acta_id=''):
    players={}
    for hit in re.finditer(r'''(?i)(?:jugador|cod[_-]?jugador)\\s*(?:=|%3D|:)\\s*["']?(\\d{1,12})''',source):
        player_id=hit.group(1);window=source[max(0,hit.start()-700):min(len(source),hit.end()+700)]
        plain=clean(html_lib.unescape(re.sub(r'<[^>]+>',' ',window)))
        names=re.findall(r'''([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ' .-]{1,70},\\s*[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ' .-]{1,70})''',plain)
        if not names:continue
        name=min(names,key=lambda n:abs(plain.find(n)-len(plain)//2))
        query={'cod_primaria':'3000328','jugador':player_id}
        if str(acta_id).isdigit():query.update(codacta=str(acta_id),nueva_ventana='0')
        url='https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador?'+urllib.parse.urlencode(query)
        photos=re.findall(r'''(?:src|data-src)\\s*=\\s*["']([^"']*(?:Jugador|jugador|pimg)[^"']*\\.(?:jpe?g|png|webp)[^"']*)["']''',window,re.I)
        photo=next((safe_image(html_lib.unescape(x),url) for x in photos if safe_image(html_lib.unescape(x),url)),'')
        players[person_key(name)]={'id':hashlib.sha256(url.encode()).hexdigest()[:16],'name':clean(name),'profile_url':url,'photo':photo,'rfaf_id':player_id,'acta_id':str(acta_id or '')}
    return list(players.values())

def player_refs(html):
    root=Document(html).root
    css=' '.join(n.text() for n in root.find('style'))
    return player_refs_from_node(root,css)

def safe_image(src,base):
    src=clean(src)
    if not src:return ''
    if src.startswith('data:'):
        match=re.fullmatch(r'data:image/(?:png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)',src,re.I)
        if not match or len(src)>700000:return ''
        try:raw=base64.b64decode(match[1],validate=True)
        except (ValueError,binascii.Error):return ''
        mime='jpeg' if raw.startswith(b'\xff\xd8\xff') else 'png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else 'gif' if raw.startswith((b'GIF87a',b'GIF89a')) else 'webp' if raw.startswith(b'RIFF') and raw[8:12]==b'WEBP' else ''
        return 'data:image/'+mime+';base64,'+match[1] if mime else ''
    try:
        url=urllib.parse.urljoin(base,src or '');p=urllib.parse.urlparse(url);host=(p.hostname or '').lower()
        return url if p.scheme=='https' and (host in RFAF_HOSTS or host.endswith('.rfaf.es') or host.endswith('.filesnovanet.es')) else ''
    except ValueError:return ''

def player_profile(html,url,name):
    root=Document(html).root;candidates=[];wanted=person_key(name).split(',')[0].split()
    for img in root.find('img'):
        src=safe_image(img.attrs.get('src',''),url)
        if not src:continue
        meta=' '.join([src,img.attrs.get('class',''),img.attrs.get('id',''),img.attrs.get('alt',''),img.attrs.get('title','')]).lower()
        if any(x in meta for x in ('escudo','logo','banner','cookie','icon','spacer','loading','tarj_','publicidad','social')):continue
        score=8 if re.search(r'jugador|futbolista|player|persona|foto|photo|retrato',meta) else 0
        if '/pimg/' in meta or 'novanet' in meta:score+=2
        if any(token.lower() in meta for token in wanted if len(token)>3):score+=3
        try:
            w=int(re.sub(r'\D','',img.attrs.get('width','')) or 0);h=int(re.sub(r'\D','',img.attrs.get('height','')) or 0)
            if w>=70 and h>=70:score+=2
        except ValueError:pass
        if re.search(r'\.(?:jpe?g|png|webp)(?:\?|$)',src,re.I):score+=1
        candidates.append((score,src))
    candidates.sort(key=lambda x:x[0],reverse=True);photo=candidates[0][1] if candidates and candidates[0][0]>=2 else ''
    sections=[];seen=set()
    for table in root.find('table'):
        headings=table.find('th');title=clean(headings[0].text()) if headings else ''
        if title not in ('Partidos','Sanciones','Goles') or title in seen:continue
        rows=[]
        for tr in table.find('tr'):
            cells=[clean(visible(cell)) for cell in tr.children if cell.tag=='td']
            if len(cells)==2 and re.fullmatch(r'\d+(?:[.,]\d+)?',cells[1]):rows.append(cells)
        if rows:sections.append({'title':title,'rows':rows});seen.add(title)
    if sections:
        return {'name':name,'source':url,'photo_source':photo,'sections':sections,'updated_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    tokens=('PARTID','GOLES','GOL ','TARJET','TEMPORADA','EQUIPO','COMPETIC','MINUT','JUGAD','TITULAR','SUPLENT','RESULTADO')
    for table in root.find('table'):
        rows=[]
        for tr in table.find('tr'):
            cells=[clean(visible(cell)) for cell in tr.children if cell.tag in ('td','th')]
            if any(cells):rows.append(cells)
        if len(rows)<2:continue
        sample=' '.join(' '.join(r) for r in rows[:8]).upper();numeric=sum(bool(re.search(r'\d',x)) for r in rows for x in r)
        if not any(t in sample for t in tokens) and numeric<max(2,len(rows)//2):continue
        compact=[r[:8] for r in rows[:24]];sig=json.dumps(compact,ensure_ascii=False)
        if sig in seen:continue
        seen.add(sig);title=clean(' · '.join(compact[0]))[:120]
        sections.append({'title':title or 'Estadísticas RFAF','rows':compact})
        if len(sections)>=4:break
    if not sections:raise ValueError('Estadísticas de jugador no disponibles en la fuente oficial')
    return {'name':name,'source':url,'photo_source':photo,'sections':sections,'updated_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}

def fresh_profile(profile,now):
    try:return (now-datetime.datetime.fromisoformat(profile.get('updated_at','').replace('Z','+00:00'))).total_seconds()<1800
    except (ValueError,TypeError):return False

def player_identity(ref):
    query=urllib.parse.parse_qs(urllib.parse.urlparse(ref.get('profile_url','')).query)
    return query.get('jugador',[''])[0] or ref.get('rfaf_id','') or person_key(ref.get('name',''))

def merge_saved_players(data,old):
    """Keep the exact participant's portrait/stats when a partial refresh omits them."""
    saved={player_identity(p):p for p in (old or {}).get('players',[])}
    if not data.get('players'):
        data['players']=participant_refs(data,list(saved.values()))
    for ref in data.get('players',[]):
        previous=saved.get(player_identity(ref),{})
        if not ref.get('photo'):ref['photo']=previous.get('photo','')
        if not ref.get('stats') and previous.get('stats'):
            ref['stats']=previous['stats'];ref['profile_updated_at']=previous.get('profile_updated_at','')
    return data

def competition_summaries(reports,matches,scorers=()):
    """Count starts and goals only when every played acta of a team is available.

    A substitute's call-up does not prove that they played. Played totals come
    from the official player profile or scorers table, never from call-ups.
    """
    expected={};covered={};totals={}
    for match in matches:
        if not match.get('played'):continue
        query=urllib.parse.parse_qs(urllib.parse.urlparse(match.get('acta_url','')).query)
        acta=query.get('CodActa',[''])[0]
        for team in (match['home'],match['away']):expected.setdefault(team,set()).add(acta or match.get('id') or str(match.get('round')))
        data=reports.get(acta)
        if not data:continue
        teams=[match['home'],match['away']];section='';side='';lineups={team:[] for team in teams};goals=[]
        refs={person_key(p['name']):p for p in data.get('players',[])}
        for block in data.get('blocks',[]):
            if block.get('kind')!='table':
                text=clean(block.get('text',''))
                if text in teams:side=text;section=''
                elif text in ('Titulares','Suplentes','Goles','Tarjetas','Cuerpo Técnico','Árbitros'):section=text
                continue
            for row in block.get('rows',[]):
                cells=[clean(c) for c in row if clean(c)]
                if not cells:continue
                if side and section in ('Titulares','Suplentes'):
                    name=person_key(' '.join(cells[1:] if cells[0].isdigit() else cells))
                    if name in refs:lineups[side].append((name,section=='Titulares'))
                elif section=='Goles':
                    name=person_key(re.sub(r'^\([^)]*\)\s*','',cells[-1]))
                    if name in refs and 'propia' not in cells[0].lower():goals.append(name)
        # Missing participants must not turn incomplete imported data into totals.
        for team,people in lineups.items():
            if not people or not any(starter for _,starter in people):continue
            covered.setdefault(team,set()).add(acta)
            for name,starter in people:
                ref=refs[name];key=(player_identity(ref),team)
                value=totals.setdefault(key,{'goals':0,'starts':0,'called':0,'played':None,'team':team,'source':'actas oficiales RFAF'})
                value['starts']+=int(starter);value['called']+=1;value['goals']+=goals.count(name)
    complete={team for team,ids in expected.items() if ids==covered.get(team,set())}
    out={key:value for key,value in totals.items() if key[1] in complete}
    names={player_identity(p):person_key(p['name']) for data in reports.values() if data for p in data.get('players',[])}
    for (identity,team),value in out.items():
        scorer=next((s for s in scorers if s['team']==team and person_key(s['name'])==names.get(identity)),None)
        if scorer:
            value['played']=scorer.get('played')
            # The published scorers table remains authoritative if a goal is disputed.
            value['goals']=scorer.get('goals',value['goals'])
    return out


def profile_for_acta(ref,acta_id):
    try:
        p=urllib.parse.urlparse(ref.get('profile_url',''));q=urllib.parse.parse_qs(p.query)
        q['codacta']=[str(acta_id)];q['nueva_ventana']=['0']
        query=urllib.parse.urlencode({k:v[-1] for k,v in q.items() if v})
        url=urllib.parse.urlunparse(p._replace(query=query))
        out=dict(ref);out['profile_url']=url;out['id']=hashlib.sha256(url.encode()).hexdigest()[:16]
        return out
    except (ValueError,TypeError):return dict(ref)

def person_signature(name):
    text=normalize(clean(name))
    tokens=[t for t in re.findall(r'[A-Z0-9]+',text) if not t.isdigit() and t not in ('CAPITAN','CAPITÁN','PORTERO','JUGADOR')]
    return ' '.join(sorted(tokens))

def participant_refs(report_data,refs):
    known={person_key(r.get('name','')):r for r in refs if r.get('name')}
    by_signature={}
    for ref in refs:
        sig=person_signature(ref.get('name',''))
        if sig:by_signature.setdefault(sig,[]).append(ref)
    selected={}
    for block in report_data.get('blocks',[]):
        if block.get('kind')!='table':continue
        for row in block.get('rows',[]):
            for cell in row:
                text=clean(cell)
                text=re.sub(r'^\([^)]*\)\s*','',text)
                text=re.sub(r'^(?:Gol(?: en propia puerta| de penalti)?|Tarjeta amarilla|Tarjeta roja|Segunda amarilla)(?:\s*·\s*[^·]+)?\s*·?\s*','',text,flags=re.I)
                key=person_key(text)
                if key in known:selected[key]=known[key];continue
                sig=person_signature(text);matches=by_signature.get(sig,[])
                if len(matches)==1:selected[person_key(matches[0]['name'])]=matches[0]
    return list(selected.values())

def report(html):
    root=Document(html).root
    containers=[n for n in root.find('div','container') if any(h.text()=='Ficha de Partido' for h in n.find('h4'))]
    if not containers:raise ValueError('Acta no disponible en la fuente oficial')
    root=containers[-1];css=' '.join(n.text() for n in root.find('style'))
    blocks=[];pending=[];players={person_key(p['name']):p for p in player_refs_from_node(root,css)}
    def remember_people(n):
        for ref in player_refs_from_node(n,css):
            key=person_key(ref['name']);prior=players.get(key,{})
            if not ref['photo']:ref['photo']=prior.get('photo','')
            players[key]=ref
    def flush():
        text=clean(' '.join(pending));pending.clear()
        if text:blocks.append({'kind':'text','text':text})
    def cell(n):
        remember_people(n)
        text=clean(visible(n,css))
        labels=[]
        for img in n.find('img'):
            src=img.attrs.get('src','').lower()
            label='Tarjeta amarilla' if 'tarj_amar' in src else 'Tarjeta roja' if 'tarj_roja' in src else 'Segunda amarilla' if 'tarj_2' in src else img.attrs.get('alt','')
            if label:labels.append(label)
        for i in n.find('i'):
            if 'fa-futbol' in i.attrs.get('class',''):
                style=i.attrs.get('style','').lower()
                labels.append('Gol en propia puerta' if 'red' in style else 'Gol de penalti' if 'blue' in style or 'rgb(21,114,228)' in style.replace(' ','') else 'Gol')
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
    raw=raw_player_refs(html)
    for ref in raw:players.setdefault(person_key(ref['name']),ref)
    return {'blocks':blocks,'players':list(players.values())}

def sync_reports(matches,get,root):
    urls={urllib.parse.parse_qs(urllib.parse.urlparse(m['acta_url']).query)['CodActa'][0]:(m['acta_url'],m) for m in matches if m.get('played') and m.get('acta_url')}
    def prior_report(id):
        path=root/'data/actas'/(id+'.json')
        try:
            data=json.loads(path.read_text(encoding='utf-8'))
            return data if isinstance(data.get('blocks'),list) and len(data['blocks'])>=10 else None
        except (OSError,ValueError,AttributeError):return None
    def fetch_report(item):
        id,payload=item;url,match=payload;errors=[]
        candidates=['https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa='+id,url,
            'https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa='+id+'&cod_acta='+id,
            'https://www.rfaf.es/pnfg/NFG_CmpPartido?cod_primaria=1000120&CodActa='+id+'&cod_acta='+id]
        for candidate in dict.fromkeys(candidates):
            try:
                html=get(candidate);data=report(html);data.update(id=id,source=url,updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
                if not data.get('players'):
                    names=[]
                    for block in data.get('blocks',[]):
                        if block.get('kind')!='table':continue
                        for row in block.get('rows',[]):
                            for cell in row:
                                person=re.sub(r'^\\([^)]*\\)\\s*','',clean(cell))
                                if ',' in person and 5<=len(person)<=100 and person not in names:names.append(person)
                    samples=[]
                    low=html.lower()
                    for name in names[:8]:
                        surname=name.split(',')[0].strip()
                        pos=low.find(surname.lower())
                        if pos>=0:
                            samples.append(clean(html[max(0,pos-260):min(len(html),pos+len(surname)+420)]))
                        if len(samples)>=4:break
                    print(f'RFAF acta player markup {id}: '+json.dumps(samples,ensure_ascii=False),flush=True)
                return id,merge_saved_players(data,prior_report(id))
            except (ValueError,OSError,subprocess.SubprocessError,RuntimeError) as error:errors.append(str(error))
        old=prior_report(id)
        if old:
            team_refs=[]
            for team_url in dict.fromkeys([match.get('home_team_url',''),match.get('away_team_url','')]):
                if not team_url:continue
                parsed_team=urllib.parse.urlparse(team_url);leaf=parsed_team.path.rsplit('/',1)[-1] or 'NFG_VisEquipos'
                alt=urllib.parse.urlunparse(parsed_team._replace(path='/pnfg/NPcd/'+leaf))
                found=[];team_html=''
                for candidate_team in dict.fromkeys([team_url,alt]):
                    try:
                        html=get(candidate_team);refs=player_refs(html)
                        if not team_html:team_html=html
                        if refs:found=refs;team_html=html;break
                    except (ValueError,OSError,subprocess.SubprocessError,RuntimeError) as error:errors.append(str(error))
                team_refs.extend(found)
                if not found and team_html:
                    hints=[]
                    for hit in re.finditer(r'(?i)(jugador|estadisticas|ficha|licencia|persona|plantilla|equipo)',team_html):
                        snippet=clean(team_html[max(0,hit.start()-100):min(len(team_html),hit.end()+180)])
                        if snippet not in hints:hints.append(snippet)
                        if len(hints)>=8:break
                    hrefs=[]
                    for href in re.findall(r'''(?:href|src|url)\s*[=:]\s*["']([^"']+)''',team_html,re.I):
                        if href not in hrefs:hrefs.append(href)
                        if len(hrefs)>=30:break
                    plain=clean(re.sub(r'<[^>]+>',' ',team_html))[:1200]
                    print(f'RFAF team profile hints {team_url}: '+json.dumps({'hints':hints,'links':hrefs,'text':plain},ensure_ascii=False),flush=True)
            picked=participant_refs(old,team_refs)
            if picked:
                data=dict(old);data['players']=[profile_for_acta(ref,id) for ref in picked];data['players_source']='RFAF team rosters';data['players_updated_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
                print(f'Acta {id}: recuperados {len(picked)} perfiles desde plantillas RFAF',flush=True)
                return id,data
            previews=[
                'https://www.rfaf.es/pnfg/NPcd/NFG_CmpPrevio?cod_primaria=1000120&CodActa='+id,
                'https://www.rfaf.es/pnfg/NFG_CmpPrevio?cod_primaria=1000120&CodActa='+id]
            for preview in previews:
                try:
                    refs=player_refs(get(preview));picked=participant_refs(old,refs)
                    if picked:
                        data=dict(old);data['players']=[profile_for_acta(ref,id) for ref in picked];data['players_source']=preview;data['players_updated_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
                        print(f'Acta {id}: recuperados {len(picked)} perfiles desde datos previos',flush=True)
                        return id,data
                except (ValueError,OSError,subprocess.SubprocessError,RuntimeError) as error:errors.append(str(error))
            print(f'Acta {id}: se conserva copia guardada; perfiles pendientes',flush=True)
            return id,old
        print(f"Acta {id} pendiente: {errors[-1] if errors else 'fuente no disponible'}",flush=True);return id,None
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:reports=dict(pool.map(fetch_report,urls.items()))

    cache_path=root/PROFILE_CACHE
    try:cache=json.loads(cache_path.read_text(encoding='utf-8')).get('profiles',{})
    except (OSError,ValueError,AttributeError):cache={}
    refs={p['profile_url']:p for data in reports.values() if data for p in data.get('players',[]) if p.get('profile_url')}
    # One profile per player/competition instead of one request per historical acta.
    by_player={}
    for url,ref in sorted(refs.items(),key=lambda item:urllib.parse.parse_qs(urllib.parse.urlparse(item[0]).query).get('codacta',[''])[0]):
        by_player[player_identity(ref)]=(url,ref)
    now=datetime.datetime.now(datetime.timezone.utc);refresh=[]
    for identity,(url,ref) in by_player.items():
        known=next((p for u,p in cache.items() if player_identity({'profile_url':u})==identity and fresh_profile(p,now)),None)
        if known:cache[url]=known
        else:refresh.append((url,ref))
    def fetch_profile(item):
        url,ref=item
        candidates=[url]
        parsed=urllib.parse.urlparse(url)
        if '/NPcd/' in parsed.path:candidates.append(url.replace('/pnfg/NPcd/','/pnfg/',1))
        for candidate in dict.fromkeys(candidates):
            try:
                html=get(candidate)
                headings=[person_key(n.text()) for n in Document(html).root.find('h4') if ',' in n.text()]
                if headings and person_key(ref['name']) not in headings:raise ValueError('La fuente devolvió otro jugador')
                return url,player_profile(html,candidate,ref['name'])
            except (ValueError,OSError,subprocess.SubprocessError,RuntimeError):pass
        print(f"Perfil RFAF pendiente {ref['name']}",flush=True)
        return url,cache.get(url,{'name':ref['name'],'source':url,'photo_source':'','sections':[],'updated_at':''})
    if refresh:
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            for url,profile in pool.map(fetch_profile,refresh):cache[url]=profile
    profiles_by_player={identity:cache.get(url,{}) for identity,(url,ref) in by_player.items()}
    for url,ref in refs.items():
        known=profiles_by_player.get(player_identity(ref),{})
        if known.get('sections'):cache[url]=known
    cache_path.parent.mkdir(parents=True,exist_ok=True);cache_path.write_text(json.dumps({'updated_at':now.isoformat(),'profiles':cache},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    count=0;linked=0;photos=0
    try:scorers=json.loads((root/'data/fixtures.json').read_text()).get('scorers',[])
    except (OSError,ValueError):scorers=[]
    summaries=competition_summaries(reports,matches,scorers)
    for id,data in reports.items():
        if not data:continue
        for ref in data.get('players',[]):
            profile=cache.get(ref.get('profile_url',''),{})
            ref['photo']=ref.get('photo') or profile.get('photo_source','')
            if profile.get('sections'):
                ref['stats']=profile['sections'];ref['profile_updated_at']=profile.get('updated_at','')
            else:ref.setdefault('stats',[])
            candidates=[s for (identity,team),s in summaries.items() if identity==player_identity(ref)]
            if len(candidates)==1:ref['competition_summary']=candidates[0]
            linked+=1;photos+=bool(ref['photo'])
        raw=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
        for folder in ['data/actas','server/static/actas','android/app/src/main/assets/actas']:
            target=root/folder/(id+'.json');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(raw,encoding='utf-8')
        count+=1
    print(f'Updated {count} public match reports; {linked} player links; {photos} player photos',flush=True)
    return count

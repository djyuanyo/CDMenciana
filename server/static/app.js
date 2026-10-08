let user=null,items=[],page='Inicio',playerProfileLoading=false;
const main=document.querySelector('#main'),nav=document.querySelector('#nav');
const labels={news:'Noticia',match:'Partido',standings:'Clasificación',roster:'Plantilla',event:'Convocatoria / entrenamiento'};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function msg(text){const e=document.querySelector('#notice');e.textContent=text;e.style.display='block';setTimeout(()=>e.style.display='none',6000)}
async function api(path,data){const r=await fetch('/api/'+path,{credentials:'same-origin',headers:data?{'Content-Type':'application/json','X-CDM-Request':'1'}:{},method:data?'POST':'GET',body:data?JSON.stringify(data):undefined});const j=await r.json();if(!r.ok)throw Error(j.error||'No se pudo completar la solicitud.');return j}
async function refresh(){await Fixtures.load();await ClubAuth.init({legacy:api});await syncAccount();items=(await api('content')).items;await render()}
function field(name,label,type='text'){return `<label>${label}<input name="${name}" type="${type}" required ${type==='password'?'minlength="10" maxlength="128" autocomplete="current-password"':''}></label>`}
function content(rows){return rows.length?rows.map(i=>`<article class="card"><span class="badge">${esc(labels[i.kind])}</span><h2>${esc(i.title)}</h2><small>${esc(i.date)}</small><p class="body">${esc(i.body)}</p>${i.kind==='event'&&user?.active&&(user.player||user.admin)?`<div class="actions">${[['yes','Asistiré'],['no','No puedo'],['maybe','Por confirmar']].map(([v,l])=>`<button data-attend="${i.id}" data-answer="${v}" class="${i.answer===v?'chosen':''}">${l}</button>`).join('')}</div>`:''}${user?.active&&user.admin?`<button data-delete="${i.id}">Eliminar publicación</button>`:''}</article>`).join(''):'<p class="empty">Todavía no hay contenido publicado en este apartado.</p>'}
async function render(){
 const pages=['Acta','Jugador','Inicio','Partidos','Clasificación','Goleadores','Club','Más','Mi cuenta'];if(user?.active&&(user.member||user.admin))pages.push('Socios');if(user?.active&&(user.player||user.admin))pages.push('Jugadores');if(user?.active&&user.admin)pages.push('Administración');if(!pages.includes(page))page='Mi cuenta';
 CDM.shell(page,user);
 const route=routeState();
 if(page==='Acta')main.innerHTML=Fixtures.decorateReportPlayers(Fixtures.report(route?.acta||''),route?.acta||'');
 if(page==='Jugador')main.innerHTML=Fixtures.reportData?Fixtures.player(route?.player||'',route?.acta||'',route?.origin==='plantilla')+(playerProfileLoading?'<p class="player-profile-refresh" role="status">Actualizando estadísticas…</p>':''):'<section class="acta-panel acta-loading"><div class="acta-spinner"></div><strong>Cargando jugador</strong></section>';
 if(page==='Inicio')main.innerHTML=Fixtures.overview();
 if(page==='Más')main.innerHTML=CDM.menu(user);
 if(page==='Goleadores')main.innerHTML=Fixtures.scorers();
 if(page==='Partidos'){main.innerHTML=Fixtures.calendar();Fixtures.syncRoundTabs();}
 if(page==='Clasificación')main.innerHTML=Fixtures.standings();
 if(page==='Club')main.innerHTML=Fixtures.roster();
 if(page==='Socios')main.innerHTML=`<section class="card membercard"><small>CARNET DIGITAL · SOCIO</small><h3>${esc(user.name)}</h3><p>Número: ${esc(user.number||'Pendiente de asignar')}</p><span class="badge">Cuota: ${user.paid?'Pagada':'Pendiente'}</span></section>`+content(items.filter(i=>i.audience==='member'));
 if(page==='Jugadores')main.innerHTML='<h2>Zona del equipo</h2>'+content(items.filter(i=>i.audience==='player'));
 if(page==='Mi cuenta')main.innerHTML=ClubAuth.screen(user);
 if(page==='Administración'){
 const [a,b]=await Promise.all([api('admin/users'),api('admin/attendance')]);
 main.innerHTML='<h2>Administración del club</h2><section class="card"><h3>Publicar contenido</h3><form id="publish"><label>Tipo<select name="kind">'+Object.entries(labels).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')+'</select></label><label>Audiencia<select name="audience"><option value="public">Público</option><option value="member">Socios</option><option value="player">Jugadores</option></select></label>'+field('title','Título')+field('date','Fecha / jornada')+'<label>Texto<textarea name="body" required maxlength="10000"></textarea></label><button>Publicar</button></form></section><h3>Usuarios y permisos</h3>'+a.users.map(u=>`<section class="card"><h3>${esc(u.name)}</h3><p>${esc(u.email)}</p>${u.admin?'<span class="badge">Administrador</span>':`<form data-user="${u.id}">${['active','member','player','paid'].map((f,k)=>`<label><input type="checkbox" name="${f}" ${u[f]?'checked':''}>${['Cuenta aprobada / activa','Socio','Jugador','Cuota pagada'][k]}</label>`).join('')}<label>Número de socio<input name="number" value="${esc(u.number)}" maxlength="30"></label><button>Guardar permisos</button></form>`}</section>`).join('')+'<section class="card"><h3>Respuestas de asistencia</h3>'+ (b.attendance.map(r=>`<p>${esc(r.title)} · ${esc(r.name)} · ${esc({yes:'Asistirá',no:'No puede',maybe:'Por confirmar'}[r.answer])}</p>`).join('')||'<p>Sin respuestas todavía.</p>')+'</section>';
 }
}
document.addEventListener('click',async e=>{const el=e.target.closest('button');if(!el)return;try{if(el.dataset.page){if(routeState()){history.replaceState(null,'',location.pathname);reportRequest++;}page=el.dataset.page;await render();window.scrollTo(0,0)}if(el.hasAttribute('data-refresh-fixtures')){el.disabled=true;el.textContent='Actualizando…';await Fixtures.load(true);await render()}if(el.id==='logout'){await api('logout',{});page='Mi cuenta';await refresh()}if(el.dataset.attend){await api('attendance',{event_id:Number(el.dataset.attend),answer:el.dataset.answer});await refresh();msg('Asistencia guardada.')}if(el.dataset.delete&&await CDM.confirm('Eliminar publicación','Esta publicación dejará de aparecer en el club.','Eliminar')){await api('admin/delete',{id:Number(el.dataset.delete)});await refresh()}}catch(err){msg(err.message)}});
document.addEventListener('submit',async e=>{if(e.target.matches('[data-auth-form]'))return;e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f));const button=f.querySelector('button');button.disabled=true;try{let r;if(f.dataset.user){for(const k of ['active','member','player','paid'])d[k]=f.elements[k].checked?1:0;d.id=Number(f.dataset.user);r=await api('admin/user',d)}else r=await api(({login:'login',register:'register',publish:'admin/content'})[f.id],d);if(f.id==='register')f.reset();await refresh();msg(r.message||'Sesión iniciada.')}catch(err){msg(err.message)}finally{button.disabled=false}});
refresh().then(()=>routeState()?reportRoute():null).catch(e=>msg(e.message));

document.addEventListener('click',async e=>{const tab=e.target.closest('.round-tabs [data-round]');if(tab){Fixtures.round=tab.dataset.round;Fixtures.manualRound=true;await render();Fixtures.syncRoundTabs(true)}});

function routeState(){
 const params=new URLSearchParams(location.hash.slice(1)),team=params.get('equipo'),acta=params.get('acta'),player=params.get('jugador');
 if(team&&!Fixtures.teams[team])return null;
 if(player&&/^[a-f0-9]{8,64}$/i.test(player)&&/^\d+$/.test(acta||''))return {kind:'player',player,acta,team:team||Fixtures.selectedTeam,origin:params.get('origen')==='plantilla'?'plantilla':''};
 return /^\d+$/.test(acta||'')?{kind:'acta',acta,team:team||Fixtures.selectedTeam}:null;
}
let reportRequest=0;
async function reportRoute(refresh=false){
 const route=routeState(),request=++reportRequest;
 if(!route){playerProfileLoading=false;if(page==='Acta'||page==='Jugador'){page='Partidos';render();}return;}
 if(route.team!==Fixtures.selectedTeam){Fixtures.selectTeam(route.team);await Fixtures.loadFixtures();if(request!==reportRequest)return;}
 const id=route.acta,need=refresh||String(Fixtures.reportData?.id||'')!==id;
 page=route.kind==='player'?'Jugador':'Acta';
 if(need){Fixtures.reportData=null;Fixtures.reportError=false;render();window.scrollTo(0,0);await Fixtures.loadReport(id,refresh);}
 if(request===reportRequest){
  const current=routeState();
  if(current&&current.acta===id){
   if(current.kind==='player'){
    page='Jugador';playerProfileLoading=true;render();window.scrollTo(0,0);
    const player=current.origin==='plantilla'?Fixtures.prepareRosterPlayer(current.player,id):(Fixtures.reportData?.players||[]).find(p=>String(p.id)===String(current.player));
    if(player)await Fixtures.loadPlayerProfile(player,id);
    if(request===reportRequest&&routeState()?.player===current.player){playerProfileLoading=false;render();}
   }else{
    page='Acta';render();
    const changed=await Fixtures.enrichReportPlayers(id);
    if(changed&&request===reportRequest&&routeState()?.kind==='acta')render();
   }
  }
 }
}
window.addEventListener('hashchange',()=>reportRoute());
document.addEventListener('click',e=>{
 if(e.target.closest('[data-report-back]')){if(routeState()){history.replaceState(null,'',location.pathname);reportRequest++;page='Partidos';render();window.scrollTo(0,0);}else{page='Partidos';render();}}
 if(e.target.closest('[data-report-retry]'))reportRoute(true);
 if(e.target.closest('[data-player-retry]')){const route=routeState(),p=(Fixtures.reportData?.players||[]).find(p=>String(p.id)===route?.player);if(p){p._profileLoaded=false;p._refreshRequested=true;}reportRoute();}
 const playerBack=e.target.closest('[data-player-back]');if(playerBack){if(playerBack.hasAttribute('data-roster-back')){history.replaceState(null,'',location.pathname);reportRequest++;playerProfileLoading=false;page='Club';render();window.scrollTo(0,0);}else{const id=playerBack.dataset.acta;if(/^\d+$/.test(id)){history.replaceState(null,'',Fixtures.actaHref(id));reportRoute();}}}
});
if(routeState())reportRoute();

document.addEventListener('click',e=>{const b=e.target.closest('[data-report-side]');if(b){Fixtures.reportSide=Number(b.dataset.reportSide);render();}});

document.addEventListener('click',async e=>{const button=e.target.closest('[data-team]');if(!button||!Fixtures.selectTeam(button.dataset.team))return;const team=Fixtures.selectedTeam;reportRequest++;playerProfileLoading=false;if(routeState()){history.replaceState(null,'',location.pathname);page='Partidos';}render();await Fixtures.loadFixtures();if(team===Fixtures.selectedTeam){render();window.scrollTo(0,0);}});

let accountSync=0;
async function syncAccount(){
 const request=++accountSync;
 if(!ClubAuth.native()){const result=await api('me');if(request===accountSync)user=result.user;return;}
 let current=null;
 try{
  if(ClubAuth.user?.emailVerified){const credentials=await ClubAuth.request('token');if(request!==accountSync)return;current=(await api('firebase',{token:credentials.token})).user;}
  else {await api('logout',{});}
 }catch(e){await api('logout',{});if(page==='Mi cuenta')ClubAuth.showFeedback(e.message,true);}
 if(request===accountSync)user=current;
}
for(const event of ['club-auth-state','club-auth-legacy'])window.addEventListener(event,async()=>{
 if(!ClubAuth.ready)return;await syncAccount();items=(await api('content')).items;await render();
});
window.addEventListener('club-auth-view',()=>{if(page==='Mi cuenta')render();});

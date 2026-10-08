const main=document.getElementById('main');
let page='Mi cuenta',playerProfileLoading=false;
function routeState(){
 const params=new URLSearchParams(location.hash.slice(1)),team=params.get('equipo'),acta=params.get('acta'),player=params.get('jugador');
 if(team&&!Fixtures.teams[team])return null;
 if(player&&/^[a-f0-9]{8,64}$/i.test(player)&&/^\d+$/.test(acta||''))return {kind:'player',player,acta,team:team||Fixtures.selectedTeam,origin:params.get('origen')==='plantilla'?'plantilla':''};
 return /^\d+$/.test(acta||'')?{kind:'acta',acta,team:team||Fixtures.selectedTeam}:null;
}
function render(){
 const user=window.ClubAccess?.user();
 const gate=!ClubAuth.user||ClubAccess.fetching||(!ClubAccess.administrator()&&!ClubRegistration.complete(ClubAccess.profile));
 if(gate)page='Mi cuenta';
 document.documentElement.dataset.accountGate=String(gate);
 if(page==='Administración'&&!user?.admin)page='Mi cuenta';
 CDM.shell(page,user);
 let body='';
 const route=routeState();
 if(page==='Inicio')body=Fixtures.overview();
 if(page==='Noticia')body=ClubNews.screen();
 if(page==='Favoritos')body=ClubFavorites.screen();
 if(page==='Administración')body=ClubAccess.screen();
 if(page==='Partidos')body=Fixtures.calendar();
 if(page==='Acta')body=Fixtures.decorateReportPlayers(Fixtures.report(route?.acta||''),route?.acta||'');
 if(page==='Jugador')body=Fixtures.reportData?Fixtures.player(route?.player||'',route?.acta||'',route?.origin==='plantilla')+(playerProfileLoading?'<p class="player-profile-refresh" role="status">Actualizando estadísticas…</p>':''):'<section class="acta-panel acta-loading"><div class="acta-spinner"></div><strong>Cargando jugador</strong></section>';
 if(page==='Club')body=Fixtures.roster();
 if(page==='Goleadores')body=Fixtures.scorers();
 if(page==='Clasificación')body=Fixtures.standings();
 if(page==='Más')body=CDM.menu(user);
 if(page==='Mi cuenta')body=window.ClubAuth?ClubAuth.screen(user):CDM.empty('Mi cuenta','Accede al club desde tu cuenta.','user');
 if(page==='Socios')body=user?.active&&(user.member||user.admin)?`<div class="section-heading"><h2>Zona de socios</h2></div><section class="card membercard"><small>CD MENCIANA · SOCIO</small><h3>${ClubAuth.escape(user.name||user.email)}</h3><span class="badge">ACCESO DE SOCIO ACTIVO</span><p>Ya formas parte de los socios del club.</p></section>`:CDM.empty('Zona de socios','El administrador activa este acceso en tu cuenta.','lock');
 if(page==='Jugadores')body=user?.active&&(user.player||user.admin)?CDM.empty('Zona de jugadores','Tu acceso de jugador está activo. Las novedades del equipo aparecerán aquí.','team'):CDM.empty('Zona de jugadores','El administrador activa este acceso en tu cuenta.','lock');
 main.innerHTML=body;
 if(page==='Partidos')Fixtures.syncRoundTabs();
}
document.addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b){page=b.dataset.page;if(routeState()||ClubNews.route()){history.replaceState(null,'',location.pathname);reportRequest++;}render();if(page==='Favoritos'){ClubFavorites.sync();ClubFavorites.loadCatalog();}else if(page==='Administración')loadClubUsers();else if(ClubAccess.enabled()&&['Mi cuenta','Socios','Jugadores'].includes(page))ClubAccess.sync();window.scrollTo(0,0)}});
document.addEventListener('click',async e=>{if(e.target.closest('[data-refresh-fixtures]')){const b=e.target.closest('button');b.disabled=true;b.textContent='Actualizando…';await Fixtures.load(true);render();}});
document.addEventListener('click',e=>{const tab=e.target.closest('.round-tabs [data-round]');if(tab){Fixtures.round=tab.dataset.round;Fixtures.manualRound=true;render();Fixtures.syncRoundTabs(true);}});
render();Fixtures.load().then(()=>routeState()?reportRoute():render());

let reportRequest=0;
async function reportRoute(refresh=false){
 const route=routeState(),request=++reportRequest;
 if(!route){playerProfileLoading=false;if(page==='Noticia'){page='Inicio';render();}if(page==='Acta'||page==='Jugador'){page='Partidos';render();}return;}
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
window.addEventListener('hashchange',()=>ClubNews.route()?newsRoute():reportRoute());
document.addEventListener('click',e=>{
 if(e.target.closest('[data-report-back]')){if(routeState()||ClubNews.route()){history.replaceState(null,'',location.pathname);reportRequest++;page='Partidos';render();window.scrollTo(0,0);}else{page='Partidos';render();}}
 if(e.target.closest('[data-report-retry]'))reportRoute(true);
 if(e.target.closest('[data-player-retry]')){const route=routeState(),p=(Fixtures.reportData?.players||[]).find(p=>String(p.id)===route?.player);if(p){p._profileLoaded=false;p._refreshRequested=true;}reportRoute();}
 const playerBack=e.target.closest('[data-player-back]');if(playerBack){if(playerBack.hasAttribute('data-roster-back')){history.replaceState(null,'',location.pathname);reportRequest++;playerProfileLoading=false;page='Club';render();window.scrollTo(0,0);}else{const id=playerBack.dataset.acta;if(/^\d+$/.test(id)){history.replaceState(null,'',Fixtures.actaHref(id));reportRoute();}}}
});
if(routeState())reportRoute();

document.addEventListener('click',e=>{const b=e.target.closest('[data-report-side]');if(b){Fixtures.reportSide=Number(b.dataset.reportSide);render();}});

document.addEventListener('click',async e=>{const button=e.target.closest('[data-team]');if(!button||!Fixtures.selectTeam(button.dataset.team))return;const team=Fixtures.selectedTeam;reportRequest++;playerProfileLoading=false;if(routeState()||ClubNews.route()){history.replaceState(null,'',location.pathname);page='Partidos';}render();await Fixtures.loadFixtures();if(team===Fixtures.selectedTeam){render();window.scrollTo(0,0);}});

function newsRoute(){page='Noticia';render();window.scrollTo(0,0);}
if(ClubNews.route())newsRoute();
window.addEventListener('club-auth-state',()=>{if(!ClubAuth.user)page='Mi cuenta';ClubAccess.sync();render();});
window.addEventListener('club-registration-complete',()=>{page='Inicio';render();});
window.addEventListener('club-access-state',()=>{render();if(page==='Administración')loadClubUsers();});
window.addEventListener('club-auth-view',()=>{if(page==='Mi cuenta')render();});
window.ClubAuth?.init().then(async()=>{await ClubAccess.sync();if(ClubRegistration.complete(ClubAccess.profile)||ClubAccess.administrator()){if(ClubNews.route()){newsRoute();return;}if(routeState()){reportRoute();return;}if(page==='Mi cuenta')page='Inicio';}render();});
async function loadClubUsers(){
 if(!ClubAccess.administrator()||ClubAccess.loading)return;
 const identity=ClubAuth.user.uid;ClubAccess.loading=true;ClubAccess.error='';render();
 try{await ClubAccess.list();}catch(error){if(ClubAuth.user?.uid===identity)ClubAccess.error=error.message;}
 finally{ClubAccess.loading=false;if(page==='Administración')render();}
}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-news-back]')){history.replaceState(null,'',location.pathname);page='Inicio';render();window.scrollTo(0,0);}
 if(event.target.closest('[data-reload-users]'))loadClubUsers();
});
document.addEventListener('input',event=>{if(event.target.matches('[data-user-search]'))document.getElementById('club-users').innerHTML=ClubAccess.rows(event.target.value);});
document.addEventListener('submit',async event=>{
 const form=event.target;if(!form.matches('[data-club-role]'))return;event.preventDefault();
 const button=form.querySelector('button'),feedback=form.querySelector('.role-feedback');button.disabled=true;feedback.textContent='Guardando…';
 try{await ClubAccess.setRole(form.dataset.clubRole,new FormData(form).get('role'));feedback.textContent='Rol guardado.';}
 catch(error){feedback.textContent=error.message;}
 finally{button.disabled=false;}
});

window.addEventListener('club-favorites-state',()=>render());

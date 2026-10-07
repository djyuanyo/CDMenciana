const main=document.getElementById('main');
let page='Inicio',playerProfileLoading=false;
function routeState(){
 const params=new URLSearchParams(location.hash.slice(1)),team=params.get('equipo'),acta=params.get('acta'),player=params.get('jugador');
 if(team&&!Fixtures.teams[team])return null;
 if(player&&/^[a-f0-9]{8,64}$/i.test(player)&&/^\d+$/.test(acta||''))return {kind:'player',player,acta,team:team||Fixtures.selectedTeam,origin:params.get('origen')==='plantilla'?'plantilla':''};
 return /^\d+$/.test(acta||'')?{kind:'acta',acta,team:team||Fixtures.selectedTeam}:null;
}
function render(){
 CDM.shell(page,window.ClubAuth?.user||null);
 let body='';
 const route=routeState();
 if(page==='Inicio')body=Fixtures.overview();
 if(page==='Partidos')body=Fixtures.calendar();
 if(page==='Acta')body=Fixtures.decorateReportPlayers(Fixtures.report(route?.acta||''),route?.acta||'');
 if(page==='Jugador')body=Fixtures.reportData?Fixtures.player(route?.player||'',route?.acta||'',route?.origin==='plantilla')+(playerProfileLoading?'<p class="player-profile-refresh" role="status">Actualizando estadísticas…</p>':''):'<section class="acta-panel acta-loading"><div class="acta-spinner"></div><strong>Cargando jugador</strong></section>';
 if(page==='Club')body=Fixtures.roster();
 if(page==='Goleadores')body=Fixtures.scorers();
 if(page==='Clasificación')body=Fixtures.standings();
 if(page==='Más')body=CDM.menu(window.ClubAuth?.user||null);
 if(page==='Mi cuenta')body=window.ClubAuth?ClubAuth.screen():CDM.empty('Mi cuenta','Accede al club desde tu cuenta.','user');
 if(page==='Socios')body='<div class="section-heading"><h2>Zona de socios</h2></div><section class="card membercard"><small>CD MENCIANA · CARNET DIGITAL</small><h3>Parte de nuestro club</h3><p>Tu carnet, número de socio y estado de cuota se mostrarán aquí al iniciar sesión.</p><span class="badge">ACCESO DE SOCIOS</span></section>'+CDM.empty('Todo lo que te une al club','Avisos exclusivos y novedades para socios. El club activará este acceso cuando apruebe tu cuenta de socio.','lock');
 if(page==='Jugadores')body='<div class="section-heading"><h2>Zona de jugadores</h2></div>'+CDM.empty('Nos vemos en la pista','Consulta convocatorias y entrenamientos y confirma tu asistencia. El club activará este acceso cuando apruebe tu cuenta de jugador.','team');
 main.innerHTML=body;
 if(page==='Partidos')Fixtures.syncRoundTabs();
}
document.addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b){page=b.dataset.page;if(routeState()){history.replaceState(null,'',location.pathname);reportRequest++;}render();window.scrollTo(0,0)}});
document.addEventListener('click',async e=>{if(e.target.closest('[data-refresh-fixtures]')){const b=e.target.closest('button');b.disabled=true;b.textContent='Actualizando…';await Fixtures.load(true);render();}});
document.addEventListener('click',e=>{const tab=e.target.closest('.round-tabs [data-round]');if(tab){Fixtures.round=tab.dataset.round;Fixtures.manualRound=true;render();Fixtures.syncRoundTabs(true);}});
render();Fixtures.load().then(()=>routeState()?reportRoute():render());

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

for(const event of ['club-auth-state','club-auth-view'])window.addEventListener(event,()=>{if(page==='Mi cuenta'||page==='Más')render();});
window.ClubAuth?.init();

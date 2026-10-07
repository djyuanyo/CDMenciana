const main=document.getElementById('main');
let page='Inicio',playerProfileLoading=false;
function routeState(){
 const player=location.hash.match(/^#jugador=([a-f0-9]{8,64})&acta=(\d+)$/i);if(player)return {kind:'player',player:player[1],acta:player[2]};
 const acta=location.hash.match(/^#acta=(\d+)$/);return acta?{kind:'acta',acta:acta[1]}:null;
}
function render(){
 CDM.shell(page,null);
 let body='';
 const route=routeState();
 if(page==='Inicio')body=Fixtures.news();
 if(page==='Partidos')body=Fixtures.calendar();
 if(page==='Acta')body=Fixtures.decorateReportPlayers(Fixtures.report(route?.acta||''),route?.acta||'');
 if(page==='Jugador')body=playerProfileLoading?'<section class="acta-panel acta-loading"><div class="acta-spinner"></div><strong>Cargando estadísticas</strong><p>Consultando la ficha del jugador en RFAF…</p></section>':(Fixtures.reportData?Fixtures.player(route?.player||'',route?.acta||''):'<section class="acta-panel acta-loading"><div class="acta-spinner"></div><strong>Cargando jugador</strong><p>Consultando su perfil público de RFAF…</p></section>');
 if(page==='Club')body=Fixtures.roster();
 if(page==='Goleadores')body=Fixtures.scorers();
 if(page==='Clasificación')body=Fixtures.standings();
 if(page==='Más')body=CDM.menu(null);
 if(page==='Mi cuenta')body='<div class="section-heading"><h2>Mi cuenta</h2></div>'+CDM.empty('Tu sitio en el club','El acceso con correo y contraseña estará disponible cuando conectemos el servicio de cuentas.','user')+'<section class="card"><h2>Socios y jugadores</h2><p>Una cuenta, tus accesos. El club asignará el perfil de socio, jugador o ambos tras aprobar tu registro.</p></section>';
 if(page==='Socios')body='<div class="section-heading"><h2>Zona de socios</h2></div><section class="card membercard"><small>CD MENCIANA · CARNET DIGITAL</small><h3>Parte de nuestro club</h3><p>Tu carnet, número de socio y estado de cuota se mostrarán aquí al iniciar sesión.</p><span class="badge">ACCESO DE SOCIOS</span></section>'+CDM.empty('Todo lo que te une al club','Avisos exclusivos y novedades para socios. El servicio de cuentas todavía está pendiente de conexión.','lock');
 if(page==='Jugadores')body='<div class="section-heading"><h2>Zona de jugadores</h2></div>'+CDM.empty('Nos vemos en la pista','Consulta convocatorias y entrenamientos y confirma tu asistencia. El servicio de cuentas todavía está pendiente de conexión.','team');
 main.innerHTML=body;
}
document.addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b){page=b.dataset.page;if(routeState()){history.replaceState(null,'',location.pathname);reportRequest++;}render();window.scrollTo(0,0)}});
document.addEventListener('click',async e=>{if(e.target.closest('[data-refresh-fixtures]')){const b=e.target.closest('button');b.disabled=true;b.textContent='Actualizando…';await Fixtures.load(true);render();}});
document.addEventListener('change',e=>{if(e.target.id==='round-filter'){Fixtures.round=e.target.value;Fixtures.manualRound=true;render();}});
render();Fixtures.load().then(()=>routeState()?reportRoute():render());

let reportRequest=0;
async function reportRoute(refresh=false){
 const route=routeState(),request=++reportRequest;
 if(!route){playerProfileLoading=false;if(page==='Acta'||page==='Jugador'){page='Partidos';render();}return;}
 const id=route.acta,need=refresh||String(Fixtures.reportData?.id||'')!==id;
 page=route.kind==='player'?'Jugador':'Acta';
 if(need){Fixtures.reportData=null;Fixtures.reportError=false;render();window.scrollTo(0,0);await Fixtures.loadReport(id,refresh);}
 if(request===reportRequest){
  const current=routeState();
  if(current&&current.acta===id){
   if(current.kind==='player'){
    page='Jugador';playerProfileLoading=true;render();
    const player=(Fixtures.reportData?.players||[]).find(p=>String(p.id)===String(current.player));
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
 if(e.target.closest('[data-report-back]')){if(location.hash.startsWith('#acta='))history.back();else{page='Partidos';render();}}
 if(e.target.closest('[data-report-retry]'))reportRoute(true);
 const playerBack=e.target.closest('[data-player-back]');if(playerBack){const id=playerBack.dataset.acta;if(/^\d+$/.test(id)){history.replaceState(null,'','#acta='+id);reportRoute();}}
});
if(routeState())reportRoute();

document.addEventListener('click',e=>{const b=e.target.closest('[data-report-side]');if(b){Fixtures.reportSide=Number(b.dataset.reportSide);render();}});

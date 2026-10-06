const main=document.getElementById('main');
let page='Inicio';
function render(){
 CDM.shell(page,null);
 let body='';
 if(page==='Inicio')body=Fixtures.news();
 if(page==='Partidos')body=Fixtures.calendar();
 if(page==='Acta')body=Fixtures.report(location.hash.slice(6));
 if(page==='Club')body=Fixtures.roster();
 if(page==='Goleadores')body=Fixtures.scorers();
 if(page==='Clasificación')body=Fixtures.standings();
 if(page==='Más')body=CDM.menu(null);
 if(page==='Mi cuenta')body='<div class="section-heading"><h2>Mi cuenta</h2></div>'+CDM.empty('Tu sitio en el club','El acceso con correo y contraseña estará disponible cuando conectemos el servicio de cuentas.','user')+'<section class="card"><h2>Socios y jugadores</h2><p>Una cuenta, tus accesos. El club asignará el perfil de socio, jugador o ambos tras aprobar tu registro.</p></section>';
 if(page==='Socios')body='<div class="section-heading"><h2>Zona de socios</h2></div><section class="card membercard"><small>CD MENCIANA · CARNET DIGITAL</small><h3>Parte de nuestro club</h3><p>Tu carnet, número de socio y estado de cuota se mostrarán aquí al iniciar sesión.</p><span class="badge">ACCESO DE SOCIOS</span></section>'+CDM.empty('Todo lo que te une al club','Avisos exclusivos y novedades para socios. El servicio de cuentas todavía está pendiente de conexión.','lock');
 if(page==='Jugadores')body='<div class="section-heading"><h2>Zona de jugadores</h2></div>'+CDM.empty('Nos vemos en la pista','Consulta convocatorias y entrenamientos y confirma tu asistencia. El servicio de cuentas todavía está pendiente de conexión.','team');
 main.innerHTML=body;
}
document.addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b){page=b.dataset.page;render();window.scrollTo(0,0)}});
document.addEventListener('click',async e=>{if(e.target.closest('[data-refresh-fixtures]')){const b=e.target.closest('button');b.disabled=true;b.textContent='Actualizando…';await Fixtures.load(true);render();}});
document.addEventListener('change',e=>{if(e.target.id==='round-filter'){Fixtures.round=e.target.value;Fixtures.manualRound=true;render();}});
render();Fixtures.load().then(render);

let reportRequest=0;
async function reportRoute(){const id=location.hash.match(/^#acta=(\d+)$/)?.[1];const request=++reportRequest;if(!id){if(page==='Acta'){page='Partidos';render();}return;}page='Acta';Fixtures.reportData=null;Fixtures.reportError=false;render();window.scrollTo(0,0);await Fixtures.loadReport(id);if(request===reportRequest&&location.hash==='#acta='+id)render();}
window.addEventListener('hashchange',reportRoute);
document.addEventListener('click',e=>{if(e.target.closest('[data-report-back]')){if(location.hash.startsWith('#acta='))history.back();else{page='Partidos';render();}}if(e.target.closest('[data-report-retry]'))reportRoute();if(e.target.closest('button[data-page]')&&location.hash.startsWith('#acta=')){history.replaceState(null,'',location.pathname);reportRequest++;}});
if(location.hash.startsWith('#acta='))reportRoute();

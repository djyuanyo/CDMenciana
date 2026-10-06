const main=document.getElementById('main');
let page='Inicio';
function render(){
 CDM.shell(page,null);
 let body='';
 if(page==='Inicio')body=Fixtures.home()+CDM.accessTiles()+'<div class="section-heading"><h2>Actualidad del club</h2></div>'+CDM.empty('La próxima historia empieza aquí','Las noticias del equipo se publicarán en este espacio.','ball');
 if(page==='Partidos')body=Fixtures.calendar();
 if(page==='Club')body='<div class="section-heading"><h2>Plantilla</h2><span>CD MENCIANA</span></div>'+CDM.empty('Nuestro equipo','Próximamente: fotografías, dorsales y posiciones de los jugadores.','team');
 if(page==='Estadísticas')body='<div class="section-heading"><h2>Estadísticas del equipo</h2></div>'+CDM.empty('Cada partido cuenta','Las estadísticas aparecerán cuando se incorporen los resultados oficiales.','chart');
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

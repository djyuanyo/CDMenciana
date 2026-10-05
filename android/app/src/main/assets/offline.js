const nav=document.getElementById('nav'),main=document.getElementById('main');
const pages=['Inicio','Partidos','Clasificación','Club','Zona privada'];
function render(page){nav.innerHTML=pages.map(p=>`<button data-page="${p}" class="${p===page?'selected':''}">${p}</button>`).join('');
let body='';
if(page==='Inicio')body='<section class="card hero"><small>JUNTOS EN LA PISTA</small><h2>Tu club. Tu afición.</h2><p>CD Menciana Apaga y Vámonos</p></section><section class="card"><h2>Bienvenido al club</h2><p>Esta primera versión permite conocer el diseño de la app sin conexión. Los partidos, noticias y cuentas se incorporarán al conectar los servicios del club.</p></section>';
if(page==='Partidos')body='<section class="card"><h2>Calendario y resultados</h2><p>No hay partidos cargados todavía.</p><a href="https://stars.rfaf.es/?delegacion=9&competicion=48466108&grupo=48466109&widget_view=results">Consultar resultados oficiales en la RFAF</a></section>';
if(page==='Clasificación')body='<section class="card"><h2>Clasificación</h2><p>La clasificación oficial todavía no está sincronizada.</p></section>';
if(page==='Club')body='<section class="card"><h2>CD Menciana Apaga y Vámonos</h2><p>Club de fútbol sala · Doña Mencía</p><p>La plantilla y el resto de información se publicarán próximamente.</p></section>';
if(page==='Zona privada')body='<section class="card"><h2>Socios y jugadores</h2><p>Próximamente: carnet digital, cuotas, avisos exclusivos, convocatorias y asistencia.</p><p>Para registrarte e iniciar sesión necesitamos conectar un servicio seguro de cuentas. Esta vista no recoge contraseñas ni concede acceso privado.</p></section>';
main.innerHTML=body;}
nav.addEventListener('click',e=>{const b=e.target.closest('button');if(b)render(b.dataset.page)});render('Inicio');

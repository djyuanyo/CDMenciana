/* All club categories share the same public snapshots as their calendars. */
window.ClubMatchdays={
 snapshots:{},failures:new Set(),request:0,
 async load(refresh=false){
  const request=++this.request;
  await Promise.all(Object.entries(Fixtures.teams).map(async([key,team])=>{
   try{const response=await fetch(team.filename+(refresh?'?refresh=1':''),{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data.matches)||data.team_key&&data.team_key!==key)throw Error();if(request===this.request){this.snapshots[key]=data;this.failures.delete(key);}}
   catch{if(request===this.request)this.failures.add(key);}
  }));
 },
 round(data,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
  const all=data.matches||[],pending=all.filter(m=>!m.played&&m.date>=today).sort((a,b)=>Fixtures.kickoffOrder(a,b));
  if(pending.length)return String(pending[0].round);
  const upcoming=all.filter(m=>!m.played).sort((a,b)=>Number(a.round)-Number(b.round));
  if(upcoming.length)return String(upcoming[0].round);
  return String(Math.max(0,...all.map(m=>Number(m.round)||0)));
 },
 card(m,key){
  const E=Fixtures.esc.bind(Fixtures);let acta='';
  try{const u=new URL(m.acta_url);const id=u.searchParams.get('CodActa');if(u.protocol==='https:'&&['www.rfaf.es','rfaf.es'].includes(u.hostname)&&/^\d{1,12}$/.test(id||''))acta='#acta='+id+'&equipo='+key;}catch{}
  const team=(name,image)=>`<div class="matchday-team"><img src="${E(Fixtures.crest(name,image))}" alt="" loading="lazy"><span>${E(name)}</span></div>`;
  return `<article class="matchday-card"><div class="matchday-category-label">${E(Fixtures.teams[key].label)} · Jornada ${E(m.round)}</div><time>${E(Fixtures.date(m))}</time><div class="matchday-scoreboard">${team(m.home,m.home_crest)}<div class="matchday-result"><strong>${m.played?E(m.home_score)+' <span>–</span> '+E(m.away_score):E(m.time||'Por confirmar')}</strong><small class="${m.played?'finished':''}">${m.played?'FINALIZADO':'SIN COMENZAR'}</small></div>${team(m.away,m.away_crest)}</div>${acta?`<a class="matchday-link" href="${E(acta)}">Ver acta ${CDM.icon('arrow')}</a>`:`<button class="matchday-link" data-home-category="${E(key)}">Ver jornada ${CDM.icon('arrow')}</button>`}</article>`;
 },
 screen(){
  const E=Fixtures.esc.bind(Fixtures);
  const cards=Object.entries(Fixtures.teams).map(([key,team])=>{
   const data=this.snapshots[key]||(key===Fixtures.selectedTeam?Fixtures.data:null);
   const round=data?this.round(data):null;
   const match=data?(data.matches||[]).filter(m=>String(m.round)===round).sort((a,b)=>Fixtures.kickoffOrder(a,b))[0]:null;
   if(match)return this.card(match,key);
   return `<article class="matchday-card matchday-placeholder"><div class="matchday-category-label">${E(team.label)}</div><p>${this.failures.has(key)?'No se pudo actualizar. Desliza hacia abajo para reintentar.':data?'Partido pendiente de publicación.':'Cargando el partido…'}</p><button class="matchday-link" data-home-category="${E(key)}">Ver calendario ${CDM.icon('arrow')}</button></article>`;
  }).join('');
  return `<section class="home-matchdays" aria-label="Partidos de nuestros equipos"><div class="section-heading"><h2>La jornada del club</h2><span>DESLIZA PARA VER TODOS</span></div><div class="matchday-carousel" tabindex="0" role="region" aria-label="Partidos del Primer Equipo, Filial, Infantil y demás categorías del club">${cards}</div></section>`;
 }
};
const loadClubFixtures=Fixtures.load.bind(Fixtures);
Fixtures.load=async function(refresh=false){await loadClubFixtures(refresh);await ClubMatchdays.load(refresh);};
Fixtures.overview=function(){return ClubMatchdays.screen()+this.status()+this.news();};

/* Downward touch gestures start at the top; horizontal carousels keep native scrolling. */
window.ClubRefresh={
 busy:false,start:null,distance:0,indicator:null,
 show(text){if(!this.indicator){this.indicator=document.createElement('div');this.indicator.className='pull-refresh';this.indicator.setAttribute('role','status');this.indicator.setAttribute('aria-live','polite');document.body.append(this.indicator);}this.indicator.textContent=text;this.indicator.hidden=false;},
 hide(){if(this.indicator)this.indicator.hidden=true;},
 async run(){if(this.busy)return;this.busy=true;this.show('Actualizando…');try{await window.refreshScreen();this.show('Pantalla actualizada');}catch{this.show('No se pudo actualizar. Comprueba tu conexión.');}finally{this.busy=false;setTimeout(()=>this.hide(),1800);}}
};
document.addEventListener('touchstart',event=>{
 const r=ClubRefresh;r.start=null;r.distance=0;
 if(r.busy||event.touches.length!==1||window.scrollY>0||event.target.closest('input,textarea,select,button,a,[role="dialog"],.matchday-carousel,.round-tabs,.team-selector,.team-tabs'))return;
 for(let p=event.target;p&&p!==document.body;p=p.parentElement)if(p.scrollTop>0)return;
 const touch=event.touches[0];r.start={x:touch.clientX,y:touch.clientY};
},{passive:true});
document.addEventListener('touchmove',event=>{
 const r=ClubRefresh;if(!r.start||event.touches.length!==1)return;
 const touch=event.touches[0],dx=Math.abs(touch.clientX-r.start.x),dy=touch.clientY-r.start.y;
 if(dx>12&&dx>Math.abs(dy)){r.start=null;r.hide();return;}
 if(dy<=0||window.scrollY>0)return;
 r.distance=dy;if(dy>20){if(event.cancelable)event.preventDefault();r.show(dy>=85?'Suelta para actualizar':'Desliza para actualizar');}
},{passive:false});
document.addEventListener('touchend',()=>{const r=ClubRefresh,ready=r.start&&r.distance>=85;r.start=null;r.distance=0;if(ready)r.run();else if(!r.busy)r.hide();},{passive:true});
document.addEventListener('touchcancel',()=>{ClubRefresh.start=null;ClubRefresh.distance=0;if(!ClubRefresh.busy)ClubRefresh.hide();},{passive:true});

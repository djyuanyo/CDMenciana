/* Shared club design: public preview and authenticated interface. */
window.CDM={
 paths:{menu:'M4 7h16M4 12h16M4 17h16',back:'M19 12H5m6-7-7 7 7 7',home:'M3 10 12 3l9 7v10H15v-6H9v6H3Z',calendar:'M5 5h14v16H5ZM8 3v4m8-4v4M5 10h14',news:'M4 3h16v18H4ZM7 7h10M7 11h4M7 15h10M7 18h10',team:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m9-7a4 4 0 0 1 0 7',more:'M5 12h.01M12 12h.01M19 12h.01',tv:'M3 6h18v12H3ZM8 21h8M12 18v3M10.5 9.5v5l4-2.5Z',user:'M20 21v-2a7 7 0 0 0-14 0v2M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',arrow:'m9 5 7 7-7 7',card:'M3 5h18v14H3ZM3 9h18M7 14h3',ball:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 6 4 3-1.5 5h-5L8 11Zm0-6v6M2 9l6 2m-4 8 5.5-3M20 19l-5.5-3M22 9l-6 2',chart:'M4 20V10m8 10V4m8 16v-7',lock:'M5 10h14v11H5Zm3 0V6a4 4 0 0 1 8 0v4',check:'m5 12 4 4L19 6',star:'m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z',shield:'M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6Z',trash:'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',camera:'M4 8h3l2-3h6l2 3h3v12H4ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',logout:'M15 17l5-5-5-5M20 12H9M12 21H5V3h7',bell:'M6 16V11a6 6 0 0 1 12 0v5l2 2H4ZM10 21h4',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6'},
 icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${this.paths[name]||this.paths.ball}"/></svg>`},
 confirm(title,message,label='Aceptar'){
  const previous=document.activeElement,dialog=document.createElement('dialog'),E=x=>Fixtures.esc(x);
  dialog.className='app-dialog';dialog.setAttribute('aria-labelledby','cdm-confirm-title');
  dialog.innerHTML=`<span class="dialog-icon">${this.icon('lock')}</span><h2 id="cdm-confirm-title">${E(title)}</h2><p>${E(message)}</p><div class="dialog-actions"><button type="button" class="secondary" data-dialog-cancel>Cancelar</button><button type="button" data-dialog-confirm>${E(label)}</button></div>`;
  document.body.appendChild(dialog);
  return new Promise(resolve=>{const finish=value=>{dialog.close();dialog.remove();previous?.focus?.({preventScroll:true});resolve(value)};dialog.querySelector('[data-dialog-cancel]').onclick=()=>finish(false);dialog.querySelector('[data-dialog-confirm]').onclick=()=>finish(true);dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false)});dialog.showModal();dialog.querySelector('[data-dialog-cancel]').focus();});
 },
 // A message with a single "Cerrar" button, e.g. when a registration cannot be completed.
 alert(title,message,icon='lock'){
  const previous=document.activeElement,dialog=document.createElement('dialog'),E=x=>String(x??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
  dialog.className='app-dialog';dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-labelledby','cdm-alert-title');dialog.setAttribute('aria-describedby','cdm-alert-text');
  dialog.innerHTML=`<span class="dialog-icon">${this.icon(icon)}</span><h2 id="cdm-alert-title">${E(title)}</h2><p id="cdm-alert-text">${E(message)}</p><div class="dialog-actions"><button type="button" data-dialog-close>Cerrar</button></div>`;
  document.body.appendChild(dialog);
  return new Promise(resolve=>{const finish=()=>{dialog.close();dialog.remove();previous?.focus?.({preventScroll:true});resolve();};dialog.querySelector('[data-dialog-close]').onclick=finish;dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});dialog.showModal();dialog.querySelector('[data-dialog-close]').focus();});
 },
 /* Desktop browsers get a side menu opened from the header instead of the bottom bar (the CSS only shows it there). */
 menu(open){
  document.body.classList.toggle('menu-open',open);
  document.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded',String(open));
  document.querySelector('[data-menu-toggle]')?.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
  let backdrop=document.getElementById('menu-backdrop');
  if(!backdrop){backdrop=document.createElement('div');backdrop.id='menu-backdrop';document.body.append(backdrop);}
 },
 shell(page,user){
  document.body.dataset.page=page;
  this.menu(false);
  const nav=document.getElementById('nav'),header=document.getElementById('header'),banner=document.getElementById('banner'),tabs=document.getElementById('tabs');
  header.innerHTML=`<button type="button" class="menu-btn" data-menu-toggle aria-label="Abrir menú" aria-expanded="false" aria-controls="nav">${this.icon('menu')}</button><button type="button" class="club-header-brand" data-page="Inicio" aria-label="Club Deportivo Menciana, Apaga y Vámonos · Ir al inicio"><img class="club-header-light" src="club-header-light.png?v=2" alt=""><img class="club-header-dark" src="club-header-dark.png?v=2" alt=""></button><div class="header-actions">${Appearance.button()}<button class="profile-btn" data-page="Mi cuenta" aria-label="Mi cuenta">${this.icon('user')}</button></div>`;
  const section=['Partidos','Clasificación','Ficha de partido','Acta','Jugador'].includes(page)?'Partidos':['Club','Goleadores'].includes(page)?'Club':['Inicio'].includes(page)?'Inicio':['Noticias','Noticia'].includes(page)?'Noticias':page==='CDM TV'?'CDM TV':'';
  nav.innerHTML=[['Inicio','home','Inicio'],['Partidos','calendar','Partidos'],['Noticias','news','Noticias'],['CDM TV','tv','CDM TV']].map(([p,i,l])=>`<button data-page="${p}" class="${section===p?'selected':''}" ${section===p?'aria-current="page"':''}>${this.icon(i)}<span>${l}</span></button>`).join('');
  const teamPages=['Inicio','Partidos','Club','Clasificación','Goleadores'];
  const teamSelector=document.getElementById('teams');if(teamSelector){teamSelector.hidden=!teamPages.includes(page)&&!['Acta','Jugador'].includes(page);teamSelector.innerHTML=Object.entries(Fixtures.teams).map(([key,t])=>`<button type="button" data-team="${key}" class="${Fixtures.selectedTeam===key?'active':''}" aria-pressed="${Fixtures.selectedTeam===key}">${Fixtures.categoryCrest(key)?`<img class="team-selector-crest" src="${Fixtures.esc(Fixtures.categoryCrest(key))}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'team-selector-crest-placeholder'}))">`:'<span class="team-selector-crest-placeholder" aria-hidden="true"></span>'}<span>${Fixtures.esc(t.label)}</span></button>`).join('');}
  const titles={Partidos:'Calendario',Clasificación:'Clasificación',Club:'Nuestro equipo',Goleadores:'Goleadores'};
  banner.innerHTML=teamPages.includes(page)?`<div class="category-heading"><div><span class="eyebrow">${Fixtures.esc(Fixtures.teamLabel())}</span><h1>${page==='Inicio'?'El club, en la pista':titles[page]}</h1><p>${Fixtures.esc(Fixtures.competitionLabel())}</p></div>${window.ClubFavorites?`<div class="category-favorite">${ClubFavorites.banner()}</div>`:''}</div>`:'';
  tabs.innerHTML=teamPages.includes(page)?[['Partidos','Calendario','calendar'],['Clasificación','Clasificación','chart'],['Club','Plantilla','team'],['Goleadores','Goleadores','ball']].map(([p,l,i])=>`<button data-page="${p}" class="${page===p?'active':''}" ${page===p?'aria-current="page"':''}>${this.icon(i)}<span>${l}</span></button>`).join(''):'';
  tabs.hidden=!teamPages.includes(page);
  const active=tabs.querySelector('.active');
  if(active&&tabs.clientWidth){const item=active.getBoundingClientRect(),bar=tabs.getBoundingClientRect();tabs.scrollLeft+=item.left-bar.left-(tabs.clientWidth-item.width)/2;}
  else if(page==='Inicio')tabs.scrollLeft=0;
 },
 empty(title,text,icon='ball'){return `<section class="card empty-panel"><div class="empty-icon">${this.icon(icon)}</div><h2>${title}</h2><p>${text}</p></section>`},
 nextMatch(){return `<section class="match-card"><div class="section-label"><span class="live-dot"></span> PRÓXIMO PARTIDO<span class="match-status">PENDIENTE</span></div><div class="match-teams"><div><img src="crest.png" alt="CD Menciana"><strong>CD Menciana</strong></div><div class="match-time"><span>Fecha y hora</span><strong class="time-unconfirmed">POR<br>CONFIRMAR</strong><small>Calendario pendiente</small></div><div><span class="rival-placeholder">${this.icon('ball')}</span><strong>Rival pendiente</strong></div></div><div class="match-footer">${this.icon('pin')} Pabellón por confirmar<button data-page="Partidos">Ver calendario ${this.icon('arrow')}</button></div></section>`},
 accessTiles(){return `<div class="section-heading"><h2>Tu club, más cerca</h2><span>ZONA PRIVADA</span></div><div class="access-grid"><button class="access-card" data-page="Socios"><span class="access-icon">${this.icon('card')}</span><span class="access-title">Soy socio</span><span class="access-description">Carnet y ventajas</span>${this.icon('arrow')}</button><button class="access-card player-tile" data-page="Jugadores"><span class="access-icon">${this.icon('team')}</span><span class="access-title">Soy jugador</span><span class="access-description">Agenda del equipo</span>${this.icon('arrow')}</button></div>`}
};
document.addEventListener('click',e=>{
 if(e.target.closest('[data-menu-toggle]'))CDM.menu(!document.body.classList.contains('menu-open'));
 else if(document.body.classList.contains('menu-open')&&(e.target.id==='menu-backdrop'||e.target.closest('#nav button')))CDM.menu(false);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('menu-open')){CDM.menu(false);document.querySelector('[data-menu-toggle]')?.focus();}});

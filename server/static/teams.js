/* Teams are published only after the official import succeeds. */
window.ClubTeams={
 rows:[],loaded:false,loading:null,job:null,revision:'',timer:null,feedback:'',refreshing:null,
 key(value){return /^(first|filial|infantil|rfaf_[0-9]{1,12}_[0-9]{1,12})$/.test(value||'');},
 valid(value){
  if(value?.version!==1||!Array.isArray(value.teams)||value.teams.length<3||value.teams.length>30)return false;
  const seen=new Set();return value.teams.every(t=>{if(!this.key(t.key)||seen.has(t.key)||!/^\d{1,12}$/.test(t.team_id||'')||t.filename!==(t.key==='first'?'fixtures.json':'fixtures-'+t.key+'.json')||typeof t.label!=='string'||!t.label||t.label.length>80||t.status!=='active'||!Number.isSafeInteger(t.order))return false;seen.add(t.key);return true;})&&['first','filial','infantil'].every(k=>seen.has(k));
 },
 apply(value){
  if(!this.valid(value))throw Error('No se pudo actualizar el catálogo de equipos.');
  this.rows=[...value.teams].sort((a,b)=>a.order-b.order||a.key.localeCompare(b.key));
  const previous=Fixtures.selectedTeam,selected=Appearance.stored('team',previous);
  Fixtures.teams=Object.fromEntries(this.rows.map(t=>[t.key,{...t,teamId:t.team_id}]));
  ClubFavorites.clubTeams=Object.fromEntries(this.rows.map(t=>[t.key,{teamId:t.team_id,teamName:t.label}]));
  ClubFavorites.catalog.clear();for(const t of this.rows)ClubFavorites.remember(null,t.key);
  if(!Fixtures.teams[previous]){Fixtures.selectedTeam=this.rows[0].key;Fixtures.data={matches:[]};}
  if(!this.loaded&&Fixtures.teams[selected])Fixtures.selectedTeam=selected;
  try{localStorage.setItem('cdm-club-teams',JSON.stringify(value));}catch{}
  this.loaded=true;window.dispatchEvent(new CustomEvent('club-teams-state'));
 },
 async load(refresh=false){
  if(this.loading)return this.loading;if(this.loaded&&!refresh)return;
  this.loading=(async()=>{try{const r=await fetch('club-teams.json'+(refresh?'?refresh=1':''),{cache:'no-store'});if(!r.ok)throw Error();const value=await r.json();this.apply(value);try{localStorage.setItem('cdm-club-teams',JSON.stringify(value));}catch{}}catch{try{const value=JSON.parse(localStorage.getItem('cdm-club-teams'));if(this.valid(value))this.apply(value);}catch{}}finally{this.loading=null;}})();return this.loading;
 },
 async http(path,payload){if(!ClubAccess.administrator())throw Error('Solo el administrador puede gestionar equipos.');return ClubNotifications.http(path,payload);},
 screen(){
  if(!ClubAccess.administrator())return '';
  return `<div class="section-heading"><h2>Equipos del club</h2></div><section class="card"><h3>Añadir equipo desde RFAF</h3><p>Pega el calendario de la categoría. Consultaremos los equipos de nuestro club antes de añadirlo.</p><form data-team-preview class="notification-form"><label>Enlace del calendario<input type="url" name="source" required maxlength="1000" placeholder="https://www.rfaf.es/pnfg/NPcd/NFG_VisCalendario_Vis?…"></label><button type="submit" class="auth-primary">Consultar enlace</button><p data-team-feedback role="status" aria-live="polite">${ClubAuth.escape(this.feedback)}</p></form><div data-team-import-preview></div></section><section class="card"><div class="section-heading"><h3>Equipos y orden</h3><button type="button" data-teams-refresh class="text-action">Actualizar</button></div><p>Cambia el nombre que se muestra en la app y su posición. Los favoritos se mantienen.</p><div data-admin-teams-list></div></section>`;
 },
 paint(){
  if(!ClubAccess.administrator())return;const E=ClubAuth.escape.bind(ClubAuth),target=document.querySelector('[data-admin-teams-list]');
  if(target)target.innerHTML=this.rows.map(t=>`<form data-team-update="${E(t.key)}" class="team-edit-form"><label>Nombre en la app<input name="label" value="${E(t.label)}" required maxlength="80"></label><label>Posición<select name="order">${this.rows.map((_,i)=>`<option value="${i+1}"${t.order===i+1?' selected':''}>${i+1}</option>`).join('')}</select></label><small>${E(t.competition)} · ${E(t.group)}</small><button type="submit">Guardar cambios</button>${t.key.startsWith('rfaf_')?`<button type="button" data-team-delete="${E(t.key)}" class="account-danger">Eliminar equipo</button><div data-team-delete-prompt hidden><p>¿Eliminar ${E(t.label)} del club? Dejará de aparecer en la app y de recibir avisos. Puedes volver a añadirlo desde su enlace.</p><button type="button" data-team-delete-confirm="${E(t.key)}" class="account-danger">Eliminar equipo del listado</button><button type="button" data-team-delete-close>Volver</button></div>`:''}<p role="status" aria-live="polite"></p></form>`).join('');
  const slot=document.querySelector('[data-team-import-preview]');if(!slot)return;const job=this.job;
  if(!job){slot.innerHTML='';return;}
  if(['import_pending','import_error'].includes(job.status)&&target)target.insertAdjacentHTML('beforeend',`<article class="team-edit-form"><h3>${E(job.label||'Nuevo equipo')}</h3><p role="status">${job.status==='import_pending'?'Importación guardada. Preparando los datos de RFAF…':E(job.error||'La importación no ha terminado. Reintenta desde el formulario.')}</p></article>`);
  if(['preview_pending','import_pending'].includes(job.status)){slot.innerHTML=`<p role="status">${job.status==='preview_pending'?'Consultando la competición en RFAF…':'Importando calendario, clasificación, plantilla y actas…'} Puede tardar unos minutos. Puedes salir y volver a este apartado.</p><button type="button" data-teams-refresh>Comprobar estado</button>`;return;}
  if(job.status==='error'){slot.innerHTML=`<p role="alert">${E(job.error)}</p><button type="button" data-team-preview-retry>Reintentar consulta</button>`;return;}
  if(job.status==='complete'){slot.innerHTML=this.rows.some(t=>t.key===job.teamKey)?'<p role="status">Equipo añadido. Ya está disponible en la app y en favoritos.</p>':'<p role="status">Este equipo se ha retirado del listado. Consulta su enlace para añadirlo de nuevo.</p>';return;}
  const p=job.preview;if(!p)return;
  slot.innerHTML=`<div class="team-import-summary"><h3>${E(p.competition)}</h3><p>${E(p.group)} · Temporada ${E(p.season)}</p><p>${p.team_count} equipos · ${p.round_count} jornadas${p.has_byes?' · Con descansos':''}</p></div>${job.error?`<p role="alert">${E(job.error)}</p>`:''}<form data-team-import class="notification-form"><label>Equipo del club<select name="teamId" required>${p.candidates.map(c=>`<option value="${E(c.team_id)}"${job.selectedTeam===c.team_id?' selected':''}>${E(c.team_name)}</option>`).join('')}</select></label><label>Nombre en la app<input name="label" required maxlength="80" value="${E(job.label||(/Cadete/i.test(p.competition)?'Cadete':/Alev[ií]n/i.test(p.competition)?'Alevín':/Benjam[ií]n/i.test(p.competition)?'Benjamín':'Nuevo equipo'))}"></label><label>Posición<select name="order">${Array.from({length:this.rows.length+1},(_,i)=>`<option value="${i+1}"${(job.order||this.rows.length+1)===i+1?' selected':''}>${i+1}</option>`).join('')}</select></label><button type="submit" class="auth-primary">${job.status==='import_error'?'Reintentar importación':'Añadir equipo'}</button><p role="status" aria-live="polite"></p></form>`;
 },
 async refresh(){
  if(this.refreshing)return this.refreshing;
  this.refreshing=this.refreshNow();try{return await this.refreshing;}finally{this.refreshing=null;}
 },
 async refreshNow(){
  clearTimeout(this.timer);if(!ClubAccess.administrator()||!document.querySelector('[data-admin-teams-list]'))return;
  try{const saved=localStorage.getItem('cdm-team-import');if(!this.job&&/^[a-f0-9]{32}$/.test(saved||''))this.job={id:saved};}catch{}
  const result=await this.http('/teams',{...(this.job?.id?{id:this.job.id}:{})});if(!ClubAccess.administrator())return;
  const changed=this.revision!==result.revision;this.revision=result.revision;this.apply({version:1,teams:result.teams});this.job=result.job;this.paint();
  if(changed)fetch('club-teams.json?refresh=1',{cache:'no-store'}).catch(()=>{});
  if(this.job&&['preview_pending','import_pending'].includes(this.job.status))this.timer=setTimeout(()=>this.refresh().catch(e=>this.say(e.message)),15000);
 },
 say(message){this.feedback=message;const p=document.querySelector('[data-team-feedback]');if(p)p.textContent=message;},
 async add(values){
  const result=await this.http('/teams/import',{id:this.job.id,teamId:values.teamId,label:values.label,order:Number(values.order)});
  this.job=result.job;this.say('Solicitud guardada. El equipo aparecerá al terminar la importación.');this.paint();
  try{await this.refresh();}catch(e){this.say('Solicitud guardada. '+e.message);this.timer=setTimeout(()=>this.refresh().catch(e=>this.say(e.message)),15000);}
 },
 async remove(key){
  await this.http('/teams/delete',{key,revision:this.revision});
  if(this.job?.teamKey===key){this.job=null;localStorage.removeItem('cdm-team-import');}
  await this.refresh();this.say('Equipo eliminado del listado. Puedes volver a añadirlo desde su enlace.');
 },
 async preview(source,retry=false){
  const id=retry?this.job.id:ClubNotifications.id();const result=await this.http('/teams/preview',{id,source});this.job=result.job;try{localStorage.setItem('cdm-team-import',id);}catch{}this.say('Consulta iniciada.');this.paint();await this.refresh();
 }
};
document.addEventListener('submit',async event=>{
 const form=event.target;if(!form.matches('[data-team-preview],[data-team-import],[data-team-update]'))return;event.preventDefault();const button=form.querySelector('button[type="submit"]'),status=form.querySelector('[role="status"]');if(button.disabled)return;button.disabled=true;status.textContent='Guardando…';
 try{const v=Object.fromEntries(new FormData(form));if(form.matches('[data-team-preview]'))await ClubTeams.preview(v.source);else if(form.matches('[data-team-import]')){await ClubTeams.add(v);}else{await ClubTeams.http('/teams/update',{key:form.dataset.teamUpdate,label:v.label,order:Number(v.order),revision:ClubTeams.revision});await ClubTeams.refresh();ClubTeams.say('Nombre y orden guardados.');}}
 catch(e){status.textContent=e.message;ClubTeams.say(e.message);}finally{button.disabled=false;}
});
document.addEventListener('click',async event=>{try{
 const remove=event.target.closest('[data-team-delete]');if(remove)remove.closest('form').querySelector('[data-team-delete-prompt]').hidden=false;
 const close=event.target.closest('[data-team-delete-close]');if(close)close.closest('[data-team-delete-prompt]').hidden=true;
 const confirm=event.target.closest('[data-team-delete-confirm]');if(confirm){confirm.disabled=true;try{await ClubTeams.remove(confirm.dataset.teamDeleteConfirm);}finally{confirm.disabled=false;}}
if(event.target.closest('[data-teams-refresh]'))await ClubTeams.refresh();if(event.target.closest('[data-team-preview-retry]'))await ClubTeams.preview(ClubTeams.job.source,true);}catch(e){ClubTeams.say(e.message);}});
window.addEventListener('club-auth-state',()=>{clearTimeout(ClubTeams.timer);ClubTeams.job=null;ClubTeams.revision='';ClubTeams.feedback='';});

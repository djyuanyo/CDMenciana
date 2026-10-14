/* Public sports content is available to all ages. Account access belongs to adults. */
window.ClubFamilies={
 adult:false,minor:false,
 init(){try{this.adult=localStorage.getItem('cdm-adult-access-v1')==='true';}catch{}},
 screen(){return `<section class="auth-card family-access"><span class="auth-eyebrow">ACCESO CON CUENTA</span><h1>Tu cuenta del club</h1><p>Los partidos, resultados y noticias se pueden consultar sin crear una cuenta.</p><form data-adult-access><label class="auth-field"><span>Fecha de nacimiento de la persona que va a usar la cuenta</span><input type="date" name="adultBirthDate" required min="1900-01-01" max="${new Date().toISOString().slice(0,10)}"></label><p class="auth-access-note">Se comprueba en este dispositivo. Esta fecha no se envía ni se guarda.</p><label class="privacy-check"><input type="checkbox" name="privacy" required>He leído la <a href="privacy.html">política de privacidad</a> y entiendo el tratamiento de los datos de la cuenta.</label><button type="submit" class="auth-primary">Continuar</button><p role="status" data-adult-feedback>${this.minor?'Las cuentas son para personas adultas. Puedes seguir consultando la app sin registro. Para las funciones de cuenta, pide ayuda a tu madre, padre o tutor.':''}</p></form><button type="button" data-page="Inicio" class="auth-secondary">Consultar sin cuenta</button></section>`;},
 check(value,now=new Date()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('Introduce una fecha válida.');
  const date=new Date(value+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value||value<'1900-01-01'||date>now)throw Error('Introduce una fecha válida.');
  const limit=new Date(now);limit.setFullYear(limit.getFullYear()-18);return value<=limit.toISOString().slice(0,10);
 },
 clear(){this.adult=false;this.minor=false;try{localStorage.removeItem('cdm-adult-access-v1');}catch{}}
};
ClubFamilies.init();
const adultRequest=ClubAuth.request.bind(ClubAuth);
ClubAuth.request=function(action,...args){const next=action==='state'&&ClubFamilies.adult?'resume':action;return adultRequest(next==='resume'&&!this.firebase()?'state':next,...args);};
const accountScreen=ClubAuth.screen.bind(ClubAuth),accountPerform=ClubAuth.perform.bind(ClubAuth);
ClubAuth.screen=function(...args){return ClubFamilies.adult?accountScreen(...args):'<div class="auth-layout">'+ClubFamilies.screen()+'</div>';};
ClubAuth.perform=async function(action,...args){if(['login','register','google'].includes(action)&&!ClubFamilies.adult){this.showFeedback('Completa primero el acceso de una persona adulta.',true);return;}await accountPerform(action,...args);if(action==='logout'){ClubFamilies.clear();window.dispatchEvent(new CustomEvent('club-auth-view'));}};
const clubSync=ClubAccess.sync.bind(ClubAccess),clubUser=ClubAccess.user.bind(ClubAccess),clubAdmin=ClubAccess.administrator.bind(ClubAccess),favoritesSync=ClubFavorites.sync.bind(ClubFavorites);
ClubAccess.sync=async function(...args){if(!ClubFamilies.adult)return;return clubSync(...args);};
ClubAccess.user=function(...args){return ClubFamilies.adult?clubUser(...args):null;};
ClubAccess.administrator=function(...args){return ClubFamilies.adult&&clubAdmin(...args);};
ClubFavorites.sync=async function(...args){if(!ClubFamilies.adult)return;return favoritesSync(...args);};
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-adult-access]');if(!form)return;event.preventDefault();
 const feedback=form.querySelector('[data-adult-feedback]');
 try{if(!ClubFamilies.check(form.elements.adultBirthDate.value)){ClubFamilies.minor=true;feedback.textContent='Las cuentas son para personas adultas. Puedes consultar los partidos y noticias sin registro. Pide ayuda a tu madre, padre o tutor para las funciones de cuenta.';return;}
  if(!form.elements.privacy.checked)throw Error('Lee la política de privacidad antes de continuar.');
  ClubFamilies.adult=true;try{localStorage.setItem('cdm-adult-access-v1','true');}catch{}
  await ClubAuth.request('resume');await ClubAccess.sync();window.dispatchEvent(new CustomEvent('club-auth-view'));
 }catch(error){ClubFamilies.clear();feedback.textContent=error.message;}
});
document.addEventListener('click',event=>{
 const link=event.target.closest('a[href]');if(!link||ClubFamilies.adult)return;
 let url;try{url=new URL(link.href);}catch{return;}
 if(url.origin===location.origin||url.protocol!=='https:')return;
 event.preventDefault();CDM.confirm('Enlace externo','Para abrir esta página fuera de la app, pide ayuda a una persona adulta.','Cerrar');
},true);
window.ClubLegal={screen(kind='privacy'){return `<section class="card legal-intro"><h2>${kind==='privacy'?'Privacidad':'Eliminar tu cuenta'}</h2><p>CD Menciana · Club Deportivo Menciana</p></section><iframe class="legal-frame" title="${kind==='privacy'?'Política de privacidad':'Eliminación de cuenta'}" src="${kind==='privacy'?'privacy.html':'delete-account.html'}"></iframe>`;}};

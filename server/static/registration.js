/* Required club profile, shared by email and Google identities. */
window.ClubRegistration={
 categories:['Escuela Biberón','Escuela Benjamín','Escuela Alevín','Infantil','Cadete','Filial Senior','Primer Equipo Senior'],draft:{},
 async createNative(data){
  const name=String(data.name||'').trim(),email=String(data.email||'').trim(),password=String(data.password||'');
  if(name.length<2||name.length>100)throw Error('Introduce tu nombre completo.');
  if(password.length<10||password.length>128)throw Error('La contraseña debe tener entre 10 y 128 caracteres.');
  this.validate(data);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   // Create the identity without the native shell's legacy verification email.
   // The native SDK then signs in and continues to own the persisted session.
   const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyAuvHYalR84N7cQ1KrOdv3_GeUeGCqZnGQ',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),signal:controller.signal});
   const result=await response.json();
   if(!response.ok)throw Error(({EMAIL_EXISTS:'Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.',INVALID_EMAIL:'Introduce un correo electrónico válido.',OPERATION_NOT_ALLOWED:'El registro con correo todavía no está activado.',TOO_MANY_ATTEMPTS_TRY_LATER:'Espera un momento antes de volver a intentarlo.'})[result.error?.message]||'No se pudo crear la cuenta. Vuelve a intentarlo.');
   if(!result.idToken||!result.localId)throw Error('No se pudo confirmar la creación. Prueba a iniciar sesión con tu correo.');
   try{await fetch('https://identitytoolkit.googleapis.com/v1/accounts:update?key=AIzaSyAuvHYalR84N7cQ1KrOdv3_GeUeGCqZnGQ',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:result.idToken,displayName:name,returnSecureToken:false}),signal:controller.signal});}catch{}
   try{const identity=await ClubAuth.request('login',{email,password});return {...identity,message:'Cuenta creada. Completa tus datos en la app.'};}
   catch{throw Error('Tu cuenta se ha creado. Inicia sesión con tu correo y contraseña para completar el registro en la app.');}
  }catch(error){if(error.name==='AbortError'||error.name==='TypeError')throw Error('No se pudo confirmar el registro. Prueba a iniciar sesión con tu correo antes de crear otra cuenta.');throw error;}
  finally{clearTimeout(timer);}
 },
 validate(data){
  const value={name:String(data.name||'').trim(),registrationType:String(data.registrationType||''),teamRole:'',memberNumber:'',category:'',birthDate:'',registrationComplete:'true'};
  if(value.name.length<2||value.name.length>100)throw Error('Introduce tu nombre completo.');
  if(!['team','member','fan'].includes(value.registrationType))throw Error('Selecciona cómo formas parte del club.');
  if(value.registrationType==='member'){
   value.memberNumber=String(data.memberNumber||'').trim();
   if(!/^\d{1,12}$/.test(value.memberNumber))throw Error('Introduce tu número de socio (solo números).');
  }
  if(value.registrationType==='team'){
   value.teamRole=String(data.teamRole||'');value.category=String(data.category||'');
   if(!['player','staff'].includes(value.teamRole))throw Error('Selecciona si eres jugador o cuerpo técnico.');
   if(!this.categories.includes(value.category))throw Error('Selecciona tu categoría.');
   if(value.teamRole==='player'){
    value.birthDate=String(data.birthDate||'');
    const date=new Date(value.birthDate+'T12:00:00Z'),today=new Date(),limit=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value.birthDate)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value.birthDate||value.birthDate<'1900-01-01'||value.birthDate>limit)throw Error('Introduce una fecha de nacimiento válida, que no sea futura.');
   }
  }
  return value;
 },
 complete(profile){try{return profile?.registrationComplete==='true'&&!!this.validate(profile);}catch{return false;}},
 fields(data={}){
  const E=ClubAuth.escape.bind(ClubAuth),type=data.registrationType||'',team=type==='team',member=type==='member',player=team&&data.teamRole==='player';
  const options=(rows,value)=>'<option value="">Selecciona una opción</option>'+rows.map(([key,label])=>`<option value="${E(key)}"${value===key?' selected':''}>${E(label)}</option>`).join('');
  return `<div class="registration-fields"><label class="auth-field"><span>¿Cómo formas parte del club?</span><select name="registrationType" data-registration-type required>${options([['team','Jugador/Cuerpo Técnico'],['member','Socio'],['fan','Aficionado']],type)}</select></label><label class="auth-field" data-member-field${member?'':' hidden'}><span>Número de socio</span><input name="memberNumber" inputmode="numeric" pattern="[0-9]{1,12}" maxlength="12" value="${E(data.memberNumber||'')}"${member?' required':' disabled'}></label><div data-team-fields${team?'':' hidden'}><label class="auth-field"><span>Tu función en el equipo</span><select name="teamRole" data-team-role${team?' required':' disabled'}>${options([['player','Jugador'],['staff','Cuerpo Técnico']],data.teamRole)}</select></label><label class="auth-field"><span>Categoría</span><select name="category"${team?' required':' disabled'}>${options(this.categories.map(x=>[x,x]),data.category)}</select></label></div><label class="auth-field" data-birth-field${player?'':' hidden'}><span>Fecha de nacimiento</span><input type="date" name="birthDate" min="1900-01-01" max="${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}" value="${E(data.birthDate||'')}"${player?' required':' disabled'}></label></div>`;
 },
 openDialog(){
  const dialog=document.querySelector('[data-registration-dialog]');if(!dialog||!ClubAuth.user||ClubAccess.administrator()||ClubAccess.fetching||window.ClubDeletion?.pending||this.complete(ClubAccess.profile))return;
  dialog.addEventListener('cancel',event=>event.preventDefault());
  if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
 },
 screen(){
  queueMicrotask(()=>this.openDialog());
  const data={...ClubAccess.profile,...this.draft},name=data.name||ClubAuth.user?.name||'',E=ClubAuth.escape.bind(ClubAuth);
  return `<dialog class="registration-dialog" data-registration-dialog aria-labelledby="registration-title" aria-describedby="registration-description"><div class="auth-layout"><section class="auth-card"><div class="auth-brand"><img src="crest.png" alt="Escudo del CD Menciana"><span class="auth-eyebrow">COMPLETA TU REGISTRO</span></div><h1 id="registration-title">Completa tu registro</h1><p id="registration-description" class="auth-subtitle">Antes de continuar, completa tus datos. También son obligatorios al entrar con Google.</p>${ClubAuth.feedback()}${ClubAccess.error?`<p role="alert" class="auth-feedback is-error">${E(ClubAccess.error)}</p>`:''}<form data-registration-form><label class="auth-field"><span>Nombre completo</span><input name="name" autocomplete="name" minlength="2" maxlength="100" required value="${E(name)}"></label>${this.fields(data)}<button type="submit" class="auth-primary">Completar registro ${CDM.icon('arrow')}</button></form><p class="auth-access-note">El club revisará los datos de socios y equipos para activar sus accesos.</p><button type="button" data-auth-action="logout" class="auth-text-button">Cerrar sesión</button>${window.ClubDeletion?ClubDeletion.button():''}</section></div></dialog>`;
 },
 update(form){
  const type=form.elements.registrationType.value,team=type==='team',member=type==='member',player=team&&form.elements.teamRole.value==='player';
  for(const [selector,active] of [['[data-member-field]',member],['[data-team-fields]',team],['[data-birth-field]',player]]){
   const group=form.querySelector(selector);group.hidden=!active;
   for(const input of group.querySelectorAll('input,select')){input.disabled=!active||ClubAuth.busy;input.required=active;}
  }
 },
 async save(data){const value=this.validate(data);await ClubAccess.saveRegistration(value);this.draft={};window.dispatchEvent(new CustomEvent('club-registration-complete'));}
};
document.addEventListener('change',event=>{if(event.target.matches('[data-registration-type],[data-team-role]'))ClubRegistration.update(event.target.form);});
document.addEventListener('input',event=>{const form=event.target.closest('[data-registration-form]');if(form)ClubRegistration.draft=Object.fromEntries(new FormData(form));});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-registration-form]');if(!form)return;event.preventDefault();if(ClubAuth.busy)return;
 const data=Object.fromEntries(new FormData(form));ClubRegistration.draft=data;ClubAuth.setBusy(true);ClubAuth.showFeedback('');
 try{await ClubRegistration.save(data);}catch(error){ClubAuth.showFeedback(error.message,true);}finally{ClubAuth.setBusy(false);}
});

// Keep unfinished data with its own identity when switching Google accounts.
let registrationIdentity=null;
window.addEventListener('club-auth-state',()=>{const uid=ClubAuth.user?.uid||null;if(uid!==registrationIdentity){ClubRegistration.draft={};registrationIdentity=uid;}});

/* Account UI shared by the public APK and the club server. No credentials are persisted here. */
window.ClubAuth={
 configured:false,google:false,user:null,mode:'login',message:'',error:false,busy:false,pending:new Map(),sequence:0,legacy:null,ready:null,
 escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
 native(){return !!window.ClubAuthNative?.request;},
 update(data){
  if(!data||typeof data!=='object')return;
  const before=JSON.stringify([this.configured,this.google,this.user]);
  if(typeof data.configured==='boolean')this.configured=data.configured;
  if(typeof data.google==='boolean')this.google=data.google;
  if('user' in data)this.user=data.user&&typeof data.user==='object'?{uid:String(data.user.uid||''),name:String(data.user.name||''),email:String(data.user.email||''),emailVerified:data.user.emailVerified===true}:null;
  if(before!==JSON.stringify([this.configured,this.google,this.user]))window.dispatchEvent(new CustomEvent('club-auth-state'));
 },
 receive(id,data){
  this.update(data);
  const pending=this.pending.get(String(id));if(!pending)return;
  this.pending.delete(String(id));clearTimeout(pending.timer);
  if(data?.ok===false)pending.reject(Error(data.error||'No se pudo completar la solicitud.'));else pending.resolve(data);
 },
 request(action,data={}){
  if(!this.native())return this.legacyRequest(action,data);
  return new Promise((resolve,reject)=>{
   const id='account_'+(++this.sequence),timer=setTimeout(()=>{this.pending.delete(id);reject(Error('La solicitud está tardando demasiado. Vuelve a intentarlo.'));},action==='google'?120000:45000);
   this.pending.set(id,{resolve,reject,timer});
   try{ClubAuthNative.request(id,action,JSON.stringify(data));}catch(e){clearTimeout(timer);this.pending.delete(id);reject(Error('No se pudo abrir el acceso al club.'));}
  });
 },
 async legacyRequest(action,data){
  if(!this.legacy)throw Error('El acceso al club todavía no está activado.');
  if(action==='state')return {configured:true,google:false,user:null};
  if(!['login','register','logout'].includes(action))throw Error(action==='google'?'El acceso con Google está disponible en la app Android.':'Contacta con el club para recuperar tu acceso.');
  const result=await this.legacy(action,data);window.dispatchEvent(new CustomEvent('club-auth-legacy'));
  return result;
 },
 init(options={}){
  if(options.legacy)this.legacy=options.legacy;
  if(!this.ready)this.ready=this.request('state').then(data=>this.update(data)).catch(()=>{});
  return this.ready;
 },
 googleLogo(){return '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285f4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4.1 6v5h6.6c3.8-3.5 6.1-8.6 6.1-14.7Z"/><path fill="#34a853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20.4 20.4 0 0 0 24 44Z"/><path fill="#fbbc05" d="M12.6 27.6A12.4 12.4 0 0 1 12 24c0-1.3.2-2.5.6-3.6v-5.2H5.8A20 20 0 0 0 3.6 24c0 3.2.8 6.2 2.2 8.8l6.8-5.2Z"/><path fill="#ea4335" d="M24 12c3 0 5.6 1 7.7 3l5.7-5.6A19.7 19.7 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z"/></svg>';},
 field(name,label,type,autocomplete,hint=''){
  const E=x=>this.escape(x),password=type==='password',id='auth-'+name;
  return `<label class="auth-field" for="${id}"><span>${E(label)}</span><span class="auth-input-wrap"><input id="${id}" name="${name}" type="${type}" autocomplete="${autocomplete}" ${type==='email'?'inputmode="email" autocapitalize="none" spellcheck="false"':''} ${name==='name'?'minlength="2" maxlength="100"':type==='password'?'maxlength="128"':'maxlength="254"'} placeholder="${E(hint)}" required${this.busy||!this.configured?' disabled':''}>${password?`<button type="button" class="auth-password-toggle" data-auth-password="${id}" aria-label="Mostrar contraseña" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button>`:''}</span></label>`;
 },
 feedback(){return `<p class="auth-feedback ${this.error?'is-error':''}" role="${this.error?'alert':'status'}" aria-live="polite"${this.message?'':' hidden'}>${this.escape(this.message)}</p>`;},
 screen(clubUser=null){
  const E=x=>this.escape(x),user=this.native()?this.user:clubUser;
  if(user){
   const name=user.name||user.email.split('@')[0],verified=this.native()?user.emailVerified:!!clubUser?.active;
   const initials=name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('');
   return `<div class="auth-layout"><section class="auth-card account-card"><span class="auth-eyebrow">TU CUENTA · CD MENCIANA</span><div class="account-avatar" aria-hidden="true">${E(initials)}</div><h1>${E(name)}</h1><p class="auth-subtitle">${E(user.email)}</p><span class="account-status ${verified?'verified':''}">${CDM.icon(verified?'check':'lock')}${this.native()?(verified?'Correo verificado':'Verifica tu correo'):(verified?'Cuenta aprobada':'Pendiente de aprobación')}</span>${this.feedback()}${!verified&&this.native()?'<p class="account-description">Abre el enlace que te hemos enviado para verificar tu correo.</p><div class="account-actions"><button type="button" data-auth-action="verify" class="auth-primary">Reenviar correo</button><button type="button" data-auth-action="reload" class="auth-secondary">Ya lo he verificado</button></div>':''}<section class="account-club-access"><h2>Tu sitio en el club</h2><p>${clubUser?.active?[clubUser.member?'Socio':null,clubUser.player?'Jugador':null,clubUser.admin?'Administrador':null].filter(Boolean).map(E).join(' · ')||'Cuenta aprobada':'El club activará tus accesos de socio o jugador cuando apruebe tu cuenta.'}</p></section><button type="button" data-auth-action="logout" class="auth-secondary auth-logout">Cerrar sesión</button><button type="button" data-page="Inicio" class="auth-text-button">Volver al club ${CDM.icon('arrow')}</button></section></div>`;
  }
  const register=this.mode==='register',reset=this.mode==='reset',disabled=this.busy||!this.configured;
  const title=reset?'Recupera tu acceso':register?'Tu sitio está aquí.':'Bienvenido al club.';
  const subtitle=reset?'Te enviaremos un enlace para cambiar tu contraseña.':register?'Crea tu cuenta y forma parte del CD Menciana.':'Toda la actualidad y tu cuenta, en un mismo sitio.';
  return `<div class="auth-layout"><section class="auth-card"><div class="auth-brand"><img src="crest.png" alt="Escudo del CD Menciana"><span class="auth-eyebrow">CD MENCIANA · APAGA Y VÁMONOS</span></div><h1>${title}</h1><p class="auth-subtitle">${subtitle}</p>${!reset?`<div class="auth-tabs" role="group" aria-label="Acceso al club"><button type="button" data-auth-mode="login" aria-pressed="${!register}" class="${!register?'active':''}">Iniciar sesión</button><button type="button" data-auth-mode="register" aria-pressed="${register}" class="${register?'active':''}">Crear cuenta</button></div>`:''}${this.feedback()}${!this.configured?'<p class="auth-setup-status" role="status">El acceso al club todavía no está activado. Puedes seguir consultando la app.</p>':''}${!reset?`<button type="button" class="auth-google" data-auth-action="google"${disabled||!this.google?' disabled':''}>${this.googleLogo()}<span>Continuar con Google</span></button><div class="auth-divider"><span>o con tu correo</span></div>`:''}<form data-auth-form="${reset?'reset':register?'register':'login'}">${register?this.field('name','Nombre completo','text','name','Tu nombre y apellidos'):''}${this.field('email','Correo electrónico','email','email','tu@email.com')}${!reset?this.field('password','Contraseña','password',register?'new-password':'current-password',register?'Mínimo 10 caracteres':'Tu contraseña'):''}${register?this.field('confirm','Repite tu contraseña','password','new-password','Confirma tu contraseña'):''}${!register&&!reset?'<button type="button" class="auth-text-button auth-forgot" data-auth-mode="reset">¿Has olvidado tu contraseña?</button>':''}<button class="auth-primary" type="submit"${disabled?' disabled':''}>${this.busy?'Un momento…':reset?'Enviar enlace':register?'Crear mi cuenta':'Entrar'}${this.busy?'':CDM.icon('arrow')}</button></form>${reset?'<button type="button" class="auth-text-button" data-auth-mode="login">← Volver a iniciar sesión</button>':'<p class="auth-access-note">Los accesos de socios y jugadores los activa el club.</p>'}<button type="button" data-page="Inicio" class="auth-text-button auth-guest">Seguir sin iniciar sesión ${CDM.icon('arrow')}</button></section></div>`;
 },
 showFeedback(message,error=false){this.message=message;this.error=error;const node=document.querySelector('.auth-feedback');if(node){node.hidden=!message;node.textContent=message;node.classList.toggle('is-error',error);node.setAttribute('role',error?'alert':'status');}},
 setBusy(value){this.busy=value;for(const n of document.querySelectorAll('.auth-card button,.auth-card input'))n.disabled=value||!this.configured&&!!n.closest('form');const google=document.querySelector('[data-auth-action="google"]');if(google)google.disabled=value||!this.configured||!this.google;},
 async perform(action,data={}){
  if(this.busy)return;
  this.setBusy(true);this.showFeedback('');
  try{const result=await this.request(action,data);this.showFeedback(result.message||'',false);window.dispatchEvent(new CustomEvent('club-auth-view'));}
  catch(e){this.showFeedback(e.message,true);}
  finally{this.setBusy(false);}
 }
};
document.addEventListener('click',e=>{
 const mode=e.target.closest('[data-auth-mode]');if(mode&&!ClubAuth.busy){ClubAuth.mode=mode.dataset.authMode;ClubAuth.message='';window.dispatchEvent(new CustomEvent('club-auth-view'));}
 const toggle=e.target.closest('[data-auth-password]');if(toggle){const input=document.getElementById(toggle.dataset.authPassword);if(input){const show=input.type==='password';input.type=show?'text':'password';toggle.setAttribute('aria-label',show?'Ocultar contraseña':'Mostrar contraseña');toggle.setAttribute('aria-pressed',String(show));}}
 const action=e.target.closest('[data-auth-action]');if(action){e.preventDefault();ClubAuth.perform(action.dataset.authAction);}
});
document.addEventListener('submit',e=>{
 const form=e.target.closest('[data-auth-form]');if(!form)return;e.preventDefault();
 if(ClubAuth.busy)return;const data=Object.fromEntries(new FormData(form));
 if(form.dataset.authForm==='register'){
  if(data.password?.length<10){ClubAuth.showFeedback('La contraseña debe tener al menos 10 caracteres.',true);return;}
  if(data.password!==data.confirm){ClubAuth.showFeedback('Las contraseñas no coinciden.',true);return;}
 }
 delete data.confirm;ClubAuth.perform(form.dataset.authForm,data);
});

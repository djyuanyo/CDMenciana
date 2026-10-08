/* Account deletion uses user tokens only; privileged deletion runs on the server. */
window.ClubDeletion={
 apiKey:'AIzaSyAuvHYalR84N7cQ1KrOdv3_GeUeGCqZnGQ',pending:false,busy:false,needsLogin:false,
 base(){return `https://firestore.googleapis.com/v1/projects/${ClubAccess.project}/databases/(default)/documents`;},
 async http(url,token,body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store'});
   let result;try{result=await response.json();}catch{result={};}
   return {response,result};
  }catch(error){throw Error(error.name==='AbortError'?'La conexión está tardando demasiado. Vuelve a intentarlo.':'No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.');}
  finally{clearTimeout(timer);}
 },
 async credentials(uid){
  const data=await ClubAuth.request('token');
  if(!data.token||ClubAuth.user?.uid!==uid||data.user?.uid!==uid)throw Error('La sesión ha cambiado. Vuelve a intentarlo.');
  return data.token;
 },
 async check(uid){
  const token=await this.credentials(uid),{response,result}=await this.http(this.base()+'/clubDeletedAccounts/'+encodeURIComponent(uid),token);
  if(response.status===404&&result.error?.status==='NOT_FOUND'&&/^Document .*not found/i.test(result.error?.message||''))return false;
  if(!response.ok)throw Error('No se pudo comprobar el estado de tu cuenta. Vuelve a intentarlo.');
  return !!result.fields?.requestedAt?.timestampValue;
 },
 recent(token){
  try{const part=token.split('.')[1],claims=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));return Number.isFinite(claims.auth_time)&&Date.now()/1000-claims.auth_time<240;}catch{return false;}
 },
 button(){return '<button type="button" data-delete-account class="account-danger">Eliminar mi cuenta</button>';},
 screen(){return `<div class="auth-layout"><section class="auth-card"><span class="auth-eyebrow">TU CUENTA · CD MENCIANA</span><h1>Eliminación pendiente</h1><p class="auth-subtitle">La eliminación de tu cuenta está en curso y tu acceso al club está bloqueado. Completa la eliminación de tu cuenta de acceso. Si se interrumpió la conexión, puedes volver a intentarlo.</p>${ClubAuth.feedback()}<button type="button" data-delete-account class="account-danger">Completar eliminación</button><button type="button" data-auth-action="logout" class="auth-secondary">Cerrar sesión</button></section></div>`;},
 async own(){
  if(this.busy||ClubAuth.busy||!ClubAuth.user)return;
  this.busy=true;const uid=ClubAuth.user.uid,email=ClubAuth.user.email;
  try{
   if(!await CDM.confirm('¿Eliminar tu cuenta?',`Se borrarán tu cuenta de CD Menciana (${email}), tus datos de registro y tus accesos de socio o jugador. No podrás recuperarlos. Tu cuenta de Google no se elimina.`,'Eliminar definitivamente'))return;
   if(ClubAuth.user?.uid!==uid)throw Error('La sesión ha cambiado. Vuelve a intentarlo.');
   ClubAuth.setBusy(true);ClubAuth.showFeedback('Eliminando tu cuenta…');this.needsLogin=false;
   const token=await this.credentials(uid);
   if(!this.recent(token)){this.needsLogin=true;throw Error('Por seguridad, cierra sesión y vuelve a entrar con tu correo o Google. Después pulsa de nuevo Eliminar mi cuenta.');}
   // The marker and profile removal are atomic. Old tokens cannot recreate the profile.
   if(!await this.check(uid)){
    const root=`projects/${ClubAccess.project}/databases/(default)/documents`,{response}=await this.http(this.base()+':commit',token,{writes:[
     {update:{name:root+'/clubDeletedAccounts/'+uid,fields:{}},currentDocument:{exists:false},updateTransforms:[{fieldPath:'requestedAt',setToServerValue:'REQUEST_TIME'}]},
     {delete:root+'/clubUsers/'+uid}
    ]});
    if(!response.ok)throw Error('No se pudo iniciar la eliminación. No se ha confirmado el borrado; vuelve a intentarlo.');
   }
   this.pending=true;ClubAccess.profile=null;if(window.ClubRegistration)ClubRegistration.draft={};window.dispatchEvent(new CustomEvent('club-access-state'));
   const {response,result}=await this.http('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+encodeURIComponent(this.apiKey),null,{idToken:token});
   if(!response.ok&&result.error?.message!=='USER_NOT_FOUND'){
    if(/CREDENTIAL_TOO_OLD|INVALID_ID_TOKEN/.test(result.error?.message||'')){this.needsLogin=true;throw Error('Vuelve a iniciar sesión para completar la eliminación de tu cuenta de acceso.');}
    throw Error('Tu perfil se ha borrado, pero falta eliminar tu cuenta de acceso. Pulsa Completar eliminación para volver a intentarlo.');
   }
   try{await ClubAuth.request('logout');}catch{}finally{ClubAuth.update({user:null});this.pending=false;ClubAccess.profile=null;ClubAccess.users=[];}
   ClubAuth.mode='login';ClubAuth.showFeedback('Tu cuenta de CD Menciana se ha eliminado.');window.dispatchEvent(new CustomEvent('club-auth-view'));
  }catch(error){ClubAuth.showFeedback(error.message,true);}
  finally{this.busy=false;ClubAuth.setBusy(false);}
 },
 async admin(uid){
  if(!ClubAccess.administrator())throw Error('Solo el administrador puede eliminar otras cuentas.');
  if(typeof uid!=='string'||!uid||uid.length>128||uid.includes('/')||uid===ClubAuth.user.uid)throw Error('Selecciona otra cuenta del club.');
  const identity=ClubAuth.user.uid,token=await this.credentials(identity);
  let reply;try{reply=await this.http(`https://europe-west1-${ClubAccess.project}.cloudfunctions.net/deleteClubAccount`,token,{data:{uid}});}catch{throw Error('No se pudo conectar con el servicio de borrado. Puede que todavía no esté activado.');}
  const {response,result}=reply;
  if(!response.ok||result.error){
   if(result.error?.status==='FAILED_PRECONDITION')throw Error(result.error.message);
   if(result.error?.status==='PERMISSION_DENIED')throw Error('No tienes permiso para eliminar esta cuenta.');
   if(result.error?.status==='UNAUTHENTICATED')throw Error('Cierra sesión y vuelve a entrar como administrador.');
   if(response.status===404)throw Error('El borrado desde administración todavía no está activado. Contacta con el responsable de la app.');
   throw Error('No se ha confirmado la eliminación. Actualiza el listado y vuelve a intentarlo.');
  }
  if(result.result?.deleted!==true)throw Error('No se ha confirmado la eliminación. Vuelve a intentarlo.');
  if(ClubAuth.user?.uid!==identity)throw Error('La sesión ha cambiado. Actualiza el listado.');
  ClubAccess.users=ClubAccess.users.filter(user=>user.id!==uid);
 }
};
document.addEventListener('click',async event=>{
 if(event.target.closest('[data-delete-account]')){event.preventDefault();await ClubDeletion.own();return;}
 const button=event.target.closest('[data-delete-user]');if(!button||ClubDeletion.busy||!ClubAccess.administrator())return;
 const uid=button.dataset.deleteUser,user=ClubAccess.users.find(user=>user.id===uid);if(!user)return;
 event.preventDefault();ClubDeletion.busy=true;
 try{
  if(!await CDM.confirm('¿Eliminar esta cuenta?',`Se borrarán definitivamente la cuenta de ${user.name||'este usuario'} (${user.email}), sus datos del club y sus accesos. Esta acción no se puede deshacer.`,'Eliminar definitivamente'))return;
  button.disabled=true;const feedback=button.closest('.admin-user')?.querySelector('.role-feedback');if(feedback)feedback.textContent='Eliminando…';
  await ClubDeletion.admin(uid);button.closest('.admin-user')?.remove();
  const list=document.getElementById('club-users');if(list)list.innerHTML=ClubAccess.rows(document.querySelector('[data-user-search]')?.value||'');
 }catch(error){const feedback=button.closest('.admin-user')?.querySelector('.role-feedback');if(feedback){feedback.textContent=error.message;feedback.setAttribute('role','alert');}}
 finally{ClubDeletion.busy=false;button.disabled=false;}
});

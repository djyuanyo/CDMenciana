/* Shared Firebase role transport. Firestore rules enforce every read and write. */
window.ClubAccess={
 project:'barpro-pos-menciana',adminEmail:'juanjocarrillo7@gmail.com',adminUid:'ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',profile:null,error:'',users:[],loading:false,fetching:false,sequence:0,
 roles:{fan:'Aficionado',member:'Socio',player:'Jugador',member_player:'Socio y jugador'},
 enabled(){return !!window.ClubAuth?.firebase();},
 administrator(identity=window.ClubAuth?.user){return !!identity&&identity.uid===this.adminUid&&identity.email.toLowerCase()===this.adminEmail&&!window.ClubDeletion?.pending;},
 user(){const identity=window.ClubAuth?.user;if(!identity)return null;const role=this.profile?.id===identity.uid?this.profile.role:'fan';return {...identity,id:identity.uid,active:(this.administrator(identity)||!!window.ClubRegistration?.complete(this.profile))&&!window.ClubDeletion?.pending,admin:this.administrator(identity),member:!window.ClubDeletion?.pending&&['member','member_player'].includes(role),player:!window.ClubDeletion?.pending&&['player','member_player'].includes(role),role,number:'',paid:false};},
 async request(path,{method='GET',fields=null,missing=false}={}){
  const identity=ClubAuth.user;if(!identity)throw Error('Inicia sesión para continuar.');
  const credentials=await ClubAuth.request('token');
  if(!credentials.token||ClubAuth.user?.uid!==identity.uid||credentials.user?.uid!==identity.uid)throw Error('La sesión ha cambiado. Vuelve a intentarlo.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch(`https://firestore.googleapis.com/v1/projects/${this.project}/databases/(default)/documents/clubUsers${path}`,{method,headers:{Authorization:'Bearer '+credentials.token,'Content-Type':'application/json'},body:fields?JSON.stringify({fields:Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,{stringValue:value}]))}):undefined,signal:controller.signal,cache:'no-store'});
   const result=await response.json();
   if(ClubAuth.user?.uid!==identity.uid)throw Error('La sesión ha cambiado. Vuelve a intentarlo.');
   if(response.status===404&&missing&&result.error?.status==='NOT_FOUND'&&/^Document .*not found/i.test(result.error?.message||''))return null;
   if(!response.ok){const error=Error(response.status===403?'No se pudo acceder a los permisos del club. Comprueba que Firebase tenga activadas las reglas de la app.':response.status===404?'La base de datos del club todavía no está activada.':response.status===409||response.status===412?'Los datos han cambiado. Actualiza el listado y vuelve a intentarlo.':'No se pudo conectar con los permisos del club. Vuelve a intentarlo.');error.status=response.status;throw error;}
   return result;
  }catch(error){if(error.name==='AbortError')throw Error('La conexión está tardando demasiado. Vuelve a intentarlo.');throw error;}
  finally{clearTimeout(timeout);}
 },
 decode(document){const fields=document.fields||{},role=fields.role?.stringValue||'fan';if(!Object.hasOwn(this.roles,role))throw Error('Permisos de usuario no válidos.');return {id:document.name.split('/').pop(),...Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,value.stringValue||''])),role};},
 async sync(){
  const sequence=++this.sequence,identity=ClubAuth.user;this.profile=null;this.users=[];this.error='';
  this.fetching=!!identity&&this.enabled();if(window.ClubDeletion)ClubDeletion.pending=false;
  if(!identity||!this.enabled()){window.dispatchEvent(new CustomEvent('club-access-state'));return;}
  try{
   if(window.ClubDeletion){const pending=await ClubDeletion.check(identity.uid);if(sequence!==this.sequence||ClubAuth.user?.uid!==identity.uid)return;ClubDeletion.pending=pending;if(pending){this.fetching=false;window.dispatchEvent(new CustomEvent('club-access-state'));return;}}
   const path='/'+encodeURIComponent(identity.uid);let document=await this.request(path,{missing:true});
   if(sequence===this.sequence&&ClubAuth.user?.uid===identity.uid)this.profile=document?this.decode(document):null;
  }catch(error){if(sequence===this.sequence)this.error=error.message;}
  if(sequence===this.sequence){this.fetching=false;window.dispatchEvent(new CustomEvent('club-access-state'));}
 },
 async saveRegistration(value){
  const identity=ClubAuth.user;if(!identity)throw Error('Inicia sesión para continuar.');
  const fields={...value,email:identity.email,role:this.profile?.role||'fan'};
  const document=await this.request('/'+encodeURIComponent(identity.uid),{method:'PATCH',fields});
  this.profile=this.decode(document);this.error='';this.fetching=false;window.dispatchEvent(new CustomEvent('club-access-state'));
 },
 async list(){
  if(!this.administrator())throw Error('Solo el administrador puede gestionar usuarios.');
  const identity=ClubAuth.user.uid;let token='',rows=[];
  do{const data=await this.request('?pageSize=300'+(token?'&pageToken='+encodeURIComponent(token):''));rows.push(...(data.documents||[]).map(document=>this.decode(document)));token=data.nextPageToken||'';}while(token);
  if(ClubAuth.user?.uid!==identity)throw Error('La sesión ha cambiado.');
  this.users=rows.sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email,'es',{sensitivity:'base'}));return this.users;
 },
 async setRole(id,role){
  if(!this.administrator())throw Error('Solo el administrador puede gestionar usuarios.');
  if(!Object.hasOwn(this.roles,role)||typeof id!=='string'||!id||id.length>128||id.includes('/')||id===ClubAuth.user.uid)throw Error('Elige un usuario y un rol válidos.');
  const result=await this.request('/'+encodeURIComponent(id)+'?updateMask.fieldPaths=role&currentDocument.exists=true',{method:'PATCH',fields:{role}});
  const row=this.decode(result),index=this.users.findIndex(user=>user.id===id);if(index>=0)this.users[index]=row;return row;
 },
 rows(query=''){
  const E=value=>ClubAuth.escape(value),match=query.trim().toLocaleLowerCase('es'),rows=this.users.filter(user=>(user.name+' '+user.email).toLocaleLowerCase('es').includes(match));
  return rows.length?rows.map(user=>`<article class="card admin-user"><div class="admin-user-heading"><span class="admin-avatar">${E((user.name||user.email).slice(0,1).toUpperCase())}</span><div><h3>${E(user.name||'Usuario del club')}</h3><p>${E(user.email)}</p><p>${E(({team:'Jugador/Cuerpo Técnico',member:'Socio',fan:'Aficionado'})[user.registrationType]||'Registro pendiente')}${user.memberNumber?' · Nº '+E(user.memberNumber):''}${user.category?' · '+E(user.category):''}${user.teamRole?' · '+E(user.teamRole==='player'?'Jugador':'Cuerpo Técnico'):''}${user.birthDate?' · Nacimiento: '+E(user.birthDate):''}</p></div></div>${user.email.toLowerCase()===this.adminEmail?'<span class="badge">Administrador</span>':`<form data-club-role="${E(user.id)}"><label>Acceso al club<select name="role">${Object.entries(this.roles).map(([role,label])=>`<option value="${role}"${role===user.role?' selected':''}>${label}</option>`).join('')}</select></label><button type="submit">Guardar rol</button><p class="role-feedback" role="status" aria-live="polite"></p></form><button type="button" data-delete-user="${E(user.id)}" class="account-danger">Eliminar cuenta</button>`}</article>`).join(''):CDM.empty(match?'No hay coincidencias':'Todavía no hay usuarios',match?'Prueba otro nombre o correo.':'Las cuentas aparecerán aquí cuando inicien sesión en esta versión de la app.','user');
 },
 screen(){
  if(!this.administrator())return CDM.empty('Acceso de administrador','Inicia sesión con la cuenta de administración del club.','lock');
  return `<div class="section-heading"><h2>Panel de control</h2><button type="button" class="text-action" data-reload-users>Actualizar</button></div>${window.ClubNotifications?ClubNotifications.screen():''}<section class="card admin-summary"><span class="badge">ADMINISTRADOR</span><h3>Usuarios del club</h3><p>Asigna cada cuenta como aficionado, socio o jugador. También puedes combinar socio y jugador, o eliminar una cuenta con confirmación.</p><label>Buscar usuario<input type="search" data-user-search placeholder="Nombre o correo" autocomplete="off"></label></section><div id="club-users" aria-live="polite">${this.loading?'<section class="card"><p role="status">Cargando usuarios…</p></section>':this.error?`<section class="card"><p role="alert">${ClubAuth.escape(this.error)}</p><button type="button" data-reload-users>Reintentar</button></section>`:this.rows()}</div>`;
 }
};

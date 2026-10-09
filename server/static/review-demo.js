/* Explicit review sandbox. No production administrator rights are granted.
 * State is synthetic, memory-only and discarded on sign-out. Backend rules stay unchanged. */
(()=>{
 const reviewUid="f6szrG8lC4ZL8o15jz221LUpwOH2",reviewEmail="yuanyodesign+cdmenciana-play-v100@gmail.com";
 const D=window.ClubReviewDemo={
  active(identity=window.ClubAuth?.user){return !!identity&&identity.uid===reviewUid&&identity.email?.toLowerCase()===reviewEmail&&!window.ClubDeletion?.pending;},
  users:[],teams:[],messages:new Map(),job:null,
  reset(){this.users=[{id:'demo-member',name:'Socio de demostración',email:'socio@example.test',role:'member',registrationType:'member',memberNumber:'DEMO-001'},{id:'demo-player',name:'Jugador de demostración',email:'jugador@example.test',role:'player',registrationType:'team',category:'Primer Equipo',teamRole:'player'}];this.teams=[{key:'first',label:'Primer Equipo',team_id:'1001',order:1},{key:'filial',label:'Filial Senior',team_id:'1002',order:2},{key:'infantil',label:'Infantil',team_id:'1003',order:3},{key:'rfaf_9000_9001',label:'Equipo de demostración',team_id:'1004',order:4}].map(t=>({...t,competition:'Competición ficticia',group:'Grupo de demostración'}));this.messages=new Map();this.job=null;},
  banner:'<section class="card" role="status"><span class="badge">DEMOSTRACIÓN</span><h3>Panel con datos ficticios</h3><p>No modifica los equipos ni las cuentas del club. No publica imágenes ni envía notificaciones a móviles. Los cambios de esta demostración se borran al cerrar sesión.</p></section>',
  async http(path,p){
   if(!this.active())throw Error('La sesión de demostración ha terminado.');
   if(path==='/images'){if(typeof p.base64!=='string'||p.base64.length>400000)throw Error('Imagen no válida.');return {imageUrl:'data:image/jpeg;base64,'+p.base64};}
   if(path==='/teams')return {teams:this.teams,revision:'demo',job:this.job};
   if(path==='/teams/preview'){
    let url;try{url=new URL(p.source);}catch{throw Error('Introduce un enlace de calendario RFAF.');}
    if(url.protocol!=='https:'||url.hostname!=='www.rfaf.es')throw Error('Introduce un enlace de calendario RFAF.');
    this.job={id:p.id,source:p.source,status:'preview_ready',preview:{competition:'Competición ficticia · Demostración',group:'Grupo de prueba',season:'2026-2027',team_count:8,round_count:14,has_byes:false,candidates:[{team_id:'1005',team_name:'CD Menciana · equipo ficticio'}]}};return {job:this.job};
   }
   if(path==='/teams/import'){
    if(!this.job||p.id!==this.job.id||p.teamId!=='1005'||!String(p.label||'').trim())throw Error('Consulta primero un calendario y elige el equipo.');
    const key='rfaf_9000_9002';if(!this.teams.some(t=>t.key===key))this.teams.push({key,team_id:'1005',label:String(p.label).slice(0,80),order:Number(p.order)||5,competition:'Competición ficticia',group:'Grupo de prueba'});
    this.job={...this.job,status:'complete',teamKey:key};return {job:this.job};
   }
   if(path==='/teams/update'||path==='/teams/delete'){
    const row=this.teams.find(t=>t.key===p.key);if(!row)throw Error('Equipo ficticio no encontrado.');
    if(path.endsWith('delete')){if(!p.key.startsWith('rfaf_'))throw Error('Los equipos base no se eliminan.');this.teams=this.teams.filter(t=>t!==row);}
    else{if(!String(p.label||'').trim())throw Error('Escribe un nombre.');row.label=String(p.label).slice(0,80);row.order=Number(p.order)||1;}
    this.teams.sort((a,b)=>a.order-b.order);this.teams.forEach((t,i)=>t.order=i+1);return {revision:'demo'};
   }
   if(path==='/messages'){
    const prior=this.messages.get(p.id);if(prior)return prior;
    const row={...p,status:p.mode==='scheduled'?'scheduled':'sent',revision:1,createdAt:Date.now(),acceptedCount:0,demo:true};this.messages.set(p.id,row);return row;
   }
   const match=/^\/messages\/([a-f0-9]{32})\/(edit|cancel|retry)$/.exec(path);
   if(match){const row=this.messages.get(match[1]);if(!row)throw Error('Aviso ficticio no encontrado.');
    if(match[2]!=='retry'&&(row.status!=='scheduled'||Number(p.revision)!==row.revision))throw Error('El aviso ha cambiado. Actualiza el historial.');
    if(match[2]==='edit')Object.assign(row,p,{id:match[1],status:'scheduled',revision:row.revision+1});
    if(match[2]==='cancel'){row.status='cancelled';row.revision++;}return row;
   }
   throw Error('Esta operación no está disponible en la demostración.');
  },
  history(){
   const target=document.querySelector('[data-notification-history-list]');if(!target)return;
   const E=ClubAuth.escape.bind(ClubAuth);ClubNotifications.historyRows=new Map(this.messages);
   target.innerHTML=[...this.messages.values()].reverse().map(v=>`<article class="notification-history-item"><strong>${E(v.title)}</strong><p>${E(v.body)}</p><small>Demostración · ${E({sent:'Envío simulado · ningún móvil',scheduled:'Programado de prueba',cancelled:'Eliminado'}[v.status])} · ${E(new Date(v.scheduledAt||v.createdAt).toLocaleString('es-ES'))}</small>${v.status==='scheduled'?`<div class="notification-actions"><button type="button" data-notification-edit="${E(v.id)}">Editar</button><button type="button" data-notification-cancel="${E(v.id)}">Eliminar</button></div><div data-notification-cancel-prompt hidden><p>¿Eliminar este aviso ficticio?</p><button type="button" data-notification-cancel-confirm="${E(v.id)}">Eliminar aviso</button><button type="button" data-notification-cancel-close>Volver</button></div>`:''}</article>`).join('')||'<p>No hay avisos de demostración todavía.</p>';
  }
 };D.reset();
 const wrap=(object,name,handler)=>{const original=object[name];object[name]=function(...args){return D.active()?handler.apply(this,args):original.apply(this,args);};};
 const originalAdministrator=ClubAccess.administrator;
 ClubAccess.administrator=function(identity=window.ClubAuth?.user){return originalAdministrator.call(this,identity)||D.active(identity);};
 const accessScreen=ClubAccess.screen;
 wrap(ClubAccess,'screen',function(section){return D.banner+accessScreen.call(this,section);});
 // Keep own-profile transport intact, but block privileged Firestore access in the sandbox.
 const request=ClubAccess.request;
 wrap(ClubAccess,'request',function(path,options){if(path.split('?')[0]!=='/'+encodeURIComponent(reviewUid)&&!path.split('?')[0].startsWith('/'+encodeURIComponent(reviewUid)+'/'))throw Error('La demostración no accede a datos de otras cuentas.');return request.call(this,path,options);});
 wrap(ClubAccess,'list',async function(){this.users=D.users;return this.users;});
 wrap(ClubAccess,'setRole',async function(id,role){const row=D.users.find(u=>u.id===id);if(!row||!Object.hasOwn(this.roles,role))throw Error('Elige un usuario ficticio y un rol válido.');row.role=role;this.users=D.users;return row;});
 wrap(ClubDeletion,'admin',async function(id){if(!D.users.some(u=>u.id===id))throw Error('Elige un usuario ficticio.');D.users=D.users.filter(u=>u.id!==id);ClubAccess.users=D.users;});
 wrap(ClubNotifications,'service',async()=> 'demonstration');
 const notificationHttp=ClubNotifications.http;
 ClubNotifications.http=function(path,payload){return D.active()||payload?.demo===true?D.http(path,payload):notificationHttp.call(this,path,payload);};
 const prepare=ClubNotifications.prepare;
 wrap(ClubNotifications,'prepare',async function(...args){const result=await prepare.apply(this,args);if(!D.active())throw Error('La sesión de demostración ha terminado.');return {...result,demo:true};});
 wrap(ClubNotifications,'history',async()=>D.history());
 const message=ClubNotifications.message;
 wrap(ClubNotifications,'message',function(result){return result.status==='sent'?'Demostración: envío simulado. No se ha enviado a ningún móvil.':'Demostración: '+message.call(this,result);});
 const notificationScreen=ClubNotifications.screen;
 wrap(ClubNotifications,'screen',function(view){return notificationScreen.call(this,view).replace('La imagen se guardará públicamente en GitHub. Evita incluir datos privados.','La imagen se usa solo en esta demostración y no se publica.').replace('El envío inmediato se inicia al pulsar el botón. La recepción depende de la conexión y de los permisos del móvil. Los programados se revisan cada minuto.','Los avisos son ficticios; puedes probar su creación, programación, edición y eliminación. No se envían a móviles.');});
 wrap(ClubTeams,'refreshNow',async function(){clearTimeout(this.timer);this.rows=D.teams;this.revision='demo';this.job=D.job;this.paint();});
 wrap(ClubTeams,'preview',async function(source,retry=false){const result=await D.http('/teams/preview',{id:retry?D.job?.id:ClubNotifications.id(),source});this.job=result.job;await this.refresh();this.say('Demostración: calendario ficticio preparado. No se ha consultado ni modificado RFAF.');});
 wrap(ClubTeams,'add',async function(values){await D.http('/teams/import',{id:D.job?.id,teamId:values.teamId,label:values.label,order:Number(values.order)});await this.refresh();this.say('Equipo ficticio añadido a la demostración.');});
 wrap(ClubTeams,'remove',async function(key){await D.http('/teams/delete',{key});if(D.job?.teamKey===key)D.job=null;await this.refresh();this.say('Equipo ficticio eliminado.');});
 let wasActive=false,productionRows=null;
 window.addEventListener('club-auth-state',()=>{
  const active=D.active();if(active&&!wasActive){productionRows=ClubTeams.rows;D.reset();}
  if(!active&&wasActive){D.reset();ClubAccess.users=[];ClubTeams.rows=productionRows||[];ClubTeams.job=null;ClubTeams.revision='';ClubNotifications.pending=null;ClubNotifications.historyRows.clear();}
  wasActive=active;
 });
})();

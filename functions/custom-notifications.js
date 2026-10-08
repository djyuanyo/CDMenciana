'use strict';
const {createHash}=require('node:crypto');
const ADMIN='ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',EMAIL='juanjocarrillo7@gmail.com';
const TEAMS={first:'2137495',filial:'48536795'};
function validRequest(v){return v.createdBy===ADMIN&&['all','first','filial'].includes(v.teamKey)&&typeof v.title==='string'&&v.title.trim().length>0&&v.title.length<=100&&typeof v.body==='string'&&v.body.trim().length>0&&v.body.length<=500&&typeof v.createdAt?.toMillis==='function';}
function subscribed(v,rows){return v.teamKey==='all'||rows.some(f=>f.teamKey===v.teamKey&&f.teamId===TEAMS[v.teamKey]);}
async function processCustom({db,auth,messaging,Timestamp,now=Date.now}){
 const pending=await db.collection('clubNotificationRequests').where('status','==','pending').limit(50).get();
 console.log('Solicitudes pendientes: '+pending.docs.length);
 if(pending.empty)return;
 const owner=await auth.getUser(ADMIN);if(owner.disabled||owner.email?.toLowerCase()!==EMAIL)throw Error('Administrator unavailable');
 for(const request of pending.docs){
  const v=request.data();if(!validRequest(v)){await request.ref.update({status:'invalid'});continue;}
  const eventId=createHash('sha256').update('custom|'+request.id).digest('hex');let retry=false,accepted=0;
  const devices=await db.collectionGroup('devices').get();
  for(const device of devices.docs){
   const uid=device.ref.parent.parent.id,ref=db.collection('clubCustomDeliveries').doc(request.id+'_'+uid+'_'+device.id);let claimed=false;
   await db.runTransaction(async tx=>{const s=await tx.get(ref),d=s.exists?s.data():null;if(['sent','skipped','invalid'].includes(d?.status)||d?.leaseUntil>now())return;tx.set(ref,{status:'sending',leaseUntil:now()+120000});claimed=true;});
   if(!claimed){const d=await ref.get();if(d.data()?.status==='sending')retry=true;continue;}
   const [current,profile,marker,favorites]=await Promise.all([device.ref.get(),db.collection('clubUsers').doc(uid).get(),db.collection('clubDeletedAccounts').doc(uid).get(),v.teamKey==='all'?Promise.resolve({docs:[]}):db.collection('clubUsers').doc(uid).collection('favorites').get()]);
   let account;try{account=await auth.getUser(uid);}catch{}
   const d=current.exists?current.data():null,ready=uid===ADMIN||profile.exists&&profile.data().registrationComplete==='true';
   if(!account||account.disabled||marker.exists||!ready||!d||d.uid!==uid||!d.enabled||typeof d.token!=='string'||d.token.length<20||!subscribed(v,favorites.docs.map(f=>f.data()))){await ref.set({status:'skipped'});continue;}
   try{await messaging.send({token:d.token,data:{uid,eventId,teamKey:v.teamKey,acta:'',title:v.title,body:v.body,type:'custom'},android:{priority:'high',ttl:3600000}});await ref.set({requestId:request.id,status:'sent',sentAt:Timestamp.fromMillis(now())});accepted++;}
   catch(e){if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(e.code)){await device.ref.delete();await ref.set({status:'invalid'});}else{await ref.set({status:'retry',leaseUntil:0});retry=true;}}
  }
  if(!retry)await request.ref.update({status:'sent',processedAt:Timestamp.fromMillis(now())});
  console.log('Aviso procesado; entregas aceptadas: '+accepted+'; reintento: '+retry);
 }
}
module.exports={validRequest,subscribed,processCustom};

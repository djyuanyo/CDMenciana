'use strict';
const {createHash}=require('node:crypto');
const ADMIN='ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',EMAIL='juanjocarrillo7@gmail.com';
const TEAMS={first:'2137495',filial:'48536795',infantil:'34369965'};
function validRequest(v,teams=TEAMS){return v.createdBy===ADMIN&&(v.teamKey==='all'||Object.hasOwn(teams,v.teamKey))&&typeof v.title==='string'&&v.title.trim().length>0&&v.title.length<=100&&typeof v.body==='string'&&v.body.trim().length>0&&v.body.length<=500&&typeof v.createdAt?.toMillis==='function'&&(v.scheduledAt===undefined||typeof v.scheduledAt?.toMillis==='function')&&(v.imageUrl===undefined||validImage(v.imageUrl))&&(v.newsSlug===undefined||/^[a-z0-9][a-z0-9-]{0,199}$/.test(v.newsSlug));}
function validImage(url){return typeof url==='string'&&/^https:\/\/cms\.cdmenciana\.es\/media\/[a-f0-9-]{36}\/(web|thumb)$/.test(url)||url===''||typeof url==='string'&&/^https:\/\/raw\.githubusercontent\.com\/djyuanyo\/CDMenciana\/main\/notification-images\/[a-f0-9]{32}\.jpg$/.test(url);}
function subscribed(v,rows,teams=TEAMS){return v.teamKey==='all'||rows.some(f=>f.teamKey===v.teamKey&&f.teamId===teams[v.teamKey]);}
async function processCustom({db,auth,messaging,Timestamp,now=Date.now,requestId,deviceDocs,finalize=true}){
 const pending=requestId?{docs:[await db.collection('clubNotificationRequests').doc(requestId).get()]}:await db.collection('clubNotificationRequests').where('status','==','pending').limit(50).get();
 const summary={accepted:0,retry:false};
 console.log('Solicitudes pendientes: '+pending.docs.length);
 if(pending.empty)return summary;
 const owner=await auth.getUser(ADMIN);if(owner.disabled||owner.email?.toLowerCase()!==EMAIL)throw Error('Administrator unavailable');
 for(const request of pending.docs){
  if(!request.exists&&request.exists!==undefined)continue;
  const v=request.data();if(!['pending','scheduled','sending'].includes(v.status)||v.scheduledAt?.toMillis()>now())continue;
  let teams=TEAMS;if(v.teamKey!=='all'&&!Object.hasOwn(TEAMS,v.teamKey)){if(!require('./team-catalog').validKey(v.teamKey)){await request.ref.update({status:'invalid'});continue;}const configured=await db.collection('clubTeams').doc(v.teamKey).get(),t=configured.data();if(configured.exists&&t.status==='active'&&/^\d{1,12}$/.test(t.teamId||''))teams={...TEAMS,[v.teamKey]:t.teamId};}
  if(!validRequest(v,teams)){await request.ref.update({status:'invalid'});continue;}
  const eventId=createHash('sha256').update('custom|'+request.id).digest('hex');let retry=false,accepted=0;
  const devices=deviceDocs?{docs:deviceDocs}:await db.collectionGroup('devices').get();
  for(const device of devices.docs){
   const uid=device.ref.parent.parent.id,ref=db.collection('clubCustomDeliveries').doc(request.id+'_'+uid+'_'+device.id);let claimed=false;
   await db.runTransaction(async tx=>{claimed=false;const s=await tx.get(ref),d=s.exists?s.data():null;if(['sent','skipped','invalid'].includes(d?.status)||d?.leaseUntil>now())return;tx.set(ref,{status:'sending',leaseUntil:now()+120000});claimed=true;});
   if(!claimed){const d=await ref.get();if(d.data()?.status==='sent')accepted++;else if(d.data()?.status==='sending'||d.data()?.status==='retry')retry=true;continue;}
   const [current,profile,marker,favorites]=await Promise.all([device.ref.get(),db.collection('clubUsers').doc(uid).get(),db.collection('clubDeletedAccounts').doc(uid).get(),v.teamKey==='all'?Promise.resolve({docs:[]}):db.collection('clubUsers').doc(uid).collection('favorites').get()]);
   let account;try{account=await auth.getUser(uid);}catch(e){if(e.code!=='auth/user-not-found'){await ref.set({status:'retry',leaseUntil:0});retry=true;continue;}}
   const d=current.exists?current.data():null,ready=uid===ADMIN||profile.exists&&profile.data().registrationComplete==='true';
   if(!account||account.disabled||marker.exists||!ready||!d||d.uid!==uid||!d.enabled||typeof d.token!=='string'||d.token.length<20||!subscribed(v,favorites.docs.map(f=>f.data()),teams)){await ref.set({status:'skipped'});continue;}
   try{await messaging.send({token:d.token,data:{uid,eventId,teamKey:v.teamKey,acta:'',title:v.title,body:v.body,type:'custom',imageUrl:v.imageUrl||'',newsSlug:v.newsSlug||''},android:{priority:'high',ttl:3600000}});await ref.set({requestId:request.id,status:'sent',sentAt:Timestamp.fromMillis(now())});accepted++;}
   catch(e){if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(e.code)){await device.ref.delete();await ref.set({status:'invalid'});}else{await ref.set({status:'retry',leaseUntil:0});retry=true;}}
  }
  if(finalize&&!retry)await request.ref.update({status:'sent',acceptedCount:accepted,processedAt:Timestamp.fromMillis(now())});
  summary.accepted+=accepted;summary.retry ||= retry;
  console.log('Aviso procesado; entregas aceptadas: '+accepted+'; reintento: '+retry);
 }
 return summary;
}
module.exports={validRequest,validImage,subscribed,processCustom};


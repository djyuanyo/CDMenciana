'use strict';
const {createHash}=require('node:crypto');
const GROUPS={first:'fixtures.json',filial:'fixtures-filial.json',infantil:'fixtures-infantil.json'};
function teamId(url){try{const u=new URL(url),id=u.searchParams.get('Codigo_Equipo');return ['rfaf.es','www.rfaf.es'].includes(u.hostname)&&/^\d{1,12}$/.test(id||'')?id:'';}catch{return '';}}
function results(key,feed){
 if(!GROUPS[key]||feed.team_key!==key||!Array.isArray(feed.round_matches)||!Number.isFinite(Date.parse(feed.updated_at)))throw Error('Invalid or stale result feed');
 const unique=new Map();
 for(const m of feed.round_matches){
  if(!/^[\d-]{1,48}$/.test(String(m.id||''))||typeof m.home!=='string'||typeof m.away!=='string')continue;
  let acta='';try{const u=new URL(m.acta_url);if(['www.rfaf.es','rfaf.es'].includes(u.hostname)&&/^\d{1,12}$/.test(u.searchParams.get('CodActa')||''))acta=u.searchParams.get('CodActa');}catch{}
  const id=acta||m.id,homeId=teamId(m.home_team_url),awayId=teamId(m.away_team_url);
  const final=m.played===true&&/^finalizad[oa]$/i.test(m.state||'')&&Number.isSafeInteger(m.home_score)&&m.home_score>=0&&m.home_score<=100&&Number.isSafeInteger(m.away_score)&&m.away_score>=0&&m.away_score<=100;
  unique.set(String(id),{id:String(id),acta,homeId,awayId,home:m.home.slice(0,160),away:m.away.slice(0,160),homeScore:m.home_score??null,awayScore:m.away_score??null,final});
 }
 return [...unique.values()];
}
function transitions(previous,rows){if(!previous)return [];return rows.filter(m=>m.final&&Object.hasOwn(previous,m.id)&&previous[m.id]===false);}
function eventId(key,season,id){return createHash('sha256').update(key+'|'+season+'|'+id).digest('hex');}
const CLUB_TEAMS={first:'2137495',filial:'48536795',infantil:'34369965'};
function eligible(event,favorite,device){return favorite.teamId===CLUB_TEAMS[favorite.teamKey]&&favorite.teamKey===event.teamKey&&[event.homeId,event.awayId].includes(favorite.teamId)&&Number.isFinite(Date.parse(favorite.createdAt))&&Date.parse(favorite.createdAt)<=event.createdAt.toMillis()&&device.enabled===true&&device.uid===favorite.uid&&typeof device.token==='string'&&device.token.length>=20&&device.updatedAt?.toMillis()<=event.createdAt.toMillis();}
function payload(event,uid,token){return {token,data:{uid,eventId:event.eventId,teamKey:event.teamKey,acta:event.acta,title:'Final del partido',body:event.home+' '+event.homeScore+' – '+event.awayScore+' '+event.away},android:{priority:'high',ttl:3600000}};}
async function pollResults({db,auth,messaging,fetchFeed,Timestamp,now=Date.now}){
 const currentTime=now();
 for(const [teamKey,file] of Object.entries(GROUPS)){
  const feed=await fetchFeed(file),rows=results(teamKey,feed),feedTime=Date.parse(feed.updated_at),stateRef=db.collection('clubResultState').doc(teamKey);
  await db.runTransaction(async tx=>{
   const snapshot=await tx.get(stateRef),previous=snapshot.exists?snapshot.data():null;
   if(previous&&feedTime<=previous.feedTime)return;
   const sameSeason=previous?.season===feed.season;
   for(const m of transitions(sameSeason?previous.seen:null,rows)){
    if(previous.announced?.[m.id])continue;
    const id=eventId(teamKey,feed.season,m.id),ref=db.collection('clubResultEvents').doc(id);
    tx.create(ref,{...m,eventId:id,teamKey,previousPollAt:previous.polledAt,createdAt:Timestamp.fromMillis(currentTime)});
   }
   tx.set(stateRef,{seen:Object.fromEntries(rows.map(m=>[m.id,m.final])),announced:{...(sameSeason?previous.announced||{}:{}),...Object.fromEntries(rows.filter(m=>m.final).map(m=>[m.id,true]))},season:feed.season,feedTime,polledAt:currentTime});
  });
 }
 const events=await db.collection('clubResultEvents').where('createdAt','>',Timestamp.fromMillis(currentTime-6*3600000)).limit(200).get();
 await db.collection('clubNotificationConfig').doc('status').set({active:true,updatedAt:Timestamp.fromMillis(currentTime)});
 if(events.empty)return;
 const [favorites,devices]=await Promise.all([db.collectionGroup('favorites').get(),db.collectionGroup('devices').get()]);
 const users=new Map();
 for(const doc of favorites.docs){const uid=doc.ref.parent.parent.id;if(!users.has(uid)){const [profile,marker]=await db.getAll(db.collection('clubUsers').doc(uid),db.collection('clubDeletedAccounts').doc(uid));let account;try{account=await auth.getUser(uid);}catch{}const owner=uid==='ZJeZEjtDeMRCYL0UOuvhGt0gNCT2'&&account?.email?.toLowerCase()==='juanjocarrillo7@gmail.com';users.set(uid,!!account&&!account.disabled&&!marker.exists&&(owner||profile.exists&&profile.data().registrationComplete==='true'));} }
 const byUser=new Map();for(const d of devices.docs){const uid=d.ref.parent.parent.id;if(!byUser.has(uid))byUser.set(uid,[]);byUser.get(uid).push(d);}
 for(const e of events.docs){const event=e.data(),targets=new Map();for(const f of favorites.docs){const uid=f.ref.parent.parent.id;if(!users.get(uid))continue;for(const d of byUser.get(uid)||[])if(eligible(event,{...f.data(),uid},d.data())){const key=uid+'_'+d.id,entry=targets.get(key)||{uid,device:d,favorites:[]};entry.favorites.push(f);targets.set(key,entry);}}
  for(const [target,{uid,device,favorites:subscriptions}] of targets){const ref=db.collection('clubResultDeliveries').doc(e.id+'_'+target);let acquired=false;
   await db.runTransaction(async tx=>{const s=await tx.get(ref),v=s.exists?s.data():null;if(v?.state==='sent'||v?.state==='invalid'||v?.leaseUntil>currentTime)return;tx.set(ref,{state:'sending',leaseUntil:currentTime+120000});acquired=true;});if(!acquired)continue;
   // Recheck revocations/removal after claiming, before sending.
   const [marker,profile,currentDevice,...currentFavorites]=await db.getAll(db.collection('clubDeletedAccounts').doc(uid),db.collection('clubUsers').doc(uid),device.ref,...subscriptions.map(f=>f.ref));if(marker.exists||((!profile.exists||profile.data().registrationComplete!=='true')&&uid!=='ZJeZEjtDeMRCYL0UOuvhGt0gNCT2')||!currentDevice.exists||!currentFavorites.some(f=>f.exists&&eligible(event,{...f.data(),uid},currentDevice.data()))){await ref.set({state:'invalid'});continue;}
   try{await messaging.send(payload(event,uid,currentDevice.data().token));await ref.set({state:'sent',sentAt:Timestamp.fromMillis(currentTime)});}
   catch(error){if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code)){await device.ref.delete();await ref.set({state:'invalid'});}else await ref.set({state:'retry',leaseUntil:0});}
  }
 }
 await db.collection('clubNotificationConfig').doc('status').set({active:true,updatedAt:Timestamp.fromMillis(currentTime)});
}
module.exports={results,transitions,eventId,eligible,payload,pollResults};

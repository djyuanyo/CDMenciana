'use strict';
const {createHash}=require('node:crypto');
const {processCustom,validImage}=require('./custom-notifications');
const ADMIN='ZJeZEjtDeMRCYL0UOuvhGt0gNCT2';
function articles(feed){
 if(!Array.isArray(feed.news)||!Number.isFinite(Date.parse(feed.updated_at)))throw Error('Invalid news feed');
 const rows=new Map();
 for(const item of feed.news){
  const match=typeof item.url==='string'&&item.url.match(/^https:\/\/cdmenciana\.es\/noticias\/([a-z0-9][a-z0-9-]{0,199})\/$/);
  if(!match||typeof item.title!=='string'||!item.title.trim())continue;
  const id=createHash('sha256').update('news|'+match[1]).digest('hex').slice(0,32);
  rows.set(id,{id,newsSlug:match[1],title:item.title.trim().slice(0,100),body:'Nueva noticia del CD Menciana. Pulsa para leerla.',imageUrl:validImage(item.image)?item.image:''});
 }
 return [...rows.values()];
}
function fresh(previous,rows){return previous?rows.filter(row=>!previous[row.id]):[];}
async function pollNews({db,auth,messaging,Timestamp,feed,now=Date.now}){
 const rows=articles(feed),state=db.collection('clubNewsState').doc('news'),time=now(),feedTime=Date.parse(feed.updated_at);
 await db.runTransaction(async tx=>{
  const snapshot=await tx.get(state),old=snapshot.exists?snapshot.data():null;
  if(old&&feedTime<=old.feedTime)return;
  for(const row of fresh(old?.seen,rows)){
   const {id,...content}=row;
   tx.create(db.collection('clubNotificationRequests').doc(id),{...content,createdBy:ADMIN,teamKey:'all',status:'pending',createdAt:Timestamp.fromMillis(time)});
   tx.set(db.collection('clubNotificationSchedule').doc(id),{dueAt:time});
  }
  tx.set(state,{seen:{...(old?.seen||{}),...Object.fromEntries(rows.map(row=>[row.id,true]))},feedTime});
 });
 // The same delivery leases are shared with the Cloudflare retry worker.
 for(const row of rows){
  const ref=db.collection('clubNotificationRequests').doc(row.id),request=await ref.get();
  if(!request.exists||!['pending','sending'].includes(request.data().status)||request.data().createdAt.toMillis()<time-24*3600000)continue;
  const result=await processCustom({db,auth,messaging,Timestamp,requestId:row.id,now});
  if(!result.retry)await db.collection('clubNotificationSchedule').doc(row.id).delete();
 }
}
module.exports={articles,fresh,pollNews};

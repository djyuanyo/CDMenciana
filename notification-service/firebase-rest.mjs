// REST transport keeps Firebase private keys on the server and avoids gRPC.
const PROJECT='barpro-pos-menciana',ROOT=`projects/${PROJECT}/databases/(default)/documents`;
export const Timestamp={fromMillis:ms=>({toMillis:()=>ms})};
export function encode(v){if(v&&typeof v.toMillis==='function')return {timestampValue:new Date(v.toMillis()).toISOString()};if(typeof v==='string')return {stringValue:v};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};throw Error('Unsupported field');}
export function decode(v){if(v.timestampValue)return Timestamp.fromMillis(Date.parse(v.timestampValue));if(v.integerValue!==undefined)return Number(v.integerValue);if(v.doubleValue!==undefined)return v.doubleValue;if(v.booleanValue!==undefined)return v.booleanValue;return v.stringValue;}
export function fields(data){return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)]));}
let cached;
export async function accessToken(env,fetcher=fetch){
 const account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);if(account.project_id!==PROJECT)throw Error('Wrong project');
 if(cached?.email===account.client_email&&cached.until>Date.now()+60000)return cached.token;
 const b64=v=>btoa(typeof v==='string'?v:String.fromCharCode(...new Uint8Array(v))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const epoch=Math.floor(Date.now()/1000),body=b64(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+b64(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/identitytoolkit',aud:'https://oauth2.googleapis.com/token',iat:epoch,exp:epoch+3600}));
 const pem=account.private_key.replace(/-----[^-]+-----|\s/g,''),bytes=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const assertion=body+'.'+b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(body)));
 const r=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
 if(!r.ok)throw Error('Firebase connection unavailable');const data=await r.json();cached={email:account.client_email,token:data.access_token,until:Date.now()+data.expires_in*1000};return data.access_token;
}
export function firebase(env,token,fetcher=fetch){
 async function api(path,body,method=body?'POST':'GET'){
  const r=await fetcher('https://firestore.googleapis.com/v1/'+ROOT+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(r.status===404)return null;if(!r.ok){const e=Error('Firestore unavailable');e.status=r.status;throw e;}return r.status===204?{}:r.json();
 }
 function snapshot(doc,path){return {id:path.split('/').pop(),exists:!!doc,data:()=>Object.fromEntries(Object.entries(doc?.fields||{}).map(([k,v])=>[k,decode(v)])),ref:ref(path)};}
 function write(path,data,merge=false){return {update:{name:ROOT+'/'+path,fields:fields(data)},...(merge?{updateMask:{fieldPaths:Object.keys(data)},currentDocument:{exists:true}}:{})};}
 function ref(path){return {path,id:path.split('/').pop(),parent:{parent:{id:path.split('/')[1]}},get:async()=>snapshot(await api('/'+path),path),set:data=>api(':commit',{writes:[write(path,data)]}),update:data=>api(':commit',{writes:[write(path,data,true)]}),delete:()=>api('/'+path,undefined,'DELETE'),collection:name=>collection(path+'/'+name)};}
 async function query(path,field,op,value,limit=500,group=false){const bits=path.split('/'),collectionId=bits.pop(),parent=bits.length?'/'+bits.join('/'):'';const structuredQuery={from:[{collectionId,allDescendants:group}],limit};if(field)structuredQuery.where={fieldFilter:{field:{fieldPath:field},op:({'==':'EQUAL','<=':'LESS_THAN_OR_EQUAL'})[op],value:encode(value)}};const rows=await api(parent+':runQuery',{structuredQuery});const docs=(rows||[]).filter(r=>r.document).map(r=>snapshot(r.document,r.document.name.slice(ROOT.length+1)));return {docs,empty:!docs.length};}
 function collection(path){return {doc:id=>ref(path+'/'+id),get:()=>query(path),where:(field,op,value)=>({limit:n=>({get:()=>query(path,field,op,value,n)}),get:()=>query(path,field,op,value)})};}
 const db={collection,collectionGroup:name=>({get:()=>query(name,null,null,null,10000,true)}),async runTransaction(fn){
  for(let attempt=0;attempt<3;attempt++){const {transaction}=await api(':beginTransaction',{});const writes=[];try{await fn({get:async r=>snapshot(await api('/'+r.path+'?transaction='+encodeURIComponent(transaction)),r.path),set:(r,d)=>writes.push(write(r.path,d))});if(writes.length)await api(':commit',{transaction,writes});else await api(':rollback',{transaction});return;}catch(e){await api(':rollback',{transaction}).catch(()=>{});if(e.status!==409||attempt===2)throw e;}}
 }};
 const auth={async getUser(uid){const r=await fetcher(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({localId:[uid]})});if(!r.ok)throw Error('Account unavailable');const u=(await r.json()).users?.[0];if(!u)throw Object.assign(Error('Missing account'),{code:'auth/user-not-found'});return {uid:u.localId,email:u.email,disabled:u.disabled===true};}};
 const messaging={async send(value){const message={...value,android:{...value.android,priority:'HIGH',ttl:'3600s'}};const r=await fetcher(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message})});if(!r.ok){const data=await r.json().catch(()=>({})),e=Error('Push unavailable');if(data.error?.details?.some(d=>d.errorCode==='UNREGISTERED'))e.code='messaging/registration-token-not-registered';throw e;}return (await r.json()).name;}};
 return {db,auth,messaging,Timestamp,create:async(path,data)=>api(':commit',{writes:[{...write(path,data),currentDocument:{exists:false}}]})};
}

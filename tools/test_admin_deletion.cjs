const {test}=require('node:test'),assert=require('node:assert/strict');
const {deleteClubAccount}=require('../functions/deletion');
function setup(){
 const events=[],records=new Map([['clubUsers/player',{email:'player@club.test'}]]);
 const users=new Map([['ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',{uid:'ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',email:'juanjocarrillo7@gmail.com',emailVerified:true}],['player',{uid:'player',email:'player@club.test'}]]);
 const claims={uid:'ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',email:'juanjocarrillo7@gmail.com',email_verified:true,auth_time:1000};
 const db={collection:name=>({doc:uid=>({path:name+'/'+uid,get:async()=>({exists:records.has(name+'/'+uid),data:()=>records.get(name+'/'+uid)}),create:async value=>{events.push('block');records.set(name+'/'+uid,value);}})}),recursiveDelete:async ref=>{events.push('profile');records.delete(ref.path);}};
 const auth={verifyIdToken:async(token,revoked)=>{assert.equal(token,'token');assert.equal(revoked,true);return claims;},getUser:async uid=>{if(users.has(uid))return users.get(uid);throw Object.assign(Error('missing'),{code:'auth/user-not-found'});},deleteUser:async uid=>{events.push('auth');users.delete(uid);}};
 const deps={auth,db,timestamp:()=>1000000,now:()=>1001000,fail:(code,message)=>Object.assign(Error(message),{code})};
 return {deps,events,records,users,claims,call:uid=>deleteClubAccount({token:'token',uid},deps)};
}
test('pinned administrator deletes Auth and profile, blocks old sessions first, and supports retries',async()=>{
 const s=setup();assert.deepEqual(await s.call('player'),{deleted:true});assert.deepEqual(s.events,['block','auth','profile']);assert(!s.users.has('player'));assert(!s.records.has('clubUsers/player'));assert(s.records.has('clubDeletedAccounts/player'));assert.deepEqual(await s.call('player'),{deleted:true});
});
test('rejects fans, spoofed and revoked sessions, own admin and other app accounts',async()=>{
 for(const patch of [{email:'fan@club.test'},{uid:'impostor'},{auth_time:0}]){const s=setup();Object.assign(s.claims,patch);await assert.rejects(s.call('player'));assert.deepEqual(s.events,[]);}
 for(const uid of ['ZJeZEjtDeMRCYL0UOuvhGt0gNCT2','../owner','other-pos-user']){const s=setup();await assert.rejects(s.call(uid));assert.deepEqual(s.events,[]);}
 const s=setup();s.deps.auth.verifyIdToken=async()=>{throw Error('revoked');};await assert.rejects(s.call('player'),{code:'unauthenticated'});
 const t=setup();t.users.get('ZJeZEjtDeMRCYL0UOuvhGt0gNCT2').emailVerified=false;t.claims.email_verified=false;assert.deepEqual(await t.call('player'),{deleted:true});
 const v=setup();v.records.set('clubDeletedAccounts/ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',{requestedAt:1});await assert.rejects(v.call('player'),{code:'permission-denied'});
});
test('Auth failure preserves profile for retry, cleanup failure never claims success',async()=>{
 const s=setup();s.deps.auth.deleteUser=async()=>{throw Error('offline');};await assert.rejects(s.call('player'));assert(s.records.has('clubUsers/player'));assert(s.records.has('clubDeletedAccounts/player'));
 const t=setup();t.deps.db.recursiveDelete=async()=>{throw Error('offline');};await assert.rejects(t.call('player'));assert(!t.users.has('player'));assert(t.records.has('clubUsers/player'));
});

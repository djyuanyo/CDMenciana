const fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,collection,updateDoc,deleteDoc}=require('firebase/firestore');
async function run(){
 const env=await initializeTestEnvironment({projectId:'demo-cdmenciana',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 try{
  const fan=env.authenticatedContext('fan',{email:'fan@club.test',email_verified:true}).firestore();
  const owner=env.authenticatedContext('owner',{email:'juanjocarrillo7@gmail.com',email_verified:true}).firestore();
  const unverified=env.authenticatedContext('owner',{email:'juanjocarrillo7@gmail.com',email_verified:false}).firestore();
  const anonymous=env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(fan,'clubUsers/fan'),{name:'Fan',email:'fan@club.test',role:'fan'}));
  await assertSucceeds(getDoc(doc(fan,'clubUsers/fan')));
  await assertFails(setDoc(doc(fan,'clubUsers/another'),{name:'Forged',email:'fan@club.test',role:'fan'}));
  await assertFails(updateDoc(doc(fan,'clubUsers/fan'),{role:'member'}));
  await assertFails(updateDoc(doc(fan,'clubUsers/fan'),{admin:true}));
  await assertFails(updateDoc(doc(fan,'clubUsers/fan'),{email:'juanjocarrillo7@gmail.com'}));
  await assertFails(getDocs(collection(fan,'clubUsers')));
  await assertFails(getDoc(doc(unverified,'clubUsers/fan')));
  await assertFails(getDocs(collection(unverified,'clubUsers')));
  await assertFails(getDoc(doc(anonymous,'clubUsers/fan')));
  await assertSucceeds(getDocs(collection(owner,'clubUsers')));
  await assertSucceeds(updateDoc(doc(owner,'clubUsers/fan'),{role:'member_player'}));
  await assertFails(updateDoc(doc(owner,'clubUsers/fan'),{role:'admin'}));
  await assertFails(updateDoc(doc(owner,'clubUsers/fan'),{name:'Changed identity'}));
  await assertFails(deleteDoc(doc(owner,'clubUsers/fan')));
  await assertSucceeds(setDoc(doc(owner,'clubUsers/owner'),{name:'Owner',email:'juanjocarrillo7@gmail.com',role:'fan'}));
  await assertFails(updateDoc(doc(owner,'clubUsers/owner'),{role:'player'}));
  await assertFails(getDoc(doc(owner,'posUsers/another-app')));
  console.log('Firestore: only verified owner lists and changes roles; self-escalation, identity spoofing, deletion and other collections denied.');
 }finally{await env.cleanup();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});

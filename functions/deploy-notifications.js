'use strict';
const fs=require('node:fs'),{createHash}=require('node:crypto');
const {applicationDefault}=require('firebase-admin/app');
const project='barpro-pos-menciana';
async function main(){
 const credentials=applicationDefault(),token=(await credentials.getAccessToken()).access_token;
 async function api(path,method='GET',body){const r=await fetch('https://firebaserules.googleapis.com/v1/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('Rules API failed '+r.status);return r.json();}
 const release=await api('projects/'+project+'/releases/cloud.firestore'),current=await api(release.rulesetName);
 const source=fs.readFileSync('firestore.rules','utf8'),previous=current.source.files.find(f=>f.name==='firestore.rules')?.content||current.source.files[0]?.content;
 const hash=s=>createHash('sha256').update(s.replace(/\s/g,'')).digest('hex');
 if(hash(previous)!==hash(source)&&hash(previous)!=='fee1dde2e56dcf8d4ce3ea882f6d49252e8394995994c70ecba5a15b7723f9ee')throw Error('Live rules differ from the previously verified club rules; preserving the existing rules');
 if(hash(previous)===hash(source)){console.log('Reglas ya actualizadas.');return;}
 const ruleset=await api('projects/'+project+'/rulesets','POST',{source:{files:[{name:'firestore.rules',content:source}]}});
 await api('projects/'+project+'/releases/cloud.firestore','PATCH',{release:{name:'projects/'+project+'/releases/cloud.firestore',rulesetName:ruleset.name},updateMask:'rulesetName'});
 console.log('Reglas de favoritos del club y avisos del administrador publicadas.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

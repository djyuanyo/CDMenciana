'use strict';
// A trusted GitHub Actions runner can send FCM without deploying Cloud Functions.
const fs = require('node:fs');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { processCustom } = require('./custom-notifications');
const { pollNews } = require('./news-notifications');
const { pollResults } = require('./results');

async function main() {
  const projectId = 'barpro-pos-menciana';
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path || JSON.parse(fs.readFileSync(path, 'utf8')).project_id !== projectId) {
    throw Error('Configure the CDM_FIREBASE_SERVICE_ACCOUNT secret for the club Firebase project');
  }
  initializeApp({ credential: applicationDefault(), projectId });
  if(process.argv.includes('--news')) { await pollNews({db:getFirestore(),auth:getAuth(),messaging:getMessaging(),Timestamp,feed:JSON.parse(fs.readFileSync('data/news.json','utf8'))});return; }
  if(process.argv.includes('--custom')) { await processCustom({db:getFirestore(),auth:getAuth(),messaging:getMessaging(),Timestamp});console.log('Cola de avisos procesada.');return; }
  await pollResults({ teams:require('./team-catalog').parseCatalog(JSON.parse(fs.readFileSync('data/club-teams.json','utf8'))), db: getFirestore(), auth: getAuth(), messaging: getMessaging(), Timestamp,
    fetchFeed: async file => {
      const response = await fetch('https://raw.githubusercontent.com/djyuanyo/CDMenciana/main/data/' + file,
        { signal: AbortSignal.timeout(20000), cache: 'no-store' });
      if (!response.ok) throw Error('Official result feed unavailable');
      return response.json();
    }
  });
  console.log('Consulta de resultados completada.');
}
main().catch(() => {
  // Never include credentials, Firebase user records or push tokens in public CI logs.
  console.error('No se completó el envío. Comprueba la conexión segura con Firebase y los datos RFAF.');
  process.exitCode = 1;
});

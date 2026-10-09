'use strict';
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { deleteClubAccount } = require('./deletion');
initializeApp();

exports.deleteClubAccount = onCall({ region: 'europe-west1', maxInstances: 2, timeoutSeconds: 60 }, async request => {
  const header = request.rawRequest.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    return await deleteClubAccount({ token, uid: request.data?.uid }, {
      auth: getAuth(), db: getFirestore(), timestamp: () => FieldValue.serverTimestamp(),
      fail: (code, message) => new HttpsError(code, message)
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    // Do not include tokens or personal data in client errors.
    throw new HttpsError('unavailable', 'No se ha confirmado el borrado. Actualiza el listado y vuelve a intentarlo.');
  }
});

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getMessaging } = require('firebase-admin/messaging');
const { Timestamp } = require('firebase-admin/firestore');
const { pollResults } = require('./results');
exports.notifyFavoriteResults = onSchedule({ schedule: 'every 5 minutes', timeZone: 'Europe/Madrid', region: 'europe-west1', maxInstances: 1, timeoutSeconds: 240, memory: '256MiB', retryCount: 2 }, async () => {
  const catalogResponse=await fetch('https://raw.githubusercontent.com/djyuanyo/CDMenciana/main/data/club-teams.json',{signal:AbortSignal.timeout(20000),cache:'no-store'});if(!catalogResponse.ok)throw Error('Club catalog unavailable');
  await pollResults({ teams:require('./team-catalog').parseCatalog(await catalogResponse.json()), db: getFirestore(), auth: getAuth(), messaging: getMessaging(), Timestamp, fetchFeed: async file => {
    const response = await fetch('https://raw.githubusercontent.com/djyuanyo/CDMenciana/main/data/' + file, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (!response.ok) throw Error('Official result feed unavailable');
    return response.json();
  }});
});

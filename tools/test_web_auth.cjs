const assert = require('node:assert/strict'), fs = require('node:fs'), { JSDOM } = require('jsdom');
const transport = fs.readFileSync('hosting/firebase-web.js', 'utf8').replace(/import\s+[\s\S]*?from\s+'[^']+';\s*/g, '');
const ui = fs.readFileSync('server/static/auth.js', 'utf8');
const tick = () => new Promise(r => setTimeout(r, 0));
async function run() {
  const dom = new JSDOM('<main></main>', { url: 'https://cdmenciana.web.app/', runScripts: 'outside-only' });
  const W = dom.window, auth = { currentUser: { uid: 'firebase-uid', email: 'user@club.test', displayName: 'Club User', emailVerified: false } };
  W.CDM = { icon: () => '<svg></svg>' }; W.CLUB_FIREBASE_CONFIG = { projectId: 'barpro-pos-menciana' };
  Object.assign(W, {
    initializeApp: c => c, getAuth: () => auth,
    onAuthStateChanged: (_, callback) => { queueMicrotask(callback); },
    signInWithEmailAndPassword: async () => { throw { code: 'auth/invalid-credential' }; },
    createUserWithEmailAndPassword: async (_, email) => ({ user: auth.currentUser = { uid: 'new-id', email, emailVerified: false } }),
    updateProfile: async (u, data) => Object.assign(u, data),
    sendEmailVerification: async () => { throw Error('Registration must not send verification emails'); },
    sendPasswordResetEmail: async () => { throw { code: 'auth/user-not-found' }; },
    reload: async u => { u.emailVerified = true; },
    signOut: async () => { auth.currentUser = null; },
    getIdToken: async () => 'sdk-token',
    GoogleAuthProvider: class { setCustomParameters() {} },
    signInWithPopup: async () => { throw { code: 'auth/popup-closed-by-user' }; }
  });
  W.eval(ui); W.eval(transport); await W.ClubAuth.init();
  W.document.querySelector('main').innerHTML = W.ClubAuth.screen();
  assert(W.document.querySelector('.account-card'), 'Browser restores the identity from Firebase');
  assert(!W.document.querySelector('[data-auth-action="verify"]'), 'Registration does not require an email link');
  assert(!W.document.querySelector('.account-status.verified'), 'Registration does not claim email verification');
  assert(W.document.querySelector('.account-club-access').textContent.includes('cuando apruebe'), 'Firebase identity does not grant club membership');
  await W.ClubAuth.request('reload');
  assert.equal(W.ClubAuth.user.emailVerified, true);
  await assert.rejects(W.ClubAuth.request('login', { email: 'user@club.test', password: 'wrong-password' }), /Revisa/);
  await W.ClubAuth.request('logout'); assert.equal(W.ClubAuth.user, null);
  const reset = await W.ClubAuth.request('reset', { email: 'missing@club.test' }); assert(reset.message.includes('Si existe'));
  await assert.rejects(W.ClubAuth.request('google'), /cancelado/); assert.equal(W.ClubAuth.user, null);
  await assert.rejects(W.ClubAuth.request('register', { name: 'X', email: 'user@club.test', password: 'long-password' }), /nombre/);
  await W.ClubAuth.request('register', { name: 'New Member', email: 'new@club.test', password: 'long-password' });
  assert.equal(W.ClubAuth.user.name, 'New Member'); assert.equal(W.ClubAuth.user.emailVerified, false);
  assert.equal(W.localStorage.length, 0, 'Only the real Firebase SDK persists sessions');
  dom.window.close();
  const native = new JSDOM('', { runScripts: 'outside-only' });
  native.window.ClubAuthNative = { request() {} };
  native.window.initializeApp = () => { throw Error('Web Firebase must not initialize inside Android'); };
  native.window.eval(transport); assert.equal(native.window.ClubAuthWeb, undefined); native.window.close();
  await tick(); console.log('Web Firebase identity, approval boundaries, verification, reset privacy, Google cancellation and Android precedence passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

'use strict';

const OWNER = 'juanjocarrillo7@gmail.com', OWNER_UID = 'ZJeZEjtDeMRCYL0UOuvhGt0gNCT2';
// Dependencies are injected so failure recovery and access control can be tested.
exports.deleteClubAccount = async function ({ token, uid }, { auth, db, timestamp, fail, now = Date.now }) {
  const error = (code, message) => { throw fail(code, message); };
  if (!token) error('unauthenticated', 'Inicia sesión como administrador.');
  let claims;
  try { claims = await auth.verifyIdToken(token, true); }
  catch { error('unauthenticated', 'La sesión no es válida. Vuelve a entrar.'); }
  // Check the actual Auth record as well as the claims. App roles are not authority.
  const caller = await auth.getUser(claims.uid);
  if (claims.uid !== OWNER_UID || caller.uid !== OWNER_UID || claims.email?.toLowerCase() !== OWNER ||
      caller.disabled || caller.email?.toLowerCase() !== OWNER)
    error('permission-denied', 'Solo la cuenta de administración puede eliminar usuarios.');
  if (!Number.isFinite(claims.auth_time) || now() / 1000 - claims.auth_time > 300)
    error('failed-precondition', 'Por seguridad, cierra sesión y vuelve a entrar antes de eliminar cuentas.');
  if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/') || uid === caller.uid)
    error('invalid-argument', 'Selecciona otra cuenta del club.');
  if ((await db.collection('clubDeletedAccounts').doc(caller.uid).get()).exists)
    error('permission-denied', 'La cuenta de administración está en proceso de eliminación.');
  const profile = db.collection('clubUsers').doc(uid), marker = db.collection('clubDeletedAccounts').doc(uid);
  const [clubProfile, deletion] = await Promise.all([profile.get(), marker.get()]);
  if (!clubProfile.exists && !deletion.exists) error('not-found', 'Esta cuenta no pertenece al club.');
  let target;
  try { target = await auth.getUser(uid); }
  catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
  if (target?.email?.toLowerCase() === OWNER || clubProfile.data()?.email?.toLowerCase() === OWNER)
    error('permission-denied', 'La cuenta de administración no puede borrarse desde el listado.');
  // Block stale sessions first. Keep the profile on Auth failures so admin can retry.
  if (!deletion.exists) {
    try { await marker.create({ requestedAt: timestamp() }); }
    catch (e) { if (e.code !== 6 && e.code !== 'already-exists') throw e; }
  }
  try { await auth.deleteUser(uid); }
  catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
  await db.recursiveDelete(profile);
  return { deleted: true };
};

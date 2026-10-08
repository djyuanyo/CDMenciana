import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail, reload, signOut, getIdToken,
  GoogleAuthProvider, signInWithPopup
} from 'firebase/auth';

// Android uses Credential Manager and its native Firebase SDK instead.
if (!window.ClubAuthNative?.request) {
  const auth = getAuth(initializeApp(window.CLUB_FIREBASE_CONFIG));
  auth.languageCode = 'es';
  const state = () => ({ configured: true, google: true, user: auth.currentUser ? {
    uid: auth.currentUser.uid, name: auth.currentUser.displayName || '',
    email: auth.currentUser.email || '', emailVerified: auth.currentUser.emailVerified
  } : null });
  const ready = new Promise((resolve, reject) => {
    onAuthStateChanged(auth, () => { window.ClubAuth?.update(state()); resolve(); }, reject);
  });
  const errors = {
    'auth/invalid-credential': 'Revisa el correo y la contraseña.',
    'auth/wrong-password': 'Revisa el correo y la contraseña.',
    'auth/user-not-found': 'Revisa el correo y la contraseña.',
    'auth/invalid-email': 'Introduce un correo electrónico válido.',
    'auth/email-already-in-use': 'Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.',
    'auth/weak-password': 'La contraseña debe tener al menos 10 caracteres.',
    'auth/too-many-requests': 'Se han realizado demasiados intentos. Espera un momento.',
    'auth/network-request-failed': 'No hay conexión con Firebase. Vuelve a intentarlo.',
    'auth/popup-closed-by-user': 'Has cancelado el acceso con Google.',
    'auth/cancelled-popup-request': 'Has cancelado el acceso con Google.',
    'auth/popup-blocked': 'Permite la ventana de Google en tu navegador y vuelve a intentarlo.',
    'auth/unauthorized-domain': 'El dominio aún no está autorizado en Firebase.',
    'auth/operation-not-allowed': 'Este método de acceso aún no está activado en Firebase.',
    'auth/user-disabled': 'Esta cuenta está desactivada. Contacta con el club.'
  };
  window.ClubAuthWeb = {
    async request(action, data = {}) {
      try {
        // Start Google directly in the click handler, preserving popup activation.
        if (action === 'google') {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await signInWithPopup(auth, provider);
        } else {
          await ready;
          if (action === 'login') await signInWithEmailAndPassword(auth, data.email.trim(), data.password);
          else if (action === 'register') {
            const name = (data.name || '').trim();
            if (name.length < 2 || name.length > 100) throw Error('Introduce tu nombre completo.');
            if (!data.password || data.password.length < 10 || data.password.length > 128) throw Error('La contraseña debe tener entre 10 y 128 caracteres.');
            const { user } = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
            await updateProfile(user, { displayName: name });
          } else if (action === 'reset') {
            try { await sendPasswordResetEmail(auth, data.email.trim()); }
            catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
          } else if (action === 'logout') await signOut(auth);
          else if (['reload', 'token'].includes(action)) {
            if (!auth.currentUser) throw Error('Inicia sesión para continuar.');
            if (action === 'reload') await reload(auth.currentUser);
            if (action === 'token') return { ...state(), token: await getIdToken(auth.currentUser, true) };
          } else if (action !== 'state') throw Error('Solicitud no disponible.');
        }
        const result = { ...state(), message: ({
          register: 'Cuenta creada. Completa tus datos en la app.',
          reset: 'Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso.',
          logout: 'Sesión cerrada.'
        })[action] || '' };
        window.ClubAuth?.update(result);
        return result;
      } catch (error) {
        throw Error(errors[error.code] || (error.code ? 'No se pudo completar el acceso. Vuelve a intentarlo.' : error.message));
      }
    }
  };
}

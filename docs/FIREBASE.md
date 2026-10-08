# Firebase de CD Menciana

## Proyecto y dominio

Proyecto: **barpro-pos-menciana** (plan gratuito Spark). Sitio de Hosting: **cdmenciana**. Dominios: `cdmenciana.web.app` y `cdmenciana.firebaseapp.com`. El sitio original `barpro-pos-menciana` se conserva separado.

Las aplicaciones **CD Menciana Web** y **CD Menciana Android** están registradas, correo/contraseña y Google están habilitados y ambos dominios del club están autorizados. La configuración Android se ha preparado con los identificadores públicos de la consola y el cliente OAuth web de Google, sin secretos de administración. La API pública de Firebase ha validado el ID de app Android, el cliente OAuth y el certificado SHA-1. La configuración web pública está en `hosting/firebase-config.json`; la configuración Android pública está en `android/app/google-services.json`.

La web utiliza la misma interfaz pública y los datos deportivos que la APK. Consulta las copias públicas de `main/data` del repositorio del club y conserva la copia incluida cuando no hay conexión. No necesita el servidor Python para consultar calendario, actas, clasificación, goleadores, plantillas y estadísticas ni para iniciar sesión.

## Publicar la web

Con Node 22 o posterior y Firebase CLI instalados:

```sh
npm ci --prefix hosting
npm run build --prefix hosting
firebase login
firebase deploy --only hosting --project barpro-pos-menciana
```

`firebase.json` apunta expresamente al sitio **cdmenciana** y solo publica `hosting/dist`. No incluye bases de datos, credenciales de administración ni APK. Firebase Hosting en Spark no permite alojar APK; las entregas Android se distribuyen aparte.

También puede publicarse el ZIP preparado, sin instalar las dependencias de la web: extraerlo, abrir un terminal en su carpeta y ejecutar `firebase deploy --only hosting --project barpro-pos-menciana`. Cloud Shell incluye Firebase CLI y autentica la cuenta de Google; la publicación no se ha podido realizar desde el navegador de esta sesión porque Cloud Shell muestra “Site Unavailable”. El sitio está creado, pero sigue pendiente de su primera publicación.

La comprobación automatizada cubre el SDK web, los límites de aprobación, recuperación de contraseña, cancelación de Google y la preferencia por el SDK nativo dentro de Android. La autenticación real en el dispositivo exige que la APK esté firmada con el certificado registrado.

La pantalla de **Mi cuenta** permite registro por nombre, correo y contraseña, acceso con Google, recuperación de contraseña, verificación de correo y cierre de sesión. Firebase Authentication mantiene la sesión Android entre aperturas; la interfaz no guarda contraseñas, tokens ni sesiones en almacenamiento web. Google utiliza Credential Manager, fuera del WebView.

## Activar el proyecto Android

1. Crea o selecciona el proyecto del club en https://console.firebase.google.com/.
2. Añade una aplicación Android con paquete **`es.cdmenciana.app`**.
3. Registra las huellas del certificado con el que se entrega la APK:

   - SHA-1: `3c5e10f2ea25d77661be566bdad134d6f22f2c17`
   - SHA-256: `392bda332ae17140288208692ca5d9cce8c2c7487c567c4b819eaf8a1ed8c26e`

4. En Authentication → Sign-in method, activa **Correo electrónico / contraseña** y **Google**. Selecciona el correo de soporte del club para Google.
5. Descarga el **google-services.json actualizado**, después de habilitar Google, y colócalo en `android/app/google-services.json`.
6. Compila de nuevo y firma con el mismo certificado. El plugin de Google procesa ese archivo y proporciona `default_web_client_id`, que debe ser el cliente OAuth web, no el Android.

Sin ese archivo, la compilación sirve como vista previa y muestra claramente que el acceso todavía no está activado. No crea cuentas ficticias ni se conecta a un proyecto ajeno. El código compila en CI sin configuración; para probar accesos reales, instala la APK compilada con el proyecto del club y los proveedores activos.

Las huellas de firma de la APK instalada deben coincidir con las registradas en Firebase. Las APK que compila GitHub Actions con otro certificado debug necesitan su propia huella o deben firmarse con el certificado conservado para las entregas.

## Conectar las zonas privadas del club

El registro y el inicio de sesión Android no necesitan el servidor Python. Los carnets, roles, convocatorias y administración siguen utilizando el servidor del club y requieren aprobación del administrador.

En el servidor instala `server/requirements.txt` y configura:

```text
FIREBASE_PROJECT_ID=id-real-del-proyecto
GOOGLE_APPLICATION_CREDENTIALS=/ruta/privada/service-account.json
```

El archivo de cuenta de servicio permanece en el servidor. Nunca se incluye en la APK ni en el repositorio. En Docker móntalo como archivo privado de solo lectura y pasa las dos variables al contenedor. No se necesita Firestore para este acceso.

La app intercambia un token Firebase válido por una cookie del servidor mediante `POST /api/firebase`. El servidor verifica firma, proyecto, audiencia, caducidad, correo verificado y revocación con Firebase Admin. Las cuentas nuevas quedan sin aprobar y sin roles; la identidad Firebase se vincula por proyecto y UID, nunca por el dorsal de un jugador ni por permisos enviados desde la interfaz. La aprobación, la cuota y el rol de administrador se consultan en la base de datos del club.

Una cuenta antigua que ya utiliza ese correo no se vincula automáticamente: requiere una migración o vinculación supervisada por el administrador. El acceso por contraseña del servidor web se conserva. La versión en Firebase Hosting utiliza el SDK web y la app Android utiliza Firebase Auth y Credential Manager nativos. Ambas comparten el proyecto y las cuentas Firebase.

## Comprobación con el proyecto real

- Crear una cuenta con correo, recibir y abrir la verificación, consultar Mi cuenta y cerrar sesión.
- Iniciar sesión nuevamente y comprobar que continúa al cerrar y abrir la app.
- Recuperar la contraseña y comprobar el correo de Firebase.
- Entrar con Google, cancelar el selector y cambiar de cuenta después de cerrar sesión.
- Si se configura el servidor, confirmar que un registro nuevo no tiene acceso a socios, jugadores o administración hasta que el club lo apruebe.

Las pruebas automatizadas validan la interfaz, los errores, la identidad y los permisos con transportes de prueba. No sustituyen esta comprobación del proveedor real y del certificado instalado.

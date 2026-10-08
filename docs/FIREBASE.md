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

## Roles y panel de control desde 0.21.0

La APK y Firebase Hosting utilizan la colección **clubUsers** de Cloud Firestore. No necesitan el servidor Python para asignar roles. Cada cuenta crea su perfil al acceder a esta versión y comienza como aficionado. El panel ofrece búsqueda por nombre/correo y asignación de aficionado, socio, jugador o ambos. El administrador designado es exclusivamente la identidad Firebase con correo **juanjocarrillo7@gmail.com verificado**. Esta condición se comprueba también en las reglas del servidor.

Las cuentas de Firebase Authentication que aún no hayan abierto esta versión no aparecen en clubUsers. Al cerrar sesión se eliminan de memoria los perfiles y el listado; los permisos persistentes permanecen en Firestore.

Activación: abrir Cloud Firestore, crear la base **(default)** si no existe e integrar el bloque **clubUsers** de `firestore.rules` con las reglas existentes. El proyecto también contiene el POS: hay que conservar sus reglas y evitar un comodín que permita acceso a clubUsers. El archivo entregado es una plantilla aislada y **no debe sustituir sin revisión las reglas de una base compartida**. La publicación de Hosting sigue utilizando `firebase deploy --only hosting`; firebase.json no despliega reglas automáticamente.

Las pruebas de CI ejecutan el emulador de Firestore y comprueban que solo el administrador verificado puede enumerar usuarios y cambiar sus roles. Rechazan la escalada de permisos, la suplantación por correo, la consulta anónima, el borrado y el acceso a otras colecciones.

## Servidor Python opcional del club

El servidor antiguo mantiene sus carnets, cuotas, convocatorias y administración de contenidos en SQLite. Esos datos no se migran automáticamente a Firestore. Los roles de la interfaz antigua del servidor y los de la APK/Hosting son almacenes distintos. La cuenta verificada del administrador designado también se reconoce en ese servidor cuando su proyecto Firebase es barpro-pos-menciana.

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

## Registro obligatorio desde 0.22.0

La app abre Mi cuenta cuando falta la sesión y mantiene la navegación bloqueada hasta completar el perfil del club. Google autentica la identidad, pero no sustituye el formulario de registro. Las cuentas existentes con un perfil antiguo deben completar también los datos, conservando su rol aprobado.

`registrationType` identifica la declaración: `fan`, `member` o `team`. Los socios aportan `memberNumber`; el equipo aporta `teamRole` (`player` o `staff`) y una categoría de la lista cerrada. Los jugadores aportan `birthDate` en formato YYYY-MM-DD. Firestore solo admite perfiles completos, números de socio numéricos, categorías válidas y fechas reales no futuras. El perfil usa `registrationComplete: 'true'`. Los usuarios no pueden modificar el rol de acceso aprobado: las declaraciones se muestran al administrador para su revisión.

Se verificaron el flujo Google, los campos condicionales, las siete categorías, las reglas en el emulador, los perfiles existentes, las horas azules y el diseño en cuatro anchuras y ambos temas. La entrega Android conserva el código nativo de 0.21.0 y sustituye los recursos web; `tools/repackage_assets.py` actualiza el manifiesto a 0.22.0/36, y la APK se alinea y firma con el mismo certificado registrado. La compilación Gradle completa no estuvo disponible por falta de acceso a sus dependencias.


## Eliminación de cuentas desde 0.23.0

En Android y Hosting, Mi cuenta y el formulario de registro incompleto ofrecen Eliminar mi cuenta. Siempre se confirma el correo de la cuenta y se avisa de que la cuenta de Google permanece intacta. Se exige haber iniciado sesión hace menos de cuatro minutos (las reglas admiten cinco); una sesión antigua pide cerrar sesión y volver a entrar sin iniciar el borrado automáticamente.

El cliente borra el documento clubUsers y crea clubDeletedAccounts/{uid} en un único commit de Firestore. Ese marcador solo conserva el UID y requestedAt, sin correo, nombre ni datos de registro, y bloquea la lectura y recreación del perfil con tokens antiguos. A continuación borra la identidad mediante accounts:delete con el token del propio usuario y cierra la sesión. Un fallo deja una pantalla de eliminación pendiente con reintento; nunca se muestra éxito mientras falta borrar la identidad. Las reglas se probaron en el emulador y se publicaron en el proyecto el 8 de octubre de 2026 (15:07, consola).

El panel incluye Eliminar cuenta para otros usuarios. La operación llama a deleteClubAccount, cuyo código está en functions/. El servicio verifica el token con revocación y el usuario real de Firebase, exige la cuenta administradora verificada y una sesión reciente, protege al administrador y rechaza cuentas ajenas al club. Bloquea los tokens antiguos, elimina Authentication y borra recursivamente el perfil; conserva el perfil si falla Authentication para que el administrador pueda reintentar. Ninguna clave de servicio se incluye en la APK.

**Estado de despliegue:** el borrado propio está habilitado mediante las reglas publicadas. El servicio de administración todavía NO está desplegado: el proyecto sigue en Spark. Firebase exige Blaze y una cuenta de facturación para desplegar Cloud Functions. No se ha cambiado el plan ni añadido facturación. El botón no confirma ningún borrado si el servicio no responde.

Cuando el titular haya habilitado Blaze, desplegar únicamente este servicio (no tocar funciones de otras aplicaciones del mismo proyecto):

```sh
npm --prefix functions install
firebase deploy --project barpro-pos-menciana --config firebase.accounts.json --only functions:deleteClubAccount
```

La APK 0.23.0/37 mantiene sin cambios el código nativo de 0.21.0; se actualizan los recursos web y el manifiesto, se alinea y se firma con el mismo certificado debug. La compilación completa sigue dependiendo del acceso a los repositorios Gradle. Se comprobaron las reglas, el transporte, la confirmación/cancelación en ambos temas, el reintento tras fallo de Auth y los flujos de registro anteriores con datos simulados, sin eliminar cuentas reales.


## Registro dentro de la app y administrador desde 0.24.0

Esta versión sustituye la exigencia de verificación por correo de las versiones anteriores. El registro solo se completa al guardar el formulario de datos del club dentro de la app, tanto con correo/contraseña como con Google. Sigue siendo obligatorio elegir Jugador/Cuerpo Técnico, Socio o Aficionado, y completar el número de socio o categoría y fecha de nacimiento según corresponda. Los accesos aprobados de socio/jugador ya no dependen de emailVerified.

La cuenta de administración se vincula al UID real observado en Firebase Authentication: ZJeZEjtDeMRCYL0UOuvhGt0gNCT2, con correo juanjocarrillo7@gmail.com. Tanto el cliente como las reglas y el servicio preparado de eliminación comprueban esa identidad; una cuenta diferente no obtiene privilegios por presentar ese correo. Tras completar el perfil aparece Administrador y Panel de control en Mi cuenta, también si emailVerified es false. La sesión y contraseña/Google siguen siendo obligatorios.

La web crea usuarios con el SDK sin sendEmailVerification. Android crea la identidad por accounts:signUp y actualiza el nombre por accounts:update, sin sendOobCode; después inicia sesión mediante el SDK nativo, que conserva y restaura la sesión. Este recorrido evita la acción de registro antigua del contenedor, que enviaba el correo de verificación. El nombre y los datos del club se guardan obligatoriamente en Firestore. No se guardan contraseñas ni tokens en almacenamiento propio. La recuperación de contraseña conserva su correo de recuperación.

Se probaron el registro nativo sin correos, los campos obligatorios antes de crear la identidad, el guardado del perfil sin correo verificado, la identificación del administrador, el rechazo de otra identidad con el mismo correo, las reglas en emulador y el panel en Chromium. También pasaron las pruebas de eliminación, noticias, roles y temas. La entrega 0.24.0/38 actualiza recursos y manifiesto con el mismo contenedor nativo y certificado debug; no se modificó Java ni se recompiló Gradle.

El servicio para eliminar cuentas ajenas sigue pendiente de desplegar por requerir Blaze. Los roles y el panel funcionan con Spark y no requieren ese servicio.

## Favoritos y avisos de resultados (0.26.0)

Los equipos disponibles pertenecen a las dos competiciones que ya consulta la app. Se identifican por `teamKey` (first/filial) y el código oficial `Codigo_Equipo` de RFAF, conservando por separado categorías con nombres parecidos. Hay estrellas en partidos y clasificación, y Más → Mis favoritos. Los favoritos se guardan en `clubUsers/{uid}/favorites/{teamKey}_{teamId}`; las reglas permiten leer, añadir y quitar solamente los propios. Al cambiar la identidad se vacía inmediatamente la vista y se descartan respuestas de la sesión anterior. El borrado propio limpia favoritos y dispositivos junto al perfil en el commit de eliminación. Las reglas se probaron en el emulador y se publicaron en el proyecto el 8 de octubre de 2026 (18:17, consola).

La integración nativa de Firebase Messaging está en `ClubPush` y `ClubMessagingService`. El permiso se pide al pulsar Activar notificaciones (POST_NOTIFICATIONS en Android 13+). El token se registra con el token Auth del usuario; desactivar o cerrar sesión silencia el móvil y cancela sus avisos. Cada mensaje lleva el UID destinatario; el servicio comprueba sesión, consentimiento, permiso y duplicados antes de mostrar el resultado. Se usan mensajes de datos para evitar que Android muestre automáticamente avisos de una cuenta que ya ha cerrado sesión. Pulsar el aviso abre el acta dentro de la app, pasando por el acceso y registro habituales.

`notifyFavoriteResults` consulta cada cinco minutos los datos públicos que el sincronizador RFAF ya actualiza en GitHub cada treinta minutos. El aviso depende de que RFAF publique el resultado y el sincronizador lo detecte; no es un marcador en directo. La primera lectura crea una referencia sin avisar de resultados antiguos; solo las transiciones de pendiente a Finalizado con marcador numérico confirmado generan eventos. Seguir a ambos participantes genera un único aviso por dispositivo. Las entregas tienen reclamación temporal, reintento de fallos, invalidación de tokens y comprobación final de baja/favoritos. Los datos de eventos y envíos solo son accesibles al servidor.

**Estado:** el almacenamiento de favoritos está habilitado y Android se ha compilado completo con FCM en GitHub Actions (8 de octubre de 2026). La APK con sufijo `favoritos` era una entrega parcial; `CDMenciana-0.26.0.apk` incluye el receptor nativo. La subida a `feature/favorites-results-0260` fue autorizada por el titular. No se cambió la facturación.

### Envío gratuito sin Blaze

La opción seleccionada usa Firebase Cloud Messaging (sin coste) y runners estándar de GitHub Actions en este repositorio público (sin coste). `.github/workflows/notify-results.yml` ejecuta `functions/github-results.js` cada treinta minutos, cinco minutos después del horario previsto del sincronizador RFAF. GitHub puede retrasar o saltarse una ejecución programada; no se garantiza el aviso inmediatamente al acabar un partido. Se reutiliza `pollResults`, con la misma persistencia y protección frente a duplicados, bajas y favoritos retirados. Los datos privados se conservan en Firestore, nunca en el repositorio ni en artefactos de Actions.

Estado de la configuración:

1. El workflow y el código revisado se incorporaron a `main` mediante PR #13 el 8 de octubre de 2026 (19:05, Madrid). Los cron se ejecutan desde esa rama. El workflow rechaza otras ramas y no se ejecuta en pull requests. Si falta el secreto, registra un aviso explícito y omite el envío y la instalación de dependencias. Esto no activa la disponibilidad en Firestore.
2. Crear una cuenta de servicio dedicada en el proyecto `barpro-pos-menciana`, con permisos de lectura de Firebase Authentication, acceso servidor a Firestore y envío FCM. Guardar su JSON exclusivamente en el secreto de Actions **CDM_FIREBASE_SERVICE_ACCOUNT** del repositorio. No añadir la clave a Git, APK, ZIP ni mensajes. Habilitar Firebase Cloud Messaging API si estuviera desactivada. No es necesario habilitar Blaze ni desplegar `notifyFavoriteResults` en Cloud Functions.

La conexión todavía no está configurada: **el envío automático aún no está activo**. Se inició sesión en GitHub y se comprobó que no hay secretos configurados. El panel IAM de Google Cloud devolvió “Site Unavailable” incluso tras recargar; no fue posible crear una cuenta dedicada con permisos limitados. No se generó ni se compartió una clave administrativa del proyecto. El servicio activa `clubNotificationConfig/status` solo tras una consulta correcta; la interfaz no confirma disponibilidad si ese estado falta. Firestore se mantiene en Spark: si se agota su cuota gratuita, se interrumpe el servicio en vez de generar cargos. Los cron dejan de ejecutarse tras el período de inactividad que aplica GitHub a repositorios públicos.

Después de configurar el secreto, ejecutar manualmente “Avisos gratuitos de resultados” en `main` para crear la referencia inicial sin enviar resultados antiguos. Probar un dispositivo real con permiso concedido, app cerrada, resultado nuevo, favorito quitado y cambio de cuenta. Las pruebas automatizadas de interfaz/servidor/reglas y la compilación Android no sustituyen esa prueba real de entrega FCM.

La función Cloud Functions se conserva como alternativa opcional para otros despliegues; no debe activarse a la vez que el cron. El borrado administrativo de cuentas continúa siendo un servicio separado pendiente de configurar; no se despliega ni se modifica en este cambio.

## Versión 0.27.0: categorías y avisos del panel
Solo las categorías del club son favoritas: first/2137495 y filial/48536795. La estrella aparece en el banner de la categoría seleccionada. Los favoritos antiguos de rivales no se muestran ni reciben resultados.
El administrador fijado por UID y correo crea solicitudes inmutables en clubNotificationRequests con título, mensaje y teamKey (all/first/filial). El proceso notify-custom.yml revisa la cola cada cinco minutos; GitHub puede demorar la ejecución. Solo envía a dispositivos activados de cuentas vigentes, excluye borrados y deshabilitados, vuelve a comprobar las suscripciones y deduplica por solicitud/dispositivo. No requiere Blaze.
Android solicita POST_NOTIFICATIONS una vez en la primera apertura; al aceptar registra el dispositivo cuando se completa el acceso. Un rechazo no bloquea la app. Los avisos pueden activarse o desactivarse en Mis favoritos.

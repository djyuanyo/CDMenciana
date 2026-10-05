# CD Menciana · Apaga y Vámonos

Primera versión funcional 0.1.0, creada desde cero: aplicación Android con contenedor nativo WebView, interfaz propia y servidor Python/SQLite. No depende de Replit ni WordPress. El panel web utiliza el mismo servidor y los permisos se comprueban en cada petición.

## Qué incluye

- Registro con nombre, correo y contraseña; cuenta pendiente hasta aprobación del club.
- Roles socio y jugador independientes y combinables; administración separada.
- Noticias, publicaciones de partidos, clasificación y plantilla públicas.
- Carnet digital con número de socio, cuota manual y publicaciones exclusivas.
- Convocatorias/entrenamientos y confirmación de asistencia para jugadores.
- Panel para aprobar/suspender cuentas, asignar roles y publicar contenido por audiencia.
- Escudo original facilitado por el club, sin recrear sus textos.
- Pruebas del aislamiento de permisos, registro, suspensión y protección CSRF.

La APK abre inicialmente una vista pública incluida sin conexión, con el escudo y navegación. No contiene datos inventados ni registro simulado. Para usar cuentas y datos reales, conecta un servidor propio mediante el botón superior; esa interfaz requiere internet. Esta versión NO es una interfaz íntegramente nativa ni incluye notificaciones push, pagos, QR, verificación de correo o recuperación automática por email. La recuperación de contraseña se hace desde la consola del servidor por el administrador, tras verificar la identidad. Estas funciones se pueden incorporar después.

## Ejecutar en desarrollo

Requiere Python 3.12, sin paquetes adicionales.

```sh
python3 server/app.py --create-admin
python3 server/app.py
```

Abre `http://localhost:8080`. El panel está dentro de la cuenta de administrador, en la pestaña Administración. No hay credenciales predeterminadas. Para cambiar una contraseña y revocar sus sesiones:

```sh
python3 server/app.py --reset-password
```

## Servidor público y Android

GitHub almacena el código y compila la APK, pero GitHub Pages no ejecuta este servidor. Hace falta alojamiento con almacenamiento persistente y HTTPS. No hay ningún servidor de producción desplegado todavía.

Se incluye una opción Docker Compose con Caddy para HTTPS. Crea un archivo `.env` en la raíz (no subirlo al repositorio):

```text
CDM_DOMAIN=app.tu-dominio.es
```

Apunta ese dominio al servidor, permite los puertos 80/443 y ejecuta:

```sh
docker compose up -d --build
docker compose exec app python app.py --create-admin
```

Caddy obtiene el certificado. La base de datos queda en el volumen `club-data`; realiza copias de seguridad coherentes con SQLite antes de actualizar o migrar. El servidor interno no debe exponerse directamente. Configura retención de datos, contacto del club y aviso de privacidad antes de abrir registros reales.

Para activar las cuentas, pulsa Conectar servidor del club e introduce `https://app.tu-dominio.es`. La dirección es configurable mientras no haya dominio definitivo. Solo admite HTTPS. El escudo también es el icono de la app.

## Compilar y descargar APK

El workflow **Verificar y compilar APK** se ejecuta al subir a `main`, en pull requests y manualmente. Ejecuta las pruebas del servidor, `assembleDebug` y `lintDebug` y publica el artefacto `CDMenciana-APK-pruebas` durante 30 días. Descarga y descomprime ese ZIP desde Actions para instalar `app-debug.apk` en Android 8 o superior.

Es una APK de pruebas con firma debug; para distribuir versiones actualizables habrá que crear y conservar una clave de firma release. Nunca subir esa clave al repositorio. Para compilación local: JDK 17, Android SDK 35 y Gradle 8.9; ejecutar `gradle -p android assembleDebug lintDebug`.

## Datos deportivos

Fuente propuesta: https://stars.rfaf.es/?delegacion=9&competicion=48466108&grupo=48466109&widget_view=results

La sincronización con la RFAF todavía NO está implementada porque no se ha podido verificar el acceso a los datos. La app enlaza la fuente y permite publicaciones manuales de partidos/clasificación, con fecha de actualización. No contiene resultados inventados ni datos de ejemplo mezclados con datos reales. Se empieza con un equipo del club; el soporte de varios equipos se incorporará cuando se definan.

## Verificación

```sh
python3 -m unittest discover -s server/tests -v
node --check server/static/app.js
```

El prototipo usa el servidor HTTP estándar detrás del proxy y una base de datos SQLite. Antes de un uso a gran escala conviene migrar el servicio a un servidor de aplicación con control de concurrencia, añadir auditoría de administración y ampliar las pruebas de carga. Los permisos existentes no dependen de la interfaz.

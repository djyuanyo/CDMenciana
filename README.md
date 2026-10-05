# CD Menciana · Apaga y Vámonos

Primera versión funcional 0.3.0, creada desde cero: aplicación Android con contenedor nativo WebView, interfaz propia y servidor Python/SQLite. No depende de Replit ni WordPress. El panel web utiliza el mismo servidor y los permisos se comprueban en cada petición.

## Qué incluye

- Registro con nombre, correo y contraseña; cuenta pendiente hasta aprobación del club.
- Roles socio y jugador independientes y combinables; administración separada.
- Noticias, publicaciones de partidos, clasificación y plantilla públicas.
- Carnet digital con número de socio, cuota manual y publicaciones exclusivas.
- Convocatorias/entrenamientos y confirmación de asistencia para jugadores.
- Panel para aprobar/suspender cuentas, asignar roles y publicar contenido por audiencia.
- Escudo original facilitado por el club, sin recrear sus textos.
- Pruebas del aislamiento de permisos, registro, suspensión y protección CSRF.

La APK abre inicialmente una vista pública incluida sin conexión, con el escudo y navegación. No contiene datos inventados ni registro simulado. Para usar cuentas y datos reales, conecta un servidor propio desde Más → Configurar conexión del club; esa interfaz requiere internet. Esta versión NO es una interfaz íntegramente nativa ni incluye notificaciones push, pagos, QR, verificación de correo o recuperación automática por email. La recuperación de contraseña se hace desde la consola del servidor por el administrador, tras verificar la identidad. Estas funciones se pueden incorporar después.

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

Para activar las cuentas, abre Más → Configurar conexión del club e introduce `https://app.tu-dominio.es`. La dirección es configurable mientras no haya dominio definitivo. Solo admite HTTPS. El escudo también es el icono de la app.

## Compilar y descargar APK

El workflow **Verificar y compilar APK** se ejecuta al subir a `main`, en pull requests y manualmente. Ejecuta las pruebas del servidor, `assembleDebug` y `lintDebug` y publica el artefacto `CDMenciana-APK-pruebas` durante 30 días. Descarga y descomprime ese ZIP desde Actions para instalar `app-debug.apk` en Android 8 o superior.

Es una APK de pruebas con firma debug; para distribuir versiones actualizables habrá que crear y conservar una clave de firma release. Nunca subir esa clave al repositorio. Para compilación local: JDK 17, Android SDK 35 y Gradle 8.9; ejecutar `gradle -p android assembleDebug lintDebug`.

## Datos deportivos

Fuente propuesta: https://stars.rfaf.es/?delegacion=9&competicion=48466108&grupo=48466109&widget_view=results

La parte pública está conectada a los datos reales de la RFAF. `tools/sync_fixtures.py` consulta las jornadas del grupo y guarda únicamente los partidos del CD Menciana en `data/fixtures.json`. El workflow **Actualizar partidos RFAF** programa una actualización cada dos horas (GitHub puede retrasar las ejecuciones) y conserva el último conjunto válido si la fuente falla. Se incluye una copia en la APK para usarla sin conexión.

Android obtiene el JSON público de este repositorio al abrir la app o al pulsar Actualizar, con caché local y respaldo incluido. No necesita hosting para estos datos deportivos. La zona privada sigue requiriendo un servidor de cuentas. Las jornadas que la RFAF indica sin partidos publicados se muestran como pendientes; no se inventan encuentros. Los escudos rivales se cargan de la fuente oficial y el escudo del club conserva la imagen facilitada.

## Verificación

```sh
python3 -m unittest discover -s server/tests -v
node --check server/static/app.js
```

El prototipo usa el servidor HTTP estándar detrás del proxy y una base de datos SQLite. Antes de un uso a gran escala conviene migrar el servicio a un servidor de aplicación con control de concurrencia, añadir auditoría de administración y ampliar las pruebas de carga. Los permisos existentes no dependen de la interfaz.

## Diseño 0.3.0

Interfaz inspirada en la referencia facilitada: cabecera con escudo centrado, portada de equipo, pestañas superiores, tarjeta de partido, accesos de socios y jugadores y navegación inferior. Paleta azul marino, celeste, blanco y dorado del club. Sin fotografías ni partidos ficticios.

## Ajuste de pantalla 0.3.0

El contenedor Android aplica los insets del sistema, notch y teclado al padre del WebView, reduciendo su área real. Los elementos fijos de la interfaz quedan dentro de esa área. Incluye manejo de Android 15/16 y ajuste clásico para versiones anteriores.

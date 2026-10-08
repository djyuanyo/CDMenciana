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

La APK abre inicialmente una vista pública incluida sin conexión, con el escudo y navegación. No contiene datos inventados ni registro simulado. Mi cuenta incorpora Firebase Authentication para correo, Google, verificación de correo y recuperación de contraseña; está conectado al proyecto Firebase `barpro-pos-menciana` con proveedores de correo y Google habilitados. La versión web para Firebase Hosting utiliza la misma interfaz y cuentas. Desde 0.21.0, la APK y Hosting gestionan los roles con Firestore y ofrecen un panel para el administrador verificado juanjocarrillo7@gmail.com. Los carnets, cuotas y convocatorias del servidor antiguo se conservan aparte. Esta versión no incluye notificaciones push, pagos o QR. El acceso antiguo del servidor web conserva la recuperación de contraseña desde la consola por el administrador.

Consulta [docs/FIREBASE.md](docs/FIREBASE.md) para publicar la web en el sitio gratuito `cdmenciana`. El sitio ya está creado; su primera publicación está pendiente.

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

Fuente oficial: https://www.rfaf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=48466108&CodGrupo=48466109&CodTemporada=22&CodJornada=5

La parte pública está conectada a los datos reales de la RFAF. `tools/sync_fixtures.py` usa `tools/official_rfaf.py` para consultar el calendario completo, las fechas y los pabellones por jornada y la clasificación de los 16 equipos; guarda únicamente los partidos del CD Menciana en `data/fixtures.json`. El workflow **Actualizar partidos RFAF** programa una actualización cada 30 minutos (GitHub puede retrasar las ejecuciones) y conserva el último conjunto válido si la fuente falla. Se incluye una copia en la APK para usarla sin conexión.

Android obtiene el JSON público de este repositorio al abrir la app o al pulsar Actualizar, con caché local y respaldo incluido. No necesita hosting para estos datos deportivos. La zona privada sigue requiriendo un servidor de cuentas. Las horas no publicadas se muestran por confirmar. Las fechas que solo aparecen en la cabecera del calendario se etiquetan como orientativas. Se verifica el total de goles y partidos con la clasificación antes de reemplazar los datos. Los escudos rivales se cargan de la fuente oficial y el escudo del club se obtiene de la misma fuente oficial.

## Acceso con Firebase 0.20.0

La nueva página de Mi cuenta tiene acceso, registro y recuperación de contraseña con el mismo diseño y ambos modos de color. Google utiliza el selector nativo de cuentas de Android. El SDK mantiene la sesión entre aperturas; las contraseñas no se guardan en JavaScript. La app permite seguir consultando la información pública sin iniciar sesión.

Activa Correo/contraseña y Google en el proyecto del club y añade su `google-services.json` actualizado en `android/app/` antes de compilar la APK. La compilación sin ese archivo es una vista previa y muestra que el acceso no está activado. Configuración, huellas del certificado y conexión opcional con las zonas privadas: [docs/FIREBASE.md](docs/FIREBASE.md).

Firebase valida la identidad; el administrador del club asigna los permisos. El servidor verifica los tokens con Firebase Admin y no vincula automáticamente una cuenta antigua por coincidencia de correo. La cuenta de servicio se guarda únicamente en el servidor.

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

Los 16 escudos oficiales se guardan también en la APK y en la interfaz web para mostrarlos sin conexión. `data/crest-assets.json` conserva la URL original de cada imagen. La categoría usa su nombre completo de la RFAF. El calendario abre la última jornada jugada; avanza a la siguiente únicamente cuando tiene hora confirmada. La selección manual se conserva mientras la app permanece abierta.

La pestaña Goleadores utiliza la tabla completa de la RFAF y resalta a los jugadores del equipo. La plantilla se sincroniza desde https://cdmenciana.es/equipos/ con nombre, dorsal y foto original. `data/player-assets.json` relaciona las fotos oficiales con las copias incluidas en Android y en la interfaz web. La actualización programada renueva también estos listados y conserva los datos anteriores si alguna fuente falla.

Inicio muestra las noticias de https://cdmenciana.es/noticias/ con imagen, título, fecha y lectura completa en una página interna de la app. El workflow Actualizar noticias del club revisa la web cada 15 minutos (GitHub puede retrasar las ejecuciones), separado de la RFAF. Android consulta `data/news.json` al abrir o actualizar, con caché de cinco minutos y una copia incluida para cuando no hay conexión.

Las actas muestran la foto pública junto al nombre del jugador en titulares, suplentes, goles y tarjetas. La RFAF puede incluir las fotos como imágenes base64; se valida el formato de imagen y se conserva la fotografía de la misma fila, sin ejecutar scripts de la federación en la interfaz de la app. Al pulsar el nombre se abre una ficha interna con sus tablas de Partidos, Sanciones y Goles y un botón para actualizar las estadísticas. Las fotos de las actas guardadas se incluyen en la APK; las estadísticas se consultan al abrir la ficha, con reutilización de la copia reciente.


## Fichas de jugadores 0.15.0

Las 31 actas publicadas incluyen sus imágenes oficiales junto a titulares, suplentes, goles y tarjetas. Si la federación no publica el retrato, se mantiene su imagen predeterminada. Las imágenes incrustadas se validan y las copias guardadas no sustituyen una foto disponible por un campo vacío.

Al tocar el nombre se abre una ficha dentro de la app. «Este partido» muestra goles marcados, participación, dorsal y tarjetas; los goles en propia puerta se separan. «En competición» muestra goles totales, partidos jugados, titularidades y convocatorias. Se usan las tablas oficiales Partidos/Goles; cuando falta el perfil, los goles y titularidades se cuentan únicamente si están disponibles todas las actas jugadas del equipo. Los partidos jugados proceden del perfil o de la tabla de goleadores: estar convocado como suplente no prueba que haya jugado. Los datos ausentes aparecen como pendientes, nunca como cero.

La ficha conserva los valores disponibles mientras actualiza. El botón Actualizar estadísticas evita la caché reciente; la sincronización programada reutiliza una consulta por jugador y conserva los datos anteriores si la RFAF devuelve una página vacía.

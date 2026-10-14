/* CD Menciana · avisos en el navegador. Recibe el mensaje de datos del servidor, muestra la notificación y, al pulsarla,
   abre la pantalla que corresponde (noticia, ficha de partido o acta), con las mismas reglas que la app de Android. */
const TEAM = /^(first|filial|infantil|rfaf_[0-9]{1,12}_[0-9]{1,12})$/;
const NEWS = /^[a-z0-9][a-z0-9-]{0,199}$/;

function route(data) {
  const team = String(data.teamKey || ''), news = String(data.newsSlug || ''), match = String(data.matchId || ''), acta = String(data.acta || '');
  if (NEWS.test(news)) return '#noticia=' + news;
  if (TEAM.test(team) && /^[0-9-]{1,64}$/.test(match)) return '#partido=' + match + '&equipo=' + team;
  return TEAM.test(team) && /^[0-9]{1,12}$/.test(acta) ? '#acta=' + acta + '&equipo=' + team : '';
}

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const data = payload.data || payload.notification || payload || {};
  const title = String(data.title || 'CD Menciana').slice(0, 200), body = String(data.body || 'Tienes un aviso nuevo del club.').slice(0, 500);
  const icon = new URL('crest.png', self.registration.scope).href;
  // A browser requires every push to show something; unknown messages show a neutral one.
  event.waitUntil(self.registration.showNotification(title, {
    body, icon, badge: icon,
    tag: /^[a-f0-9]{64}$/.test(String(data.eventId || '')) ? data.eventId : undefined,
    data: { route: route(data) }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(self.registration.scope);
  const hash = event.notification.data?.route || '';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (!client.url.startsWith(target.origin + target.pathname)) continue;
      await client.focus();
      if (hash && 'navigate' in client) { try { await client.navigate(target.href + hash); } catch { /* keep the open page */ } }
      return;
    }
    await self.clients.openWindow(target.href + hash);
  })());
});

// A new version of this file takes over right away.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

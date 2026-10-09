/* Public sports snapshots from the club repository, with the shipped copy as fallback. */
(() => {
  const fetchLocal = window.fetch.bind(window);
  const allowed = /^(?:fixtures(?:-(?:filial|infantil|rfaf_[0-9]{1,12}_[0-9]{1,12}))?\.json|club-teams\.json|news\.json|actas\/\d+\.json)(?:\?refresh=1)?$/;
  window.fetch = async (input, options) => {
    if (typeof input !== 'string' || !allowed.test(input)) return fetchLocal(input, options);
    const filename = input.split('?')[0];
    const local = fetchLocal(input, options).then(async response => {
      if (!response.ok) throw Error('Copia local no disponible.');
      return response.json();
    }).catch(() => null);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 5000);
    let data = null;
    try {
      const response = await fetchLocal('https://raw.githubusercontent.com/djyuanyo/CDMenciana/main/data/' + filename, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw Error('Fuente no disponible.');
      data = await response.json();
      const rows = data[filename.startsWith('actas/') ? 'blocks' : filename === 'news.json' ? 'news' : filename === 'club-teams.json' ? 'teams' : 'matches'];
      if (!Array.isArray(rows) || filename !== 'news.json' && !rows.length) throw Error('Datos incompletos.');
      data.connection_state = 'live';
    } catch { data = null; }
    finally { clearTimeout(timeout); }
    const saved = await local;
    if (!data) { data = saved; if (data) data.connection_state = 'bundled'; }
    else if (filename.startsWith('actas/') && saved?.players?.length) {
      if (!data.players?.length) data.players = saved.players;
      else for (const player of data.players) {
        const portrait = saved.players.find(p => p.id === player.id && p.name === player.name);
        if (!player.photo && portrait?.photo) player.photo = portrait.photo;
      }
    }
    return new Response(JSON.stringify(data || {}), { status: data ? 200 : 503, headers: { 'Content-Type': 'application/json' } });
  };
})();


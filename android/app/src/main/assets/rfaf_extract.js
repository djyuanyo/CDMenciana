/* Shared DOM reader for the app and its isolated public RFAF WebViews. */
window.RfafExtract = (() => {
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const key = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toUpperCase();
  function photo(value, base = 'https://www.rfaf.es/pnfg/NPcd/') {
    const raw = clean(value);
    if (!raw || raw.length > 700000) return '';
    if (/^data:/i.test(raw)) {
      const match = raw.match(/^data:image\/(?:png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
      if (!match) return '';
      try {
        const bytes = atob(match[1]);
        const mime = bytes.startsWith('\xff\xd8\xff') ? 'jpeg' : bytes.startsWith('\x89PNG\r\n\x1a\n') ? 'png' : /^GIF8[79]a/.test(bytes) ? 'gif' : bytes.startsWith('RIFF') && bytes.slice(8,12) === 'WEBP' ? 'webp' : '';
        // RFAF labels JPEG bytes as image/png; retain the actual bitmap format.
        return mime ? 'data:image/' + mime + ';base64,' + match[1] : '';
      } catch (_) { return ''; }
    }
    try {
      const u = new URL(raw, base), host = u.hostname.toLowerCase();
      if (u.protocol === 'http:' && (host === 'rfaf.es' || host.endsWith('.rfaf.es') || host.endsWith('.filesnovanet.es'))) u.protocol = 'https:';
      if (u.protocol !== 'https:' || u.username || u.password || !host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /^0\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) return '';
      return /tarj_|escudo|logo|icon|spacer|loading|publicidad|social|(?:^|\/)rfaf-photo\//i.test(u.pathname + u.search) ? '' : u.href;
    } catch (_) { return ''; }
  }
  function profileUrl(value, base = 'https://www.rfaf.es/pnfg/NPcd/') {
    const raw = String(value || '').replace(/&amp;|\\x26|\\u0026/gi, '&');
    const literal = raw.match(/(?:https?:\/\/(?:www\.)?rfaf\.es)?(?:\/?pnfg\/(?:NPcd\/)?)?NFG_EstadisticasJugador\?[^\s'"<>]+/i)?.[0];
    if (!literal) return '';
    try {
      const u = new URL(literal, base);
      return u.protocol === 'https:' && !u.username && !u.password && ['rfaf.es','www.rfaf.es'].includes(u.hostname.toLowerCase()) && /^\/pnfg\/(?:NPcd\/)?NFG_EstadisticasJugador$/i.test(u.pathname) && /^\d{1,12}$/.test(u.searchParams.get('jugador') || '') ? u.href : '';
    } catch (_) { return ''; }
  }
  function nodeUrl(node) {
    for (const attr of ['href','onclick','data-href','data-url']) {
      const result = profileUrl(node.getAttribute(attr));
      if (result) return result;
    }
    return '';
  }
  function nodePhoto(node, base) {
    const scope = node.closest('tr') || node;
    const images = [...scope.querySelectorAll('img.fotojug'), ...scope.querySelectorAll('img')];
    for (const img of images) for (const attr of ['src','data-src','data-original','data-lazy-src']) {
      const result = photo(img.getAttribute(attr), base);
      if (result) return result;
    }
    return '';
  }
  function documents(doc) {
    const docs = [doc];
    for (const frame of doc.querySelectorAll('iframe')) try { if (frame.contentDocument) docs.push(frame.contentDocument); } catch (_) {}
    return docs;
  }
  function players(doc, wanted = [], acta = '') {
    const out = new Map(), names = new Set(wanted.map(key));
    for (const source of documents(doc)) for (const node of source.querySelectorAll('[href],[onclick],[data-href],[data-url]')) {
      const url = nodeUrl(node);
      if (!url) continue;
      // A clickable tr includes the shirt number; the name is its final cell.
      const cells = node.tagName === 'TR' ? [...node.children].filter(c => /^(TD|TH)$/.test(c.tagName)) : [];
      const name = clean(cells.length ? cells[cells.length-1].textContent : node.textContent);
      if (!name.includes(',') || name.length < 4 || name.length > 120 || (names.size && !names.has(key(name)))) continue;
      const u = new URL(url), playerId = u.searchParams.get('jugador'), actaId = u.searchParams.get('codacta') || u.searchParams.get('CodActa') || String(acta);
      const existing = out.get(key(name)), image = nodePhoto(node, url);
      out.set(key(name), {name, player_id: playerId, rfaf_id: playerId, acta_id: actaId, primary: u.searchParams.get('cod_primaria') || '5000274', url, profile_url: url, photo: image || existing?.photo || ''});
    }
    // Legacy script-only links are accepted only with one unambiguous name.
    if (!out.size) for (const source of documents(doc)) {
      const candidates = [...source.querySelectorAll('td')].map(n => clean(n.textContent)).filter(n => n.includes(',') && n.length <= 120 && !/^\(/.test(n));
      const unique = [...new Set(candidates)];
      if (unique.length !== 1) continue;
      for (const script of source.querySelectorAll('script')) {
        const url = profileUrl(script.textContent);
        if (!url) continue;
        const u = new URL(url), name = unique[0], playerId = u.searchParams.get('jugador');
        out.set(key(name), {name, player_id: playerId, rfaf_id: playerId, acta_id: u.searchParams.get('codacta') || String(acta), primary: u.searchParams.get('cod_primaria') || '5000274', url, profile_url: url, photo: ''});
      }
    }
    return [...out.values()];
  }
  function profile(doc) {
    const stats = [], seen = new Set(); let image = '';
    for (const source of documents(doc)) {
      for (const table of source.querySelectorAll('table')) {
        const head = clean(table.querySelector('th')?.textContent);
        if (!['Partidos','Sanciones','Goles'].includes(head)) continue;
        const rows = [...table.querySelectorAll('tr')].map(tr => [...tr.children].filter(c => c.tagName === 'TD').map(c => clean(c.textContent))).filter(r => r.length === 2 && /^\d+(?:[.,]\d+)?$/.test(r[1]));
        if (rows.length && !seen.has(head)) { stats.push({title:head, rows}); seen.add(head); }
      }
      const img = source.querySelector('img.fotojug,img[class*=jugador],img[class*=foto]');
      if (img) image = nodePhoto(img.parentElement, source.baseURI) || image;
    }
    return {photo_source:image, photo:image, stats};
  }
  return {key, photo, profileUrl, nodeUrl, nodePhoto, players, profile};
})();

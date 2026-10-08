/* News is rendered from structured text, never from untrusted website HTML. */
window.ClubNews={
 route(){const slug=new URLSearchParams(location.hash.slice(1)).get('noticia');return slug&&/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug)?slug:null;},
 slug(article){try{const url=new URL(article.url);if(url.protocol!=='https:'||url.hostname!=='cdmenciana.es')return '';const parts=url.pathname.split('/').filter(Boolean);return parts.length===2&&parts[0]==='noticias'&&/^[a-z0-9][a-z0-9-]{0,199}$/.test(parts[1])?parts[1]:'';}catch{return ''; }},
 href(article){const slug=this.slug(article);return slug?'#noticia='+encodeURIComponent(slug):'#';},
 screen(){
  const slug=this.route(),article=(Fixtures.newsData.news||[]).find(item=>this.slug(item)===slug),E=value=>Fixtures.esc(value);
  const back='<button type="button" class="news-back" data-news-back>← Volver a noticias</button>';
  if(!article)return back+CDM.empty('Noticia no disponible','Actualiza las noticias para volver a cargar esta publicación.','ball')+'<button type="button" data-refresh-fixtures>Actualizar noticias</button>';
  const image=Fixtures.newsImage(article.image),blocks=Array.isArray(article.content)?article.content:[];
  const body=blocks.map(block=>{
   if(block.kind==='paragraph')return `<p>${E(block.text)}</p>`;
   if(block.kind==='heading')return `<h2>${E(block.text)}</h2>`;
   if(block.kind==='quote')return `<blockquote>${E(block.text)}</blockquote>`;
   if(block.kind==='list'&&Array.isArray(block.items)){const tag=block.ordered?'ol':'ul';return `<${tag}>${block.items.map(item=>`<li>${E(item)}</li>`).join('')}</${tag}>`;}
   if(block.kind==='image'){const src=Fixtures.newsImage(block.src);return src?`<figure><img src="${E(src)}" alt="${E(block.alt||'')}" loading="lazy" data-news-image>${block.caption?`<figcaption>${E(block.caption)}</figcaption>`:''}</figure>`:'';}
   return '';
  }).join('');
  return back+`<article class="news-article card"><div class="news-meta"><span>${E(article.category||'Noticias')}</span><time datetime="${E(article.date)}">${E(new Date(article.date+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}))}</time></div><h1>${E(article.title)}</h1>${image?`<img class="news-article-cover" src="${E(image)}" alt="" data-news-image>`:''}<div class="news-article-content">${body||'<p>El texto de esta noticia todavía no se ha sincronizado.</p><button type="button" data-refresh-fixtures>Actualizar noticia</button>'}</div><footer>Noticias · CD Menciana</footer></article>`;
 }
};

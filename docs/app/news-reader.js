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
  return back+`<article class="news-article card"><div class="news-meta"><span>${E(article.category||'Noticias')}</span><time datetime="${E(article.date)}">${E(new Date(article.date+'T12:00:00Z').toLocaleDateString('es-ES',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}))}</time></div><h1>${E(article.title)}</h1>${image?`<img class="news-article-cover" src="${E(image)}" alt="" data-news-image>`:''}<div class="news-article-content">${body||'<p>El texto de esta noticia todavía no se ha sincronizado.</p><button type="button" data-refresh-fixtures>Actualizar noticia</button>'}</div><footer>Noticias · CD Menciana</footer></article>`;
 }
};

/* Slider of the latest published news, shown under the header on the home page. Swipe or wait: it advances by itself. */
window.ClubNewsSlider={
 limit:5,
 photo(n){const inner=(Array.isArray(n.content)?n.content:[]).find(b=>b.kind==='image'&&Fixtures.newsImage(b.src));return Fixtures.newsImage(n.image)||(inner?Fixtures.newsImage(inner.src):'');},
 slides(){return (Fixtures.newsData?.news||[]).filter(n=>ClubNews.slug(n)).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,this.limit);},
 html(){
  const rows=this.slides(),E=value=>Fixtures.esc(value);
  if(!rows.length)return '';
  return `<div class="news-slider-track" data-slider-track>${rows.map(n=>`<a class="news-slide" href="${E(ClubNews.href(n))}">${this.photo(n)?`<img src="${E(this.photo(n))}" alt="" data-news-image>`:''}<span class="news-slide-title">${E(n.title)}</span></a>`).join('')}</div><div class="news-slider-bars" aria-hidden="true">${rows.map(()=>'<span><i></i></span>').join('')}</div>`;
 },
 mount(page){
  const box=document.getElementById('news-slider'),markup=page==='Inicio'?this.html():'';
  if(!markup){box?.remove();return;}
  // The page redraws several times while loading; an unchanged slider is kept so its progress bar is not restarted.
  if(box&&box.dataset.markup===markup)return;
  box?.remove();
  const next=document.createElement('section');next.id='news-slider';next.setAttribute('aria-label','Últimas noticias');next.dataset.markup=markup;next.innerHTML=markup;
  document.getElementById('header').after(next);
  return this.start(next);
 },
 start(box){
  const track=box.querySelector('[data-slider-track]'),bars=[...box.querySelectorAll('.news-slider-bars span')];
  const index=()=>Math.max(0,Math.min(bars.length-1,Math.round(track.scrollLeft/(track.clientWidth||1))));
  const paint=()=>bars.forEach((bar,i)=>bar.className=i<index()?'done':i===index()?'now':'');
  track.addEventListener('scroll',paint,{passive:true});paint();
  // The white bar fills in 5 seconds (CSS); when it is full the slider moves to the next news.
  box.addEventListener('animationend',e=>{if(bars.length>1&&e.target.parentElement.className==='now')track.scrollTo({left:((index()+1)%bars.length)*track.clientWidth,behavior:'smooth'});});
 }
};
(()=>{const shell=CDM.shell;CDM.shell=function(page,user){const result=shell.call(this,page,user);try{ClubNewsSlider.mount(page);}catch(e){}return result;};})();

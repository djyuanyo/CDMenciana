const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
async function run(){
 const dom=new JSDOM('<header id="header"></header><div id="teams"></div><section id="banner"></section><div id="tabs"></div><main id="main"></main><nav id="nav"></nav><p id="notice"></p>',{url:'https://appassets.androidplatform.net/',runScripts:'outside-only',pretendToBeVisual:true}),W=dom.window;
 W.scrollTo=()=>{};W.localStorage.setItem('cdm-adult-access-v1','true');
 W.fetch=async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('android/app/src/main/assets/'+String(path).split('?')[0],'utf8'))});
 for(const name of ['appearance.js','ui.js','auth.js','registration.js','club-access.js','news-reader.js','rfaf_extract.js','roster-snapshot.js','fixtures.js','offline.js'])W.eval(fs.readFileSync('android/app/src/main/assets/'+name,'utf8'));
 W.ClubAuth.user={uid:'ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',name:'Juanjo',email:'juanjocarrillo7@gmail.com',emailVerified:true};W.ClubAccess.sync=async()=>{};W.ClubAccess.profile={id:'ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',role:'fan',...W.ClubRegistration.validate({name:'Juanjo',registrationType:'fan'})};W.dispatchEvent(new W.CustomEvent('club-registration-complete'));
 await new Promise(resolve=>setTimeout(resolve,30));
 const D=W.document,article=W.Fixtures.newsData.news[0];assert(article.content.length>0);
 const link=D.querySelector('.read-news');assert(link.getAttribute('href').startsWith('#noticia='));link.click();await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(D.body.dataset.page,'Noticia');assert(D.querySelector('.news-article h1').textContent===article.title);assert(D.querySelector('.news-article-content').textContent.includes(article.content.find(block=>block.kind==='paragraph').text));assert.equal(D.querySelector('.news-article a'),null);
 D.querySelector('[data-news-back]').click();assert.equal(W.location.hash,'');assert.equal(D.body.dataset.page,'Inicio');
 W.ClubAuth.user={uid:'ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',name:'Juanjo',email:'juanjocarrillo7@gmail.com',emailVerified:true};W.ClubAuth.firebase=()=>true;W.ClubAccess.sync=async()=>W.dispatchEvent(new W.CustomEvent('club-access-state'));W.ClubAccess.list=async()=>{W.ClubAccess.users=[{id:'fan',name:'Aficionado',email:'fan@club.test',role:'fan'}];};
 D.querySelector('[data-page="Mi cuenta"]').click();assert(D.querySelector('[data-page="Administración"]'));D.querySelector('[data-page="Administración"]').click();await new Promise(resolve=>setTimeout(resolve,30));
 assert(!D.querySelector('[data-club-role]'));assert(!D.querySelector('[data-club-notification]'));
 D.querySelector('[data-page="Administración notifications"]').click();assert(D.querySelector('[data-club-notification]'));assert(!D.querySelector('[data-notification-history]'));assert(!D.querySelector('[data-user-search]'));
 D.querySelector('.admin-back').click();D.querySelector('[data-page="Administración history"]').click();assert(D.querySelector('[data-notification-history]'));assert(!D.querySelector('[data-club-notification]'));
 D.querySelector('.admin-back').click();
 D.querySelector('[data-page="Administración users"]').click();await new Promise(resolve=>setTimeout(resolve,30));
 assert(D.querySelector('[data-club-role="fan"]'));W.ClubAccess.setRole=async(id,role)=>{assert.equal(id,'fan');assert.equal(role,'member');};
 const form=D.querySelector('[data-club-role]');form.querySelector('select').value='member';form.dispatchEvent(new W.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,30));assert(form.querySelector('.role-feedback').textContent==='Rol guardado.');
 W.ClubAuth.user=null;W.dispatchEvent(new W.CustomEvent('club-auth-state'));assert(!D.querySelector('[data-club-role]'));assert.equal(D.body.dataset.page,'Mi cuenta');
 W.ClubAuth.user={uid:'ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',name:'Juanjo',email:'juanjocarrillo7@gmail.com',emailVerified:true};W.ClubAccess.profile={id:'ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',role:'fan',...W.ClubRegistration.validate({name:'Juanjo',registrationType:'fan'})};W.dispatchEvent(new W.CustomEvent('club-registration-complete'));
 W.Fixtures.newsData.news=[{title:'Unsafe',url:'https://cdmenciana.es/noticias/unsafe/',date:'2026-10-08',content:[{kind:'paragraph',text:'<script>attack()</script>'},{kind:'image',src:'javascript:alert(1)'}]}];W.location.hash='#noticia=unsafe';await new Promise(resolve=>setTimeout(resolve,30));assert.equal(D.querySelector('.news-article script'),null);assert.equal(D.querySelector('.news-article img'),null);assert(D.querySelector('.news-article-content').textContent.includes('<script>attack()</script>'));
 dom.window.close();console.log('Internal news navigation and body, return, owner panel, role save, sign-out cleanup and safe rendering passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});

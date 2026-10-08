const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('server/static/auth.js','utf8');
function setup(state={configured:true,google:true,user:null}){
 const dom=new JSDOM('<main></main>',{url:'https://appassets.androidplatform.net/',runScripts:'outside-only'}),W=dom.window,requests=[];
 W.CDM={icon:()=>'<svg></svg>'};W.ClubAuthNative={request(id,action,payload){const data=JSON.parse(payload);requests.push({action,data});W.setTimeout(()=>{
  let result={...state,ok:true,message:''};
  if(action==='login')result={...result,ok:false,error:'Revisa el correo y la contraseña.'};
  if(action==='register'){state.user={uid:'real-sdk-uid',name:data.name,email:data.email,emailVerified:false};result={...state,ok:true,message:'Cuenta creada.'};}
  if(action==='reload'){state.user.emailVerified=true;result={...state,ok:true,message:'Correo verificado.'};}
  if(action==='logout'){state.user=null;result={...state,ok:true,message:'Sesión cerrada.'};}
  W.ClubAuth.receive(id,result);
 },0);}};
 W.eval(source);const render=()=>{W.document.querySelector('main').innerHTML=W.ClubAuth.screen();};
 for(const event of ['club-auth-state','club-auth-view'])W.addEventListener(event,render);
 render();return {dom,W,requests,render};
}
const settle=()=>new Promise(r=>setTimeout(r,30));
(async()=>{
 const a=setup();await a.W.ClubAuth.init();const D=a.W.document;
 D.querySelector('[data-auth-mode="register"]').click();
 D.querySelector('[name="name"]').value='Club User';D.querySelector('[name="email"]').value='user@club.test';D.querySelector('[name="password"]').value='safer-password';D.querySelector('[name="confirm"]').value='different-password';
 D.querySelector('form').dispatchEvent(new a.W.Event('submit',{bubbles:true,cancelable:true}));
 assert(D.querySelector('[role="alert"]').textContent.includes('no coinciden'));assert.equal(a.requests.filter(x=>x.action==='register').length,0);
 D.querySelector('[name="confirm"]').value='safer-password';D.querySelector('form').dispatchEvent(new a.W.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert(D.querySelector('.account-card'));assert(!D.querySelector('[data-auth-action="verify"]'));assert.equal(a.W.localStorage.length,0);
 assert.deepEqual(Object.keys(a.requests.find(x=>x.action==='register').data).sort(),['email','name','password']);
 assert(!D.querySelector('[data-auth-action="reload"]'));await a.W.ClubAuth.request('reload');await settle();assert(a.W.ClubAuth.user.emailVerified);
 const b=setup({...a.W.ClubAuth,configured:true,google:true,user:a.W.ClubAuth.user});await b.W.ClubAuth.init();assert(b.W.document.querySelector('.account-card'),'Session restored from the native SDK');b.dom.window.close();
 D.querySelector('[data-auth-action="logout"]').click();await settle();assert.equal(a.W.ClubAuth.user,null);assert(D.querySelector('[data-auth-form]'));
 D.querySelector('[data-auth-mode="login"]').click();D.querySelector('[name="email"]').value='user@club.test';D.querySelector('[name="password"]').value='wrong-password';
 D.querySelector('[data-auth-password]').click();assert.equal(D.querySelector('[name="password"]').type,'text');
 D.querySelector('form').dispatchEvent(new a.W.Event('submit',{bubbles:true,cancelable:true}));await settle();assert(D.querySelector('[role="alert"]'));assert.equal(D.querySelector('[name="email"]').value,'user@club.test');
 D.querySelector('[data-auth-mode="reset"]').click();assert.equal(D.querySelectorAll('input').length,1);D.querySelector('[name="email"]').value='user@club.test';D.querySelector('form').dispatchEvent(new a.W.Event('submit',{bubbles:true,cancelable:true}));await settle();assert(a.requests.some(x=>x.action==='reset'));
 D.querySelector('[data-auth-mode="login"]').click();D.querySelector('[data-auth-action="google"]').click();await settle();assert.equal(a.W.ClubAuth.user,null,'Cancelling Google does not invent a session');assert(a.requests.some(x=>x.action==='google'));a.dom.window.close();
 const c=setup({configured:false,google:false,user:null});await c.W.ClubAuth.init();assert(c.W.document.querySelector('[data-auth-form] button[type="submit"]').disabled);assert(!c.W.document.querySelector('[data-page="Inicio"]'));c.dom.window.close();
 const d=setup({configured:true,google:true,user:{uid:'id',name:'<img src=x onerror=alert(1)>',email:'safe@club.test',emailVerified:true}});await d.W.ClubAuth.init();assert.equal(d.W.document.querySelector('.account-card img'),null);d.dom.window.close();
 console.log('Registration validation, native identity and restored session, no verification gate, logout, login errors, recovery, Google cancellation, safe names and explicit unconfigured preview passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

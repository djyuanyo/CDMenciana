const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(process.env.CDM_ASSETS||'android/app/src/main/assets');
 // Match the allowlist in the shipped Java WebView handler, not a generic web host.
 const java=fs.readFileSync('android/app/src/main/java/es/cdmenciana/app/BundledAssets.java','utf8');
 const allowed=new Set([...java.matchAll(/"([\w.-]+)"/g)].map(m=>m[1]));
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const [,src] of index.matchAll(/<script[^>]*src="([^"]+)"/g))assert(allowed.has(src),'Android blocks '+src);
 const server=http.createServer((req,res)=>{
  const name=req.url.split('?')[0].replace(/^\//,'')||'index.html';
  if(!(allowed.has(name)||/^players\/[a-f0-9]{16}\.webp$/.test(name)||/^crests\/[a-f0-9]{16}\.(png|jpg)$/.test(name))||!fs.existsSync(path.join(root,name))){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(name)]||'application/json');res.end(fs.readFileSync(path.join(root,name)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CDM_CHROMIUM,args:['--no-sandbox']});
 try{
 for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],profiles={};page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(theme=>{
   localStorage.setItem('cdm-theme',theme);
   window.testIdentity={uid:'ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',email:'Juanjocarrillo7@gmail.com',name:'Juanjo',emailVerified:false};
   window.testNextIdentity=null;
   window.ClubAuthNative={request(id,action){if(action==='logout')testIdentity=null;if(action==='google')testIdentity=testNextIdentity;queueMicrotask(()=>ClubAuth.receive(id,{ok:true,configured:true,google:true,user:testIdentity,...(action==='token'?{token:'native-token'}:{})}));}};
  },theme);
  await page.route('https://firestore.googleapis.com/**',route=>{
   const request=route.request(),url=new URL(request.url()),uid=decodeURIComponent(url.pathname.split('/').pop());
   let data,status=200;
   if(url.searchParams.has('pageSize'))data={documents:Object.values(profiles)};
   else if(request.method()==='PATCH'){profiles[uid]={name:'clubUsers/'+uid,fields:request.postDataJSON().fields};data=profiles[uid];}
   else if(url.pathname.includes('clubDeletedAccounts')||!profiles[uid]){status=404;data={error:{status:'NOT_FOUND',message:'Document profile not found.'}};}
   else data=profiles[uid];
   return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.route('https://raw.githubusercontent.com/**',route=>route.abort());await page.route('https://cms.cdmenciana.es/**',route=>route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForSelector('[data-page="Administración"]');
  assert(await page.getByText('Administrador',{exact:true}).isVisible());assert.equal(await page.locator('[data-registration-dialog]').count(),0);
  await page.locator('[data-page="Administración"]').click();await page.waitForSelector('.admin-summary');
  if(process.env.CDM_QA_OUTPUT)await page.screenshot({path:path.join(process.env.CDM_QA_OUTPUT,'panel-admin-025-'+theme+'.png')});
  await page.locator('.profile-btn[data-page="Mi cuenta"]').click();await page.locator('[data-auth-action=logout]').click();await page.waitForSelector('[data-auth-form=login]');
  await page.evaluate(()=>testNextIdentity={uid:'ordinary',email:'ordinary@club.test',name:'Otra cuenta',emailVerified:true});
  await page.locator('[data-auth-action=google]').click();await page.waitForSelector('[data-registration-dialog][open]');
  assert(await page.locator('[data-registration-dialog]').evaluate(d=>d.matches(':modal')));
  await page.keyboard.press('Escape');assert(await page.locator('[data-registration-dialog]').isVisible());assert(!(await page.locator('#nav').isVisible()));
  await page.locator('[name=registrationType]').selectOption('team');await page.locator('[name=teamRole]').selectOption('player');
  assert.equal(await page.locator('[name=category] option').count(),8);await page.locator('[name=category]').selectOption('Infantil');
  await page.locator('[data-registration-form] button[type=submit]').click();assert(!profiles.ordinary,'Missing birthday must not save');
  await page.locator('[name=birthDate]').fill('2012-03-20');
  if(process.env.CDM_QA_OUTPUT)await page.screenshot({path:path.join(process.env.CDM_QA_OUTPUT,'registro-obligatorio-025-'+theme+'.png')});
  await page.locator('[data-registration-form] button[type=submit]').click();await page.waitForSelector('#nav',{state:'visible'});assert.equal(profiles.ordinary.fields.birthDate.stringValue,'2012-03-20');
  assert.equal(await page.locator('[data-registration-dialog]').count(),0);
  await page.locator('.profile-btn[data-page="Mi cuenta"]').click();assert.equal(await page.locator('[data-page="Administración"]').count(),0);
  await page.locator('[data-auth-action=logout]').click();await page.waitForSelector('[data-auth-form=login]');
  await page.evaluate(()=>testNextIdentity={uid:'second',email:'second@club.test',name:'Segunda cuenta',emailVerified:false});await page.locator('[data-auth-action=google]').click();await page.waitForSelector('[data-registration-dialog][open]');
  assert.equal(await page.locator('[name=registrationType]').inputValue(),'');assert.equal(await page.locator('[name=name]').inputValue(),'Segunda cuenta');
  await page.locator('[name=registrationType]').selectOption('member');assert(await page.locator('[name=memberNumber]').isVisible());await page.locator('[data-registration-form] button[type=submit]').click();assert(!profiles.second);
  await page.locator('[name=memberNumber]').fill('0012');await page.locator('[data-registration-form] button[type=submit]').click();await page.waitForSelector('#nav',{state:'visible'});assert.equal(profiles.second.fields.memberNumber.stringValue,'0012');
  await page.reload();await page.waitForSelector('#nav',{state:'visible'});assert.equal(await page.locator('[data-registration-dialog]').count(),0);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Native allowlist bootstrap, owner panel with no profile, mandatory modal, Escape, account switching, categories, birthday, member number and persisted completion passed in both themes.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

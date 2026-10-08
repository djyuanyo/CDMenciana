const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve('hosting/dist'),server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CDM_CHROMIUM,args:['--no-sandbox']});
 const token='a.'+Buffer.from(JSON.stringify({auth_time:Math.floor(Date.now()/1000)})).toString('base64url')+'.c';
 try{
 for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(theme=>localStorage.setItem('cdm-theme',theme),theme);
  await page.route('**/firebase-web.js',route=>route.fulfill({contentType:'application/javascript',body:`let identity=null;window.ClubAuthWeb={async request(action){if(action==='google')identity={uid:'google',name:'Google User',email:'google@club.test',emailVerified:false};if(action==='logout')identity=null;if(action==='token')return {token:${JSON.stringify(token)},user:identity};window.ClubAuth.update({configured:true,google:true,user:identity});return {configured:true,google:true,user:identity};}};`}));
  let profile=null,marker=false,commits=0,authDeletes=0;
  const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  await page.route('https://firestore.googleapis.com/**',route=>{
   const url=route.request().url();
   if(url.includes(':commit')){commits++;profile=null;marker=true;return reply(route,{writeResults:[]});}
   if(url.includes('clubDeletedAccounts'))return marker?reply(route,{fields:{requestedAt:{timestampValue:new Date().toISOString()}}}):reply(route,{error:{status:'NOT_FOUND',message:'Document marker not found.'}},404);
   if(route.request().method()==='PATCH'){profile={name:'clubUsers/google',fields:route.request().postDataJSON().fields};return reply(route,profile);}
   return profile?reply(route,profile):reply(route,{error:{status:'NOT_FOUND',message:'Document profile not found.'}},404);
  });
  await page.route('https://identitytoolkit.googleapis.com/**',route=>{authDeletes++;return authDeletes===1?reply(route,{error:{message:'INTERNAL_ERROR'}},500):reply(route,{});});
  await page.route('https://raw.githubusercontent.com/**',route=>route.abort());await page.route('https://cms.cdmenciana.es/**',route=>route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('[data-auth-action=google]').click();await page.waitForSelector('[data-registration-form]');
  assert(await page.locator('[data-delete-account]').isVisible(),'Incomplete registrations must also be deletable');
  await page.locator('[name=registrationType]').selectOption('fan');await page.locator('[data-registration-form] button[type=submit]').click();await page.waitForSelector('#nav',{state:'visible'});
  await page.evaluate(()=>{document.querySelector('#main').innerHTML=ClubAuth.screen(ClubAccess.user());});
  await page.locator('[data-delete-account]').click();await page.waitForSelector('dialog[open]');assert((await page.locator('dialog').innerText()).includes('Tu cuenta de Google no se elimina'));
  await page.locator('[data-dialog-cancel]').click();assert.equal(commits,0);assert.equal(authDeletes,0);
  await page.locator('[data-delete-account]').click();await page.waitForSelector('dialog[open]');
  if(process.env.CDM_QA_OUTPUT)await page.screenshot({path:path.join(process.env.CDM_QA_OUTPUT,'eliminar-cuenta-'+theme+'.png')});
  await page.locator('[data-dialog-confirm]').click();await page.waitForSelector('[data-delete-account]');await page.waitForFunction(()=>ClubAuth.message.includes('falta eliminar'));
  assert(await page.getByText('Eliminación pendiente',{exact:true}).isVisible());assert.equal(commits,1);assert.equal(authDeletes,1);assert(!(await page.locator('#nav').isVisible()));
  await page.locator('[data-delete-account]').click();await page.locator('[data-dialog-confirm]').click();await page.waitForSelector('[data-auth-form=login]');assert.equal(commits,1);assert.equal(authDeletes,2);
  assert((await page.locator('.auth-feedback').innerText()).includes('se ha eliminado'));assert.deepEqual(errors,[]);await page.close();
 }
 {
  const page=await browser.newPage({viewport:{width:390,height:844}}),uid='ZJeZEjtDeMRCYL0UOuvhGt0gNCT2';
  await page.addInitScript(()=>localStorage.setItem('cdm-theme','light'));
  await page.route('**/firebase-web.js',route=>route.fulfill({contentType:'application/javascript',body:`window.ClubAuthWeb={async request(action){const user={uid:'${uid}',name:'Juanjo',email:'juanjocarrillo7@gmail.com',emailVerified:false};if(action==='token')return {token:${JSON.stringify(token)},user};window.ClubAuth.update({configured:true,google:true,user});return {configured:true,google:true,user};}};`}));
  const fields=value=>Object.fromEntries(Object.entries(value).map(([k,v])=>[k,{stringValue:v}]));
  const own={name:'clubUsers/'+uid,fields:fields({name:'Juanjo',email:'juanjocarrillo7@gmail.com',role:'fan',registrationType:'fan',registrationComplete:'true',teamRole:'',memberNumber:'',category:'',birthDate:''})};
  await page.route('https://firestore.googleapis.com/**',route=>{let data,status=200;const url=route.request().url();if(url.includes('clubDeletedAccounts')){status=404;data={error:{status:'NOT_FOUND',message:'Document marker not found.'}};}else if(url.includes('pageSize'))data={documents:[own,{name:'clubUsers/player',fields:fields({name:'Usuario del club',email:'usuario@club.test',role:'fan',registrationType:'team',teamRole:'player',category:'Infantil',birthDate:'2012-03-20',memberNumber:'',registrationComplete:'true'})}]};else data=own;return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});});
  await page.route('https://raw.githubusercontent.com/**',route=>route.abort());await page.route('https://cms.cdmenciana.es/**',route=>route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForSelector('#nav',{state:'visible'});await page.locator('.profile-btn[data-page="Mi cuenta"]').click();await page.waitForSelector('[data-page="Administración"]');assert((await page.locator('.account-club-access').innerText()).includes('Administrador'));assert(!(await page.locator('[data-auth-action="verify"]').count()));
  await page.locator('[data-page="Administración"]').click();await page.waitForSelector('[data-club-role="player"]');assert(await page.getByText('Panel de control',{exact:true}).isVisible());assert.equal(await page.locator('[data-delete-user]').count(),1);
  if(process.env.CDM_QA_OUTPUT)await page.screenshot({path:path.join(process.env.CDM_QA_OUTPUT,'panel-admin-024.png'),fullPage:true});
  await page.close();
 }
 console.log('Deletion UI: light/dark confirmation, cancel, incomplete Google registration, failed Auth deletion, retry, login return and pinned administrator panel without verification passed.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

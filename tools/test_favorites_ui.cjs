const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(process.env.CDM_ASSETS||'android/app/src/main/assets');const server=http.createServer((req,res)=>{const name=req.url.split('?')[0]==='/'?'index.html':decodeURIComponent(req.url.split('?')[0].slice(1)),file=path.join(root,name);if(!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CDM_CHROMIUM,args:['--no-sandbox']});
 try{for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],saved=new Map();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(theme=>{localStorage.setItem('cdm-theme',theme);window.ClubAuthNative={request(id,action){const user={uid:'one',name:'Usuario del club',email:'one@club.test',emailVerified:false};queueMicrotask(()=>ClubAuth.receive(id,{ok:true,configured:true,google:true,user,token:action==='token'?'token':undefined}));}};},theme);
 const fields=v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,{stringValue:x}]));
 await page.route('https://firestore.googleapis.com/**',route=>{const request=route.request(),url=new URL(request.url());let data,status=200;
 if(url.pathname.includes('clubDeletedAccounts')||url.pathname.includes('clubNotificationConfig')){status=404;data={error:{status:'NOT_FOUND',message:'Document profile not found.'}};}
 else if(url.pathname.includes('/favorites')){if(request.method()==='PATCH'){data={name:url.pathname.slice(4),fields:request.postDataJSON().fields};saved.set(url.pathname.split('/').pop(),data);}else if(request.method()==='DELETE'){saved.delete(url.pathname.split('/').pop());data={};}else data={documents:[...saved.values()]};}
 else data={name:'clubUsers/one',fields:fields({name:'Usuario del club',email:'one@club.test',role:'fan',registrationType:'fan',teamRole:'',memberNumber:'',category:'',birthDate:'',registrationComplete:'true'})};
 return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});});
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort());await page.route('https://cms.cdmenciana.es/**',route=>route.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForSelector('#nav',{state:'visible'});await page.locator('#nav [data-page="Más"]').click();await page.locator('[data-page="Favoritos"]').click();await page.waitForFunction(()=>ClubFavorites.catalog.size>20);
 const star=page.locator('.favorite-list [data-favorite]').first(),id=await star.getAttribute('data-favorite');await star.click();await page.waitForFunction(id=>ClubFavorites.selected(id),id);assert(saved.has(id));assert(await page.getByText('Equipos que sigues',{exact:true}).isVisible());
 await page.locator('[data-favorite-alerts]').click();await page.getByText('Los avisos todavía no están disponibles. Tus favoritos sí se guardan.',{exact:true}).waitFor();
 if(process.env.CDM_QA_OUTPUT)await page.screenshot({path:path.join(process.env.CDM_QA_OUTPUT,'favoritos-026-'+theme+'.png')});
 await page.reload();await page.waitForFunction(id=>ClubFavorites.selected(id),id);await page.locator('#nav [data-page="Más"]').click();await page.locator('[data-page="Favoritos"]').click();await page.locator('.favorite-remove').click();await page.waitForFunction(()=>ClubFavorites.rows.length===0);assert.equal(saved.size,0);
 await page.locator('#nav [data-page="Partidos"]').click();await page.waitForSelector('.fixture-team [data-favorite]');await page.locator('#tabs [data-page="Clasificación"]').click();await page.waitForSelector('.standings-table [data-favorite]');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal page overflow');assert.deepEqual(errors,[]);await page.close();
 }console.log('Favorites UI: both themes, stars, account persistence, removal, safe unavailable notification state, matches and standings passed.');}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

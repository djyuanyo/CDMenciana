/* Store screenshots render the exact HTML/CSS shipped in the Android WebView. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
async function run(){
 const assets=path.resolve('android/app/src/main/assets'),output=path.resolve(process.env.CDM_PLAY_OUTPUT||'play-store');fs.mkdirSync(output,{recursive:true});
 const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'')||'index.html',file=path.resolve(assets,name);if(!file.startsWith(assets+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CDM_CHROMIUM,args:['--no-sandbox']});
 const errors=[],shots=[];
 try{
  const page=await browser.newPage({viewport:{width:360,height:720},deviceScaleFactor:3});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('cdm-theme','dark');window.ClubAuthNative={request(id,action){queueMicrotask(()=>ClubAuth.receive(id,{ok:true,configured:true,google:true,user:null}));}};});
  await page.route('https://firestore.googleapis.com/**',()=>{throw Error('Guest screenshots must not access private data');});
  await page.goto(origin,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ClubMatchdays&&Object.keys(ClubMatchdays.snapshots).length===Object.keys(Fixtures.teams).length);
  assert.equal(await page.locator('.matchday-card').count(),await page.evaluate(()=>Object.keys(Fixtures.teams).length));
  async function capture(name){await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(250);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page must not overflow horizontally');await page.screenshot({path:path.join(output,name),fullPage:false});shots.push(name);}
  await capture('01-inicio-oscuro.png');
  // The horizontal carousel uses each club category, including categories added by the club.
  await page.locator('.matchday-carousel').evaluate(el=>el.scrollLeft=el.scrollWidth);await capture('02-categorias-oscuro.png');
  await page.locator('button[data-theme-toggle]').click();await page.locator('#nav [data-page="Partidos"]').click();await page.waitForSelector('.fixture-card');await capture('03-calendario-claro.png');
  await page.locator('#tabs [data-page="Clasificación"]').click();await page.waitForSelector('.standings-table');await capture('04-clasificacion-claro.png');
  await page.locator('#tabs [data-page="Club"]').click();await page.waitForSelector('.roster-grid');await capture('05-plantilla-claro.png');
  await page.locator('.profile-btn[data-page="Mi cuenta"]').click();await page.waitForSelector('[data-adult-access]');await capture('06-acceso-cuenta-claro.png');
  const before=await page.locator('#header').boundingBox();await page.evaluate(()=>window.scrollTo(0,400));const after=await page.locator('#header').boundingBox();assert(Math.abs(before.y-after.y)<=1,'Header stays fixed');
  assert.deepEqual(errors,[]);await page.close();
  const artwork=await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:1});
  await artwork.setContent(`<html><style>html,body{margin:0;width:512px;height:512px;background:#fff;display:grid;place-items:center}img{width:384px;height:384px;object-fit:contain}</style><img src="${origin}/crest.png" alt="CD Menciana"></html>`);await artwork.locator('img').evaluate(img=>img.decode());await artwork.screenshot({path:path.join(output,'icono-512.png'),omitBackground:false});
  await artwork.setViewportSize({width:1024,height:500});
  await artwork.setContent(`<html lang="es"><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:1024px;height:500px;overflow:hidden}body{background:radial-gradient(ellipse at 85% 0,#15536d 0,transparent 55%),linear-gradient(135deg,#101c32,#192d46);font-family:Arial,sans-serif;color:white;padding:48px 76px}.logo{position:relative;width:610px;height:210px;margin:0 auto 30px;overflow:hidden}.logo img{position:absolute;left:50%;top:50%;width:202.96%;transform:translate(-50.15625%,-46.875%)}h1{font-size:36px;text-align:center;margin:0 0 18px;letter-spacing:-.5px}p{text-align:center;font-size:22px;color:#9adeef;margin:0;letter-spacing:2px}.court{position:absolute;inset:24px;border:1px solid #72c5dc22;border-radius:22px;pointer-events:none}.court:after{content:'';width:180px;height:180px;border:1px solid #72c5dc22;border-radius:50%;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}</style><div class="court"></div><div class="logo"><img src="${origin}/club-header-dark.png" alt="Club Deportivo Menciana"></div><h1>Tu club, siempre contigo.</h1><p>PARTIDOS · RESULTADOS · NOTICIAS</p></html>`);
  await artwork.locator('img').evaluate(img=>img.decode());await artwork.screenshot({path:path.join(output,'grafico-destacado-1024x500.png')});await artwork.close();
  fs.writeFileSync(path.join(output,'capturas.json'),JSON.stringify({source:'Interfaz real incluida en el AAB, modo público sin cuenta ni datos privados',width:1080,height:2160,screenshots:shots,icon:{file:'icono-512.png',width:512,height:512},feature:{file:'grafico-destacado-1024x500.png',width:1024,height:500},categories:JSON.parse(fs.readFileSync(path.join(assets,'club-teams.json'))).teams.map(t=>t.label)},null,2));
  console.log('Ficha visual verificada: '+shots.length+' capturas reales, icono de 512 px y gráfico de 1024 × 500 px.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});

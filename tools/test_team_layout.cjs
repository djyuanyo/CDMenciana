const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CDM_CHROMIUM,args:['--no-sandbox']});try{
 for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width:390,height:780}});
  await page.setContent(`<html data-theme="${theme}"><body><header id="header"></header><div id="teams"></div><div id="banner"></div><div id="tabs"></div><main id="main"></main><nav id="nav"></nav></body></html>`);
  for(const name of ['style.css','theme.css'])await page.addStyleTag({content:fs.readFileSync('android/app/src/main/assets/'+name,'utf8')});
  for(const name of ['ui.js','fixtures.js'])await page.addScriptTag({content:fs.readFileSync('android/app/src/main/assets/'+name,'utf8')});
  await page.evaluate(()=>{window.Appearance={button:()=>''};});
  for(const key of ['first','filial','infantil']){
   const filename=key==='first'?'fixtures.json':`fixtures-${key}.json`;
   // Layout-only model: this test must not depend on a successful RFAF sync.
   const feed=key==='infantil'?{team:'C.D. MENCIANA CENTRO CICLOTURISTA SUBBETICA'}:JSON.parse(fs.readFileSync('data/'+filename,'utf8'));
   await page.evaluate(({key,feed})=>{Fixtures.selectedTeam=key;Fixtures.data=feed;CDM.shell('Inicio',null);const model={teams:[{name:feed.team,starters:[],bench:[],cards:[{minute:'20',name:'Jugador',type:'Amarilla'}]},{name:'Rival',starters:[],bench:[],cards:[]}],goals:[{minute:'30',name:'Jugador',type:'Gol',score:'1-0',side:0}]};document.getElementById('main').innerHTML=Fixtures.reportTimeline(model,{home:feed.team,away:'Rival'})+'<div style="height:1800px"></div>';window.scrollTo(0,0);},{key,feed});
   const metrics=await page.evaluate(()=>({goal:getComputedStyle(document.querySelector('.acta-timeline-event.goal')).boxShadow,card:getComputedStyle(document.querySelector('.acta-timeline-event.card')).boxShadow,stroke:getComputedStyle(document.querySelector('.court rect')).stroke,header:getComputedStyle(document.querySelector('#header')).position}));
   assert.notEqual(metrics.goal,'none');assert.equal(metrics.card,'none');assert.equal(metrics.header,'sticky');if(theme==='light')assert.equal(metrics.stroke,'rgb(36, 103, 184)');
   await page.evaluate(()=>window.scrollTo(0,600));assert.equal(await page.locator('#header').evaluate(el=>Math.round(el.getBoundingClientRect().top)),0);
   if(process.env.CDM_QA_OUTPUT&&key==='infantil')await page.screenshot({path:process.env.CDM_QA_OUTPUT+'/infantil-'+theme+'.png'});
  }
  await page.close();
 }
 console.log('All categories: sticky header, raised goals, plain cards, blue court in light mode.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

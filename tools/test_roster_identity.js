const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const assets='android/app/src/main/assets/',read=name=>fs.readFileSync(assets+name,'utf8'),clone=value=>JSON.parse(JSON.stringify(value));
const first=JSON.parse(read('fixtures.json')),old=clone(first);
delete old.staff;delete old.staff_status;delete old.staff_updated_at;
delete old.roster_status;delete old.roster_updated_at;
old.roster=[{number:5,name:'Cala',position:'Jugador de pista',photo:''}];
old.standings[0].points=123;old.connection_state='cached';
const dom=new JSDOM('<header id="header"></header><div id="teams"></div><section id="banner"></section><div id="tabs"></div><main id="main"></main><nav id="nav"></nav><p id="notice"></p>',{url:'https://appassets.androidplatform.net/',runScripts:'outside-only'}),W=dom.window;
W.scrollTo=()=>{};let requested=[];
W.fetch=async url=>({ok:true,json:async()=>{
 const value=String(url);
 if(value.startsWith('actas/'))return JSON.parse(read(value));
 if(value.startsWith('news'))return {news:[]};
 if(value.startsWith('rfaf-player/')){
  const id=value.match(/^rfaf-player\/(\d+)\.json/)[1];requested.push(id);
  return {stats:[{title:'Partidos',rows:[['Jugados','4'],['Titular','2']]}],updated_at:new Date().toISOString()};
 }
 return clone(old);
}});
for(const name of ['appearance.js','ui.js','auth.js','club-access.js','news-reader.js','rfaf_extract.js','roster-snapshot.js','fixtures.js','offline.js'])W.eval(read(name));
const settle=()=>new Promise(r=>W.setTimeout(r,20));
(async()=>{
 await settle();const f=W.Fixtures;
 assert.equal(f.data.staff.length,4,'A cached calendar cannot erase the bundled RFAF staff');
 assert.equal(f.data.roster.length,first.roster.length);
 assert.equal(f.data.standings[0].points,123,'Fresh match and table data remain intact');
 const empty={...first,staff:[],staff_status:'verified',staff_updated_at:'2099-01-01T00:00:00Z'};
 assert.equal(f.mergeRosterSnapshot(empty,'first').staff.length,0,'A newer official empty staff list is respected');
 W.document.querySelector('#nav [data-page="Club"]').click();
 assert.equal(W.document.querySelectorAll('.staff-member').length,4);
 for(const row of first.roster){
  const href=f.playerHref(row.id,row.acta_id,'plantilla'),link=[...W.document.querySelectorAll('.player-details a')].find(a=>a.getAttribute('href')===href);
  assert(link,'Every official player has an internal profile link');
  const before=requested.length;link.click();await settle();
  assert.equal(W.document.querySelector('.player-rfaf-hero h1').textContent,f.personName(row.name));
  const tile=[...W.document.querySelectorAll('.player-match-stats > div')].find(n=>n.querySelector('small')?.textContent==='Dorsal');
  assert.equal(Number(tile.querySelector('strong').textContent),row.number);
  assert.equal(f.prepareRosterPlayer(row.id,row.acta_id).rfaf_id,row.rfaf_id);
  if(requested.length>before)assert.equal(requested.at(-1),row.rfaf_id,'Statistics requests use the exact federation identity');
  assert(W.document.querySelector('[data-roster-back]'));
  W.document.querySelector('[data-roster-back]').click();await settle();
  assert(W.document.querySelector('.roster-grid'));
 }
 const row=first.roster.find(p=>p.number===5);
 f.reportData=JSON.parse(read('actas/'+row.acta_id+'.json'));f.reportData.players=[];f.ensureReportPlayers(row.acta_id);
 const repaired=f.prepareRosterPlayer(row.id,row.acta_id);
 assert.equal(repaired.rfaf_id,row.rfaf_id,'An older acta can recover its identity by exact official name and dorsal');
 repaired.profile_url=first.roster.find(p=>p.number!==row.number).profile_url;
 assert.equal(f.prepareRosterPlayer(row.id,row.acta_id),null,'A conflicting federation identity is never attached by dorsal alone');
 dom.window.close();console.log('Older cached staff, all first-team player links, official dorsals, exact statistics IDs and return to roster passed');
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});

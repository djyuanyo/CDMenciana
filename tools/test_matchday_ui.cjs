const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<body><main id="main"></main></body>',{runScripts:'outside-only',url:'https://club.test/'}),w=dom.window;
w.CDM={icon:()=>'',empty:()=>''};w.eval(fs.readFileSync('server/static/rfaf_extract.js','utf8'));w.eval(fs.readFileSync('server/static/fixtures.js','utf8'));w.eval(fs.readFileSync('server/static/matchday.js','utf8'));
const f=w.Fixtures,c=w.ClubMatchdays,r=w.ClubRefresh;
const game=(round,date,played=false)=>({round,date,played,home:'Nombre largo del local',away:'Visitante',time:'12:00',home_score:2,away_score:1});
const data={matches:[game(1,'2026-10-01',true)],round_matches:[game(1,'2026-10-01',true),game(2,'2026-10-11'),game(2,'2026-10-12'),game(3,'2026-10-25')]};
assert.equal(c.round(data,'2026-10-09'),'2');assert.equal(c.round(data,'2026-10-12'),'2');assert.equal(c.round({matches:[game(1,'2026-10-01',true)]},'2026-10-09'),'1');
f.teams={first:{label:'Primer Equipo',filename:'fixtures.json'},rfaf_10_20:{label:'Cadete',filename:'fixtures-rfaf_10_20.json'}};f.selectedTeam='first';f.data=data;
c.snapshots={first:data,rfaf_10_20:data};
const actualRound=c.round.bind(c);c.round=data=>actualRound(data,'2026-10-09');const html=c.screen();assert.equal((html.match(/class="matchday-carousel"/g)||[]).length,2);assert.equal((html.match(/class="matchday-card"/g)||[]).length,4);assert(html.includes('Cadete'));assert(html.includes('12:00'));
assert(c.card({...game(2,'2026-10-11',true),acta_url:'https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?CodActa=123'},'rfaf_10_20').includes('#acta=123&amp;equipo=rfaf_10_20'));
assert(!c.card({...game(2,'2026-10-11'),acta_url:'https://evil.test/?CodActa=123'},'first').includes('Ver acta'));
const target=w.document.querySelector('main');let refreshed=0;w.refreshScreen=async()=>{refreshed++};
function touch(type,x,y){const event=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'touches',{value:type==='touchend'?[]:[{clientX:x,clientY:y}]});target.dispatchEvent(event);return event;}
(async()=>{touch('touchstart',10,10);touch('touchmove',100,30);touch('touchend',100,30);assert.equal(refreshed,0);touch('touchstart',10,10);touch('touchmove',10,50);touch('touchend',10,50);assert.equal(refreshed,0);touch('touchstart',10,10);assert(touch('touchmove',10,110).defaultPrevented);touch('touchend',10,110);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(refreshed,1);await Promise.all([r.run(),r.run()]);assert.equal(refreshed,2);console.log('Category rounds, all rivals, safe acta navigation, horizontal gesture and refresh threshold verified');dom.window.close();})().catch(e=>{console.error(e);process.exitCode=1});

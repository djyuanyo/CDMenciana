const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
new vm.Script(fs.readFileSync('android/app/src/main/assets/fixtures.js','utf8'),{filename:'android fixtures.js'});
const ctx={window:{},document:{addEventListener(){}},CDM:{icon:()=>'',empty:()=>''},URL};vm.createContext(ctx);vm.runInContext(fs.readFileSync('server/static/fixtures.js','utf8'),ctx);const f=ctx.window.Fixtures;
f.data={matches:[{round:1,played:true},{round:4,played:true},{round:5,played:false,time:''},{round:6,played:false,time:'19:00'}]};
assert.equal(f.defaultRound(),'4','Later confirmed fixtures must not skip the immediate next round');
f.data.matches[2].time='18:30';assert.equal(f.defaultRound(),'5');
f.data.matches[2].time='29:70';assert.equal(f.defaultRound(),'4');
f.data.matches=[];assert.equal(f.defaultRound(),'all');
f.data.matches=[{round:1,played:false,time:''}];assert.equal(f.defaultRound(),'1');
f.data=JSON.parse(fs.readFileSync('data/fixtures.json','utf8'));assert(f.team(f.data.team,f.data.matches[0].home_crest).includes(f.esc(f.data.team)));
assert(f.standings().includes(f.esc(f.data.team)));
assert(f.clubCrest().startsWith('crests/'));assert(f.card({...f.data.matches[4],played:false,time:''}).includes('time-unconfirmed'));
for(const m of f.data.matches)for(const side of ['home','away']){const image=f.crest(m[side],m[side+'_crest']);assert(image.startsWith('crests/'));assert(fs.existsSync('android/app/src/main/assets/'+image));}
f.round=null;const selected=f.defaultRound();assert(f.calendar().includes(`data-round="${selected}" role="tab" aria-selected="true"`));f.round='all';assert(f.calendar().includes('data-round="all" role="tab" aria-selected="true"'));
console.log('Default round, exact team name, pending time and all official crest assets verified');
const actual=f.data;
f.data={matches:[],scorers:[{name:'Jugador del club',team:'C.D. APAGA Y VAMONOS',played:2,goals:3,average:1.5},{name:'Rival',team:'Otro equipo',played:0,goals:2,average:null}]};
const scorers=f.scorers();assert.equal((scorers.match(/scorer-row our-club/g)||[]).length,1);assert(!scorers.includes('null'));assert(scorers.includes('Jugador del club'));
f.data=actual;assert(f.data.roster.length>0&&f.data.scorers.length>0);
const roster=f.roster();for(const p of f.data.roster){assert(roster.includes(f.esc(p.name)));assert(roster.includes('Dorsal '+p.number));const photo=f.photo(p);if(photo.startsWith('players/'))assert(fs.existsSync('android/app/src/main/assets/'+photo));else assert(photo.startsWith('https://cdmenciana.es/images/jugadores/'));}
console.log('Scorer highlighting and roster names, shirt numbers and photos verified');
for(const [key,file,counts] of [['first','fixtures.json',[1,2,1]],['filial','fixtures-filial.json',[1,1,0]]]){
 f.selectTeam(key);f.data=JSON.parse(fs.readFileSync('data/'+file,'utf8'));
 const staff=f.staff(),roster=f.roster();
 assert(roster.includes('Cuerpo técnico'));
 for(const [i,group] of ['technicians','delegates','assistants'].entries())assert.equal(f.data.staff.filter(p=>p.group===group).length,counts[i]);
 for(const person of f.data.staff)assert(staff.includes(f.esc(f.personName(person.name)))&&staff.includes(f.esc(person.role)));
 assert(staff.includes('Codigo_Equipo='+ (key==='first'?'2137495':'48536795')));
 if(key==='filial'){assert(staff.includes('Sin auxiliares publicados'));assert(!staff.includes('Juan Luna'));}
}
f.selectTeam('first');f.data=actual;
console.log('Both rosters include their own official technicians, delegates and assistants');

f.newsData=JSON.parse(fs.readFileSync('data/news.json','utf8'));const news=f.news();for(const n of f.newsData.news){assert(news.includes(f.esc(n.title)));assert(news.includes(f.esc(n.url)));}assert(!news.includes('PRÓXIMO PARTIDO'));console.log('Home news cards and original article links verified');

const allData=JSON.parse(fs.readFileSync('data/fixtures.json','utf8'));
f.data=allData;f.round='5';const roundHtml=f.calendar();
assert.equal((roundHtml.match(/class="match-card fixture-card/g)||[]).length,8);
assert.equal((roundHtml.match(/fixture-card our-match/g)||[]).length,1);
const sorted=allData.round_matches.filter(m=>m.round===5).sort((a,b)=>f.kickoffOrder(a,b));
let previous=-1;for(const match of sorted){const position=roundHtml.indexOf(f.esc(match.home),previous+1);assert(position>previous);previous=position;}
assert(f.kickoffOrder({date:'2026-10-10',time:'17:30'},{date:'2026-10-10',time:''})<0);
assert(f.kickoffOrder({date:'2026-10-09',time:'21:00'},{date:'2026-10-10',time:'09:00'})<0);
console.log('Eight chronological round fixtures and exactly one highlighted club match verified');

const actaMatch={...allData.matches[0],played:true,acta_url:'https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?CodActa=1234'};
assert(f.card(actaMatch).includes('class="result-acta"'));
assert(f.card(actaMatch).includes('#acta=1234'));
assert(!f.card(actaMatch).includes('href="https://www.rfaf.es'));
f.reportData={updated_at:new Date().toISOString(),blocks:[{kind:'heading',text:'Goles'},{kind:'table',rows:[["Gol de penalti","(5′) Nombre <script>"]]}]};assert(f.report('1234').includes('Gol de penalti'));assert(f.report('1234').includes('&lt;script&gt;'));
assert(!f.card({...actaMatch,played:false}).includes('class="result-acta"'));
assert(!f.card({...actaMatch,acta_url:'https://other.example/?CodActa=1234'}).includes('class="result-acta"'));
console.log('Official per-match acta links and unpublished/unsafe link handling verified');

f.data=allData;f.reportData=JSON.parse(fs.readFileSync('data/actas/2645766.json','utf8'));const match=allData.round_matches.find(m=>m.acta_url?.includes('CodActa=2645766&'));const report=f.reportModel(f.reportData,match);
assert.deepEqual(Array.from(report.result),['2','2']);assert.equal(report.teams[0].starters.length,5);assert.equal(report.teams[1].starters.length,5);
assert.equal(report.teams[0].bench.length,6);assert.equal(report.goals.length,4);assert.equal(report.referees.length,3);
assert.equal(report.teams[0].cards.length,3);assert.equal(report.teams[1].cards.length,4);
f.reportSide=0;const localReport=f.report('2645766');assert(localReport.includes('acta-scoreboard'));assert.equal((localReport.match(/alt="Escudo de /g)||[]).length,4+report.goals.length+report.teams.reduce((sum,t)=>sum+t.cards.length,0));assert(localReport.includes('David Copete Rivero'));
f.reportSide=1;const awayReport=f.report('2645766');assert(awayReport.includes('Petru Emanuel Horodinca'));assert(!awayReport.includes('David Copete Rivero'));
console.log('Structured lineups, goal minutes, referee roles, cards and both club crests verified');

const events=f.reportEvents(report);
assert.equal(events.length,11);
assert.deepEqual(Array.from(events,e=>e.minute),["38'","36'","33'","27'","27'","21'","18'","16'","16'","13'","5'"]);
assert.deepEqual(Array.from(events,e=>e.kind),['goal','card','card','goal','card','goal','card','card','card','card','goal']);
assert.equal(events.find(e=>e.type==='Gol en propia puerta').side,1,'An own goal must carry its author’s team crest');
assert.equal(events.find(e=>e.name==='AGUILERA CABALLERO, RAFAEL').side,1,'Cards for staff also retain the team');
const timeline=f.reportTimeline(report,match);
assert(timeline.includes('aria-label="Goles y tarjetas por minuto"'));
assert.equal((timeline.match(/class="acta-timeline-crest"/g)||[]).length,11);
assert(!timeline.includes(report.teams[0].name+'</small>'));
assert(!timeline.includes(report.teams[1].name+'</small>'));
assert(timeline.includes('own-goal'));
assert.equal((timeline.match(/acta-timeline-score/g)||[]).length,4);
const unusual={goals:[{minute:"20+2'",name:'Añadido',type:'Gol',side:0},{minute:"20'",name:'Antes',type:'Gol',side:1},{minute:'',name:'Pendiente',type:'Gol',side:-1}],teams:[{cards:[{minute:"3'",type:'Tarjeta roja',name:'Roja'},{minute:"20+1'",type:'Segunda amarilla',name:'Expulsado'}]},{cards:[]}]};
assert.deepEqual(Array.from(f.reportEvents(unusual),e=>e.name),['Añadido','Expulsado','Antes','Roja','Pendiente']);
assert(f.reportEventIcon({kind:'card',type:'Segunda amarilla'}).includes('acta-card double'));
assert(f.reportEventIcon({kind:'card',type:'Tarjeta roja'}).includes('acta-card red'));
const fallback=f.reportModel({blocks:[{kind:'table',rows:[['Local','','Visitante'],['','2 - 1','']]},{kind:'heading',text:'Goles'},{kind:'table',rows:[['Gol · 1 - 0',"(5') Jugador desconocido"],['Gol en propia puerta · 2 - 0',"(6') Otro jugador"],['Gol de penalti · 2 - 1',"(7') Rival"]]}]},{home:'Local',away:'Visitante'});
assert.deepEqual(Array.from(fallback.goals,e=>e.side),[0,1,1]);
console.log('Combined event chronology, author crests, stoppage minutes, staff cards, goal types and missing-roster fallback verified');

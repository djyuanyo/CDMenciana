const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
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
f.round=null;const selected=f.defaultRound();assert(f.calendar().includes(`value="${selected}" selected`));f.round='all';assert(f.calendar().includes('value="all" selected'));
console.log('Default round, exact team name, pending time and all official crest assets verified');
const actual=f.data;
f.data={matches:[],scorers:[{name:'Jugador del club',team:'C.D. APAGA Y VAMONOS',played:2,goals:3,average:1.5},{name:'Rival',team:'Otro equipo',played:0,goals:2,average:null}]};
const scorers=f.scorers();assert.equal((scorers.match(/scorer-row our-club/g)||[]).length,1);assert(!scorers.includes('null'));assert(scorers.includes('Jugador del club'));
f.data=actual;assert(f.data.roster.length>0&&f.data.scorers.length>0);
const roster=f.roster();for(const p of f.data.roster){assert(roster.includes(f.esc(p.name)));assert(roster.includes('Dorsal '+p.number));const photo=f.photo(p);if(photo.startsWith('players/'))assert(fs.existsSync('android/app/src/main/assets/'+photo));else assert(photo.startsWith('https://cdmenciana.es/images/jugadores/'));}
console.log('Scorer highlighting and roster names, shirt numbers and photos verified');

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

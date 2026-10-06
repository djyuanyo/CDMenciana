const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('',{runScripts:'outside-only'});dom.window.CDM={icon:()=>'',empty:()=>''};dom.window.eval(fs.readFileSync('android/app/src/main/assets/fixtures.js','utf8'));
const f=dom.window.Fixtures;
const html=`<div class="container"><h4>Ficha de Partido</h4><h5>Temporada 2026-2027 Jornada 2</h5><h4>3ª División F.S. (Grupo 17)</h4>
<table><tr><td>Local</td><td></td><td>Visitante</td></tr><tr><td></td><td>1 - 0</td><td></td></tr></table>
<b>Árbitros</b><table><tr><td>ARBITRO</td></tr><tr><td></td><td>APELLIDO, NOMBRE DELEGACIÓN DE CÓRDOBA</td></tr></table>
<b>Goles</b><table><tr><td><i class="fa-futbol" style="color:rgb(21, 114, 228)"></i><i id="a"><script>ntype("a",4,0,"fa-1");window.harmful=true;</script>1<span style="display:none">9</span></i> - 0</td><td>(12') SANCHEZ, ALBERTO</td></tr></table>
<div>Local</div><h5>Titulares</h5><table><tr><td>10</td><td></td><td>SANCHEZ, ALBERTO</td></tr></table><h5>Suplentes</h5><h4>Cuerpo Técnico</h4><h5>Entrenador:<table><tr><td>GARCIA, DAVID</td></tr></table></h5><h4>Tarjetas</h4><table><tr><td><img src="tarj_roja.gif"></td><td>(30') SANCHEZ, ALBERTO</td></tr></table><div>Visitante</div><h5>Titulares</h5><table><tr><td>1</td><td>LOPEZ, JUAN</td></tr></table><h5>Suplentes</h5><h4>Cuerpo Técnico</h4><h4>Tarjetas</h4></div>`;
const blocks=f.parseReportHtml(html);const model=f.reportModel({blocks},{home:'Local',away:'Visitante'});
assert.equal(model.goals[0].score,'11 - 0');assert.equal(model.goals[0].type,'Gol de penalti');assert.equal(model.goals[0].minute,"12'");assert.equal(model.teams[0].starters[0].number,'10');assert.equal(model.teams[0].cards[0].type,'Tarjeta roja');assert.equal(model.teams[0].staff[0].role,'Entrenador');assert.equal(model.referees.length,1);assert.equal(dom.window.harmful,undefined);
assert.throws(()=>f.parseReportHtml(''));
console.log('On-device HTML extraction preserves scores, penalties, players, coaches and cards without running federation scripts');
const fullReport=JSON.parse(fs.readFileSync('data/actas/2645766.json','utf8'));
f.data=JSON.parse(fs.readFileSync('data/fixtures.json','utf8'));
const fixture=f.data.round_matches.find(m=>m.acta_url?.includes('CodActa=2645766&'));
const fullModel=f.reportModel(fullReport,fixture);
dom.window.document.body.innerHTML=f.reportTimeline(fullModel,fixture);
const rows=[...dom.window.document.querySelectorAll('.acta-timeline-event')];
assert.equal(rows.length,11);
for(const row of rows){
 const stamp=row.querySelector('.acta-timeline-stamp');
 assert(stamp.firstElementChild.classList.contains('acta-timeline-crest'));
 assert.equal(stamp.lastElementChild.tagName,'TIME');
 const name=row.querySelector('.acta-timeline-player');
 assert.equal(name.querySelectorAll('strong').length,1);
 assert(![...name.querySelectorAll('small')].some(n=>fullModel.teams.some(t=>t.name===n.textContent)));
 const ownSide=Number(row.dataset.eventSide);
 assert.equal(row.classList.contains(ownSide===0?'home':'away'),true);
 assert(row.querySelector('img').alt.includes(fullModel.teams[ownSide].name));
}
assert.equal(rows[0].querySelector('time').textContent,"38'");
assert.equal(dom.window.document.querySelectorAll('.acta-timeline-event .acta-timeline-score').length,4);
console.log('Timeline DOM keeps the author crest before the minute, separates the two teams and omits repeated team names');

const linked=fullModel.teams[0].starters[0];
f.reportData={...fullReport,players:[{id:'1234abcd',name:linked.name,profile_url:'https://www.rfaf.es/pnfg/NPcd/NFG_Jugador?jugador=77',photo:'https://rfaf.filesnovanet.es/pnfg/pimg/Jugadores/77.jpg',profile_updated_at:new Date().toISOString(),stats:[{title:'Temporada 2026-2027',rows:[['Temporada','Partidos','Goles'],['2026-2027','4','3']]}]}]};
const decorated=f.decorateReportPlayers(f.report('2645766'),'2645766');
dom.window.document.body.innerHTML=decorated;
const playerLinks=[...dom.window.document.querySelectorAll('a[data-player-link]')];
assert(playerLinks.length>=1);
assert(playerLinks.every(a=>a.getAttribute('href')==='#jugador=1234abcd&acta=2645766'));
assert(playerLinks.some(a=>a.querySelector('img.acta-player-avatar')?.src.includes('/pnfg/pimg/Jugadores/77.jpg')));
const profile=f.player('1234abcd','2645766');
assert(profile.includes('PERFIL RFAF'));assert(profile.includes('Estadísticas RFAF'));assert(profile.includes('2026-2027'));
assert(profile.includes('data-player-back'));assert(!profile.includes('href="https://www.rfaf.es'));
console.log('RFAF player photos are embedded throughout the acta and player statistics stay inside the app');

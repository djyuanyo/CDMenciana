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

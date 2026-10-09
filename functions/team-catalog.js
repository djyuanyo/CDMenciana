 'use strict';
const BASE={first:'2137495',filial:'48536795',infantil:'34369965'};
function validKey(key){return typeof key==='string'&&/^(first|filial|infantil|rfaf_[0-9]{1,12}_[0-9]{1,12})$/.test(key);}
function parseCatalog(value){
 if(value?.version!==1||!Array.isArray(value.teams)||value.teams.length<3||value.teams.length>30)throw Error('Catálogo de equipos no válido.');
 const seen=new Set(),identities=new Set();
 const teams=value.teams.map(t=>{
  if(!validKey(t.key)||seen.has(t.key)||!/^\d{1,12}$/.test(t.team_id||'')||!/^\d{1,12}$/.test(t.group_id||'')||!/^\d{1,12}$/.test(t.competition_id||'')||!/^\d{1,3}$/.test(t.season_id||'')||typeof t.label!=='string'||!t.label.trim()||t.label.length>80||typeof t.team_name!=='string'||!t.team_name||t.team_name.length>160||!Number.isSafeInteger(t.order)||t.order<1||t.order>99||t.status!=='active'||t.filename!==(t.key==='first'?'fixtures.json':`fixtures-${t.key}.json`))throw Error('Equipo no válido.');
  if(BASE[t.key]&&BASE[t.key]!==t.team_id||!BASE[t.key]&&t.key!==`rfaf_${t.group_id}_${t.team_id}`)throw Error('Identidad del equipo no válida.');
  const identity=t.group_id+'_'+t.team_id+'_'+t.season_id;if(identities.has(identity))throw Error('El equipo ya está añadido.');
  const u=new URL(t.source);const q=Object.fromEntries([...u.searchParams].map(([k,v])=>[k.toLowerCase(),v]));
  if(u.origin!=='https://www.rfaf.es'||u.pathname!=='/pnfg/NPcd/NFG_VisCalendario_Vis'||q.codcompeticion!==t.competition_id||q.codgrupo!==t.group_id||q.codtemporada!==t.season_id)throw Error('Fuente del equipo no válida.');
  seen.add(t.key);identities.add(identity);return {...t};
 }).sort((a,b)=>a.order-b.order||a.key.localeCompare(b.key));
 if(Object.keys(BASE).some(k=>!seen.has(k)))throw Error('Faltan equipos del club.');return teams;
}
function teamMap(teams){return teams?Object.fromEntries(teams.map(t=>[t.key,t.team_id])):{...BASE};}
module.exports={BASE,validKey,parseCatalog,teamMap};

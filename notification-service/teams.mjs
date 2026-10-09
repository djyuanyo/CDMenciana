import catalog from '../functions/team-catalog.js';
const REPO='djyuanyo/CDMenciana',fail=(message,status=400)=>Object.assign(Error(message),{status});
export function calendarSource(input){
 let u;try{u=new URL(input);}catch{throw fail('Pega un enlace de calendario RFAF válido.');}
 if(u.protocol!=='https:'||!['www.rfaf.es','rfaf.es'].includes(u.hostname)||u.username||u.password||u.port||!['/pnfg/NPcd/NFG_VisCalendario_Vis','/pnfg/NPcd/NFG_CmpJornada'].includes(u.pathname))throw fail('Utiliza el enlace público del calendario de RFAF.');
 const fields={};for(const [k,v] of u.searchParams){const key=k.toLowerCase();if(Object.hasOwn(fields,key))throw fail('El enlace tiene parámetros repetidos.');fields[key]=v;}
 if(!/^\d{1,12}$/.test(fields.codcompeticion||'')||!/^\d{1,12}$/.test(fields.codgrupo||'')||!/^\d{1,3}$/.test(fields.codtemporada||''))throw fail('El enlace debe incluir competición, grupo y temporada.');
 return 'https://www.rfaf.es/pnfg/NPcd/NFG_VisCalendario_Vis?'+new URLSearchParams({cod_primaria:'1000120',codtemporada:fields.codtemporada,codcompeticion:fields.codcompeticion,codgrupo:fields.codgrupo,CodJornada:/^\d{1,3}$/.test(fields.codjornada||'')?fields.codjornada:'1'});
}
export function githubStore(env,fetcher=fetch){
 const headers={Authorization:'Bearer '+env.GITHUB_IMAGE_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'CDMenciana-equipos','Content-Type':'application/json'};
 if(!env.GITHUB_IMAGE_TOKEN)throw fail('La conexión del panel con GitHub no está configurada.',503);
 return {
 async read(path){const r=await fetcher(`https://api.github.com/repos/${REPO}/contents/${path}?ref=main`,{headers,signal:AbortSignal.timeout(15000)});if(r.status===404)return null;if(!r.ok)throw fail('No se pudo consultar la configuración de equipos.',502);const d=await r.json();return {sha:d.sha,value:JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(d.content.replace(/\s/g,'')),c=>c.charCodeAt(0))))};},
 async write(path,value,sha){const bytes=new TextEncoder().encode(JSON.stringify(value,null,2)+'\n');let binary='';for(const b of bytes)binary+=String.fromCharCode(b);const r=await fetcher(`https://api.github.com/repos/${REPO}/contents/${path}`,{method:'PUT',headers,body:JSON.stringify({message:'admin: update club teams',branch:'main',content:btoa(binary),...(sha?{sha}:{})}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw fail(r.status===409||r.status===422?'Los datos han cambiado. Actualiza antes de guardar.':'No se pudo guardar el equipo en GitHub.',r.status===409||r.status===422?409:502);return r.json();}
 };
}
export async function teamCatalog(env){const saved=await githubStore(env).read('data/club-teams.json');if(!saved)throw fail('El catálogo aún no está disponible.',503);return catalog.parseCatalog(saved.value);}
export async function manageTeams(path,input,store,now=Date.now()){
 const saved=await store.read('data/club-teams.json');if(!saved)throw fail('El catálogo aún no está disponible.',503);const teams=catalog.parseCatalog(saved.value);
 if(path==='/teams'){let job=null;if(input.id){if(!/^[a-f0-9]{32}$/.test(input.id))throw fail('Importación no válida.');job=(await store.read(`data/team-imports/${input.id}.json`))?.value||null;}return {teams,revision:saved.sha,job};}
 if(path==='/teams/update'||path==='/teams/delete'){
  if(input.revision!==saved.sha)throw fail('Los equipos han cambiado. Actualiza antes de guardar.',409);
  const team=teams.find(t=>t.key===input.key);if(!team)throw fail('Equipo no disponible.');
  if(path==='/teams/delete'){
   if(catalog.BASE[team.key])throw fail('Los tres equipos iniciales se mantienen. Puedes eliminar los equipos añadidos desde este panel.');
   const ordered=teams.filter(t=>t.key!==team.key);ordered.forEach((t,i)=>t.order=i+1);
   const retired=[...new Set([...(saved.value.retired||[]),team.key])];
   await store.write('data/club-teams.json',{...saved.value,teams:ordered,retired},saved.sha);
   return {saved:true,teams:ordered};
  }
  if(typeof input.label!=='string'||!input.label.trim()||input.label.trim().length>80||!Number.isSafeInteger(input.order)||input.order<1||input.order>teams.length)throw fail('Revisa el nombre y la posición del equipo.');
  const ordered=teams.filter(t=>t.key!==team.key);ordered.splice(input.order-1,0,{...team,label:input.label.trim()});ordered.forEach((t,i)=>t.order=i+1);await store.write('data/club-teams.json',{...saved.value,teams:ordered},saved.sha);return {saved:true,teams:ordered};
 }
 if(!/^[a-f0-9]{32}$/.test(input.id||''))throw fail('Importación no válida.');
 const jobPath=`data/team-imports/${input.id}.json`,previous=await store.read(jobPath);
 if(path==='/teams/preview'){
  const source=calendarSource(input.source);if(previous){if(previous.value.source!==source)throw fail('Esta importación corresponde a otro enlace.',409);if(previous.value.status!=='error')return {job:previous.value};}
  const job={id:input.id,source,status:'preview_pending',createdAt:new Date(now).toISOString()};await store.write(jobPath,job,previous?.sha);return {job};
 }
 if(path==='/teams/import'){
  if(typeof input.label!=='string')throw fail('Escribe el nombre del equipo.');
  const job=previous?.value;if(!job)throw fail('Consulta primero el enlace.');
  if(['import_pending','complete'].includes(job.status)){if(job.selectedTeam!==input.teamId||job.label!==input.label.trim()||job.order!==input.order)throw fail('La importación ya está guardada con otros datos.',409);return {job};}
  if(!['preview_ready','import_error'].includes(job.status))throw fail('Espera a que termine la consulta del enlace.');
  const candidate=job.preview?.candidates?.find(t=>t.team_id===input.teamId);if(!candidate)throw fail('Selecciona un equipo de nuestro club.');
  if(teams.some(t=>t.group_id===job.preview.group_id&&t.team_id===input.teamId&&t.season_id===job.preview.season_id))throw fail('Este equipo ya está añadido.');
  if(teams.length>=30||typeof input.label!=='string'||!input.label.trim()||input.label.length>80||!Number.isSafeInteger(input.order)||input.order<1||input.order>teams.length+1)throw fail('Revisa el nombre y el orden del equipo.');
  const next={...job,status:'import_pending',selectedTeam:input.teamId,label:input.label.trim(),order:input.order,attempts:0,restore:(saved.value.retired||[]).includes(`rfaf_${job.preview.group_id}_${input.teamId}`),updatedAt:new Date(now).toISOString()};delete next.error;await store.write(jobPath,next,previous.sha);return {job:next};
 }
 throw fail('Ruta de equipos no disponible.',404);
}

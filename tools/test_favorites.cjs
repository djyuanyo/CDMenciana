const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('<main id="main"></main>',{url:'https://appassets.androidplatform.net/',runScripts:'outside-only'}),W=dom.window;
 W.CDM={icon:()=>'',empty:()=>''};W.AbortController=AbortController;
 for(const name of ['auth','registration','club-access','favorites'])W.eval(fs.readFileSync('server/static/'+name+'.js','utf8'));
 const A=W.ClubAuth,C=W.ClubAccess,F=W.ClubFavorites;A.configured=true;A.firebase=()=>true;A.user={uid:'one',name:'First',email:'one@club.test'};C.profile={id:'one',role:'fan',...W.ClubRegistration.validate({name:'First',registrationType:'fan'})};
 W.Fixtures={teams:{first:{label:'Primer equipo',competition:'Liga'},filial:{label:'Filial',competition:'Otra liga'}},selectedTeam:'first',data:{round_matches:[{home:'C.D. APAGA Y VAMONOS',away:'Rival',home_team_url:'https://www.rfaf.es/NFG_VisEquipos?Codigo_Equipo=2137495',away_team_url:'https://www.rfaf.es/NFG_VisEquipos?Codigo_Equipo=456'}]},crest:()=>''};
 let docs=[],writes=[];C.request=async(path,options={})=>{writes.push({path,options});if(options.method==='PATCH'){const d={name:'clubUsers/one/favorites/first_2137495',fields:Object.fromEntries(Object.entries(options.fields).map(([k,v])=>[k,{stringValue:v}]))};docs.push(d);return d;}if(options.method==='DELETE'){docs=[];return {};}return {documents:docs};};
 assert(F.banner().includes('first_2137495'));assert(!F.button('Rival'));assert.equal(F.catalog.size,1);assert(!F.teamId('https://evil.test/?Codigo_Equipo=2137495'));
 await F.toggle('first_2137495');assert(F.selected('first_2137495'));assert(writes.at(-1).path.includes('/one/favorites/first_2137495'));await F.sync();assert.equal(F.rows.length,1);
 await F.toggle('first_2137495');assert(!F.selected('first_2137495'));assert.equal(writes.at(-1).options.method,'DELETE');
 F.rows=[{id:'old'}];A.update({user:{uid:'two',name:'Second',email:'two@club.test'}});assert.equal(F.rows.length,0,'Changing users must immediately clear favorites');
 C.profile={id:'two',role:'fan',...W.ClubRegistration.validate({name:'Second',registrationType:'fan'})};docs=[];await F.sync();assert(writes.at(-1).path.startsWith('/two/'));
 let release;C.request=()=>new Promise(r=>release=r);const sync=F.sync();A.update({user:null});release({documents:[{name:'clubUsers/two/favorites/old',fields:{}}]});await sync;assert.equal(F.rows.length,0,'Late previous account response must not leak');
 A.user={uid:'two',email:'two@club.test'};F.serviceActive=async()=>false;await assert.rejects(F.alerts(),/todavía/);assert.equal(F.notifications,false);
 W.ClubPushNative={request(id,action){queueMicrotask(()=>F.receive(id,{ok:true,enabled:action==='enable'}));}};F.serviceActive=async()=>true;await F.alerts();assert(F.notifications);await F.detach();assert(!F.notifications);
 dom.window.close();console.log('Favorites: identity isolation, persistence/removal, safe labels, stale session replies, unavailable service, opt-in and detach passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

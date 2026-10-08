const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
async function run(){
 const dom=new JSDOM('<main></main>',{url:'https://cdmenciana.web.app/',runScripts:'outside-only'}),W=dom.window;
 W.CDM={icon:()=>'',empty:(title,body)=>title+' '+body};W.AbortController=AbortController;
 W.eval(fs.readFileSync('server/static/auth.js','utf8'));W.eval(fs.readFileSync('server/static/club-access.js','utf8'));
 W.ClubAuth.firebase=()=>true;W.ClubAuth.user={uid:'ZJeZEjtDeMRCYL0UOuvhGt0gNCT2',email:'juanjocarrillo7@gmail.com',name:'Juanjo',emailVerified:false};
 W.ClubAuth.request=async()=>({token:'firebase-token',user:W.ClubAuth.user});const access=W.ClubAccess;
 assert.equal(access.administrator(),true,'The pinned administrator does not need an email verification');
 W.ClubAuth.user.emailVerified=true;assert(access.administrator());
 let requests=[],reply={documents:[{name:'projects/club/databases/(default)/documents/clubUsers/target',fields:{name:{stringValue:'Jugador <script>'},email:{stringValue:'player@club.test'},role:{stringValue:'fan'}}}]};
 W.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,status:200,json:async()=>reply};};
 await access.list();assert.equal(access.users.length,1);assert(access.rows().includes('&lt;script&gt;'));assert(!access.rows().includes('<script>'));assert(access.rows('PLAYER').includes('player@club.test'));
 reply=reply.documents[0];reply.fields.role.stringValue='player';await access.setRole('target','player');
 const request=requests.at(-1);assert.equal(request.options.headers.Authorization,'Bearer firebase-token');assert.deepEqual(JSON.parse(request.options.body),{fields:{role:{stringValue:'player'}}});assert(request.url.includes('updateMask.fieldPaths=role'));assert.equal(access.users[0].role,'player');
 await assert.rejects(access.setRole('ZJeZEjtDeMRCYL0UOuvhGt0gNCT2','member'),/válidos/);await assert.rejects(access.setRole('../owner','member'),/válidos/);await assert.rejects(access.setRole('target','admin'),/válidos/);
 W.ClubAuth.user={uid:'fan',email:'fan@club.test',emailVerified:true};await assert.rejects(access.list(),/administrador/);await assert.rejects(access.setRole('target','member'),/administrador/);
 W.fetch=async()=>({ok:false,status:404,json:async()=>({error:{status:'NOT_FOUND',message:'Document projects/club/databases/(default)/documents/clubUsers/fan not found.'}})});
 assert.equal(await access.request('/fan',{missing:true}),null);
 W.fetch=async()=>({ok:false,status:404,json:async()=>({error:{status:'NOT_FOUND',message:'The database (default) does not exist for project club'}})});
 await assert.rejects(access.request('/fan',{missing:true}),/base de datos/);
 access.profile={id:'fan',role:'member_player'};assert(access.user().member&&access.user().player);W.ClubAuth.user.emailVerified=false;assert(access.user().member&&access.user().player);
 W.ClubAuth.user=null;await access.sync();assert.equal(access.profile,null);assert.equal(access.users.length,0);assert.equal(W.localStorage.length,0);
 dom.window.close();console.log('Role transport, pinned owner, privileged fields, safe search, sign-out and unavailable database passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});

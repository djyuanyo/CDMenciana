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
assert(f.clubCrest().startsWith('crests/'));assert(f.card(f.data.matches[4]).includes('time-unconfirmed'));
for(const m of f.data.matches)for(const side of ['home','away']){const image=f.crest(m[side],m[side+'_crest']);assert(image.startsWith('crests/'));assert(fs.existsSync('android/app/src/main/assets/'+image));}
f.round=null;const selected=f.defaultRound();assert(f.calendar().includes(`value="${selected}" selected`));f.round='all';assert(f.calendar().includes('value="all" selected'));
console.log('Default round, exact team name, pending time and all official crest assets verified');

// The Service Binding target must exist before the first full deployment.
import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${config.name}`,{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}});
await r.body?.cancel();if(r.ok)process.exit(0);if(r.status!==404)throw Error('Could not verify Worker');
const filename='.wrangler-bootstrap.jsonc';delete config.services;config.triggers={crons:[]};fs.writeFileSync(filename,JSON.stringify(config));
const result=spawnSync('npx',['--no-install','wrangler','deploy','--config',filename,'--secrets-file',process.env.SECRET_FILE],{encoding:'utf8'});
if(result.status!==0)throw Error('Could not create initial Worker');console.log('Servicio creado; preparando la conexión interna.');

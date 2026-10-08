import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'dist');
const config = JSON.parse(await readFile(resolve(root, 'firebase-config.json'), 'utf8'));
if (config.projectId !== 'barpro-pos-menciana' || !config.apiKey || !config.appId || !config.authDomain) {
  throw Error('Falta la configuración de la app web registrada en Firebase.');
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, '../android/app/src/main/assets'), output, { recursive: true });
await cp(resolve(root, 'public-data.js'), resolve(output, 'public-data.js'));
await writeFile(resolve(output, 'firebase-config.js'), `window.CLUB_FIREBASE_CONFIG=${JSON.stringify(config)};\n`);
await build({ entryPoints: [resolve(root, 'firebase-web.js')], outfile: resolve(output, 'firebase-web.js'), bundle: true, minify: true, format: 'iife', target: ['es2020'], legalComments: 'eof' });
const indexPath = resolve(output, 'index.html');
const index = (await readFile(indexPath, 'utf8')).replace('<script src="auth.js" defer></script>', '<script src="auth.js" defer></script><script src="firebase-config.js" defer></script><script src="firebase-web.js" defer></script><script src="public-data.js" defer></script>');
await writeFile(indexPath, index);
console.log('Versión web de CD Menciana preparada en hosting/dist.');

// RNCWEB
import { copyFile, cp, rm, readFile, access } from 'node:fs/promises';
import { build } from 'vite';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
await copyFile('src/index.template.html', 'index.html');
await build();
const html = await readFile('dist/index.html', 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(?:\.\/|\/)?(assets\/[^"]+\.(?:js|css))"/g)].map(m => m[1]);
if (!refs.some(p => p.endsWith('.js')) || !refs.some(p => p.endsWith('.css'))) {
  throw new Error('Build sem JavaScript ou CSS compilado.');
}
for (const ref of refs) await access('dist/' + ref);
await rm('assets', { recursive: true, force: true });
await cp('dist/assets', 'assets', { recursive: true });
await copyFile('dist/index.html', 'index.html');
console.log('MegaTech: HTML, CSS e JS prontos em dist e na raiz.');

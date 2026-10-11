import {readFileSync,readdirSync,statSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {resolve} from 'node:path';import assert from 'node:assert/strict';
const walk=dir=>readdirSync(dir).flatMap(name=>statSync(dir+'/'+name).isDirectory()?walk(dir+'/'+name):[dir+'/'+name]);
for(const file of walk('dist').filter(x=>x.endsWith('.js')).concat(['worker/index.js','worker/security.js']))execFileSync(process.execPath,['--check',file]);
const manifest=JSON.parse(readFileSync('dist/theme-manifest.json'));let scenes=0;
for(const theme of manifest.themes)for(const scene of theme.scenes){for(const p of [scene.src,scene.smallSrc,scene.motifSrc].filter(Boolean))assert.ok(statSync(resolve('dist',p)).size);scenes++;}
assert.equal(scenes,84);const html=readFileSync('dist/index.html','utf8');for(const match of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))assert.ok(statSync('dist/'+match[1]).size);
for(const icon of JSON.parse(readFileSync('dist/manifest.webmanifest')).icons)assert.ok(statSync('dist/'+icon.src).size);
console.log('Checked JavaScript syntax, 84 artwork scenes, entrypoint links, and PWA icons.');

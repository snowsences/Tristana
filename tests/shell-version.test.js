import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {APP_VERSION} from '../dist/js/update-ui.js';
test('HTML and all local module imports use one release version cached for offline startup',()=>{
 const html=readFileSync('dist/index.html','utf8'),worker=readFileSync('dist/sw.js','utf8');
 const entry=html.match(/src="(\.\/js\/boot\.js\?v=\d+)"/)[1],version=entry.split('?')[1];assert.ok(worker.includes("'"+entry+"'"));
 assert.equal(version,'v='+APP_VERSION);assert.equal(JSON.parse(readFileSync('dist/version.json','utf8')).version,APP_VERSION);assert.ok(worker.includes("VERSION='tristana-v"+APP_VERSION+"'"));
 const stylesheet=html.match(/rel="stylesheet" href="([^"]+)"/)[1];assert.equal(stylesheet.split('?')[1],version,'Styles must use the same release as the app');assert.ok(worker.includes("'"+stylesheet+"'"),'Versioned styles must be available offline');
 const boot=readFileSync('dist/js/boot.js','utf8');assert.ok(boot.includes("import('./app.js?"+version+"')"));assert.ok(worker.includes("'./js/app.js?"+version+"'"));
 for(const file of readdirSync('dist/js').filter(name=>name.endsWith('.js'))){const source=readFileSync('dist/js/'+file,'utf8');for(const match of source.matchAll(/from ['"]\.\/([^'"]+)['"]/g)){assert.equal(match[1].split('?')[1],version,file+' must not reuse stale dependencies');assert.ok(worker.includes("'./js/"+match[1]+"'"),match[1]+' must be available offline');}}
});
test('both install entrypoints request an opaque iPhone status bar',()=>{
 for(const file of ['index.html','dist/index.html']){const html=readFileSync(file,'utf8');assert.match(html,/<meta name="apple-mobile-web-app-capable" content="yes">/);assert.match(html,/<meta name="apple-mobile-web-app-status-bar-style" content="black">/);assert.match(html,/rel="manifest"/);assert.match(html,/rel="apple-touch-icon"/);}
});

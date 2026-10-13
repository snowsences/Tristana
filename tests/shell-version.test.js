import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
test('HTML and all local module imports use one release version cached for offline startup',()=>{
 const html=readFileSync('dist/index.html','utf8'),worker=readFileSync('dist/sw.js','utf8');
 const entry=html.match(/src="(\.\/js\/boot\.js\?v=\d+)"/)[1],version=entry.split('?')[1];assert.ok(worker.includes("'"+entry+"'"));
 const boot=readFileSync('dist/js/boot.js','utf8');assert.ok(boot.includes("import('./app.js?"+version+"')"));assert.ok(worker.includes("'./js/app.js?"+version+"'"));
 for(const file of readdirSync('dist/js').filter(name=>name.endsWith('.js'))){const source=readFileSync('dist/js/'+file,'utf8');for(const match of source.matchAll(/from ['"]\.\/([^'"]+)['"]/g)){assert.equal(match[1].split('?')[1],version,file+' must not reuse stale dependencies');assert.ok(worker.includes("'./js/"+match[1]+"'"),match[1]+' must be available offline');}}
});

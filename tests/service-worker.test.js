import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8');
function fixture(){
 const listeners={},batches=[],requests=[];let cached;
 const cache={addAll:async values=>batches.push(values),match:async()=>cached,put:async()=>{}};
 const context={URL,Request,self:{location:new URL('https://example.com/Tristana/dist/sw.js'),addEventListener:(type,fn)=>{listeners[type]=fn;}},caches:{open:async()=>cache},fetch:async(request,options)=>{requests.push({request,options});return {ok:true,type:'basic',clone(){return this;}};}};
 vm.runInNewContext(source,context);
 return {listeners,batches,requests,setCached(value){cached=value;},async fetch(path){let response;listeners.fetch({request:new Request(new URL(path,context.self.location)),respondWith:value=>{response=value;}});return response;}};
}
test('install fetches a fresh shell even while the previous release is HTTP cached',async()=>{
 const f=fixture();let installed;f.listeners.install({waitUntil:value=>{installed=value;}});await installed;
 assert.ok(f.batches[0].length>20);for(const request of f.batches[0]){assert.ok(request instanceof Request);assert.equal(request.cache,'reload');}
 assert.ok(f.batches[0].some(request=>request.url.endsWith('/style.css?v=99')));
});
test('shell requests revalidate HTTP cache while cached paintings stay available',async()=>{
 const f=fixture();await f.fetch('./index.html');await f.fetch('./style.css?v=99');
 assert.equal(f.requests.length,2);for(const {options} of f.requests)assert.equal(options.cache,'no-cache');
 const painting={ok:true};f.setCached(painting);assert.equal(await f.fetch('./assets/painting.webp'),painting);assert.equal(f.requests.length,2);
});

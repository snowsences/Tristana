import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';import {APP_VERSION,createUpdatePrompt} from '../dist/js/update-ui.js';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');const tick=()=>new Promise(r=>setImmediate(r));
function fixture({controlled=true,waiting=true,saveDrafts=async()=>{},fetchVersion,watch=true}={}){
 const dom=new JSDOM(html),d=dom.window.document,serviceWorker=new dom.window.EventTarget(),registration=new dom.window.EventTarget(),worker=new dom.window.EventTarget(),messages=[],errors=[];let reloads=0;
 serviceWorker.controller=controlled?{}:null;registration.active=controlled?{}:null;worker.state='installed';worker.postMessage=value=>messages.push(value);registration.waiting=waiting?worker:null;registration.update=async()=>{};
 const prompt=createUpdatePrompt({document:d,serviceWorker,saveDrafts,fetchVersion,reload:()=>reloads++,onError:e=>errors.push(e)});if(watch)prompt.watch(registration);
 return {dom,d,serviceWorker,registration,worker,messages,errors,prompt,reloads:()=>reloads,close(){prompt.dispose();dom.window.close();}};
}
test('a waiting update displays one shared banner on every authenticated tab',()=>{
 const f=fixture();try{const banner=f.d.getElementById('update-banner');assert.equal(banner.hidden,false);assert.equal(banner.closest('#app-shell').id,'app-shell');assert.equal(banner.closest('#journal-view'),null);assert.equal(banner.closest('#settings-view'),null);assert.equal(f.d.body.dataset.updateReady,'true');assert.equal(f.reloads(),0);}finally{f.close();}
});
test('first installation never asks the user to update',()=>{
 const f=fixture({controlled:false,waiting:false});try{f.registration.installing=f.worker;f.registration.dispatchEvent(new f.dom.window.Event('updatefound'));f.worker.dispatchEvent(new f.dom.window.Event('statechange'));assert.equal(f.d.getElementById('update-banner').hidden,true);f.serviceWorker.dispatchEvent(new f.dom.window.Event('controllerchange'));assert.equal(f.reloads(),0);assert.equal(f.d.getElementById('update-banner').hidden,true);}finally{f.close();}
});
test('Update waits for draft persistence before activating and reloads only after takeover',async()=>{
 let save;const f=fixture({saveDrafts:()=>new Promise(resolve=>{save=resolve;})});try{f.d.getElementById('apply-update').click();assert.equal(f.d.getElementById('apply-update').disabled,true);assert.deepEqual(f.messages,[]);assert.equal(f.reloads(),0);save();await tick();assert.deepEqual(f.messages,[{type:'ACTIVATE_UPDATE'}]);assert.equal(f.reloads(),0);f.serviceWorker.dispatchEvent(new f.dom.window.Event('controllerchange'));assert.equal(f.reloads(),1);}finally{f.close();}
});
test('a failed local save prevents activation and reload and allows retry',async()=>{
 const f=fixture({saveDrafts:async()=>{throw new Error('Local save failed');}});try{f.d.getElementById('apply-update').click();await tick();assert.deepEqual(f.messages,[]);assert.equal(f.reloads(),0);assert.equal(f.errors.length,1);assert.equal(f.d.getElementById('apply-update').disabled,false);assert.equal(f.d.getElementById('apply-update').textContent,'Update');}finally{f.close();}
});
test('a newly installed worker announces readiness after its download finishes',()=>{
 const f=fixture({waiting:false});try{f.worker.state='installing';f.registration.installing=f.worker;f.registration.dispatchEvent(new f.dom.window.Event('updatefound'));assert.equal(f.d.getElementById('update-banner').hidden,true);f.worker.state='installed';f.registration.waiting=f.worker;f.worker.dispatchEvent(new f.dom.window.Event('statechange'));assert.equal(f.d.getElementById('update-banner').hidden,false);assert.equal(f.reloads(),0);}finally{f.close();}
});
test('another window activating an update prompts instead of reloading unsaved editing',async()=>{
 const f=fixture({waiting:false});try{f.serviceWorker.dispatchEvent(new f.dom.window.Event('controllerchange'));assert.equal(f.d.getElementById('update-banner').hidden,false);assert.equal(f.reloads(),0);f.d.getElementById('apply-update').click();await tick();assert.equal(f.reloads(),1);}finally{f.close();}
});
test('a newer release shows the banner even when iOS misses worker events',async()=>{
 const f=fixture({waiting:false,fetchVersion:async()=>String(Number(APP_VERSION)+1)});try{await f.prompt.check();assert.equal(f.d.getElementById('update-banner').hidden,false);assert.equal(f.reloads(),0);f.d.getElementById('apply-update').click();await tick();assert.equal(f.reloads(),1);assert.deepEqual(f.messages,[]);}finally{f.close();}
});
test('current, older, malformed and offline release responses do not prompt',async()=>{
 for(const version of [APP_VERSION,'1','not-a-version',undefined]){const f=fixture({waiting:false,fetchVersion:async()=>version});try{await f.prompt.check();assert.equal(f.d.getElementById('update-banner').hidden,true);}finally{f.close();}}
 const f=fixture({waiting:false,fetchVersion:async()=>{throw new Error('Offline');}});try{await f.prompt.check();assert.equal(f.d.getElementById('update-banner').hidden,true);assert.deepEqual(f.errors,[]);}finally{f.close();}
});
test('returning from iPhone suspension inspects an already waiting worker immediately',async()=>{
 const f=fixture({waiting:false});try{Object.defineProperty(f.d,'visibilityState',{value:'visible',configurable:true});f.registration.waiting=f.worker;f.dom.window.dispatchEvent(new f.dom.window.Event('pageshow'));assert.equal(f.d.getElementById('update-banner').hidden,false);await tick();}finally{f.close();}
});
test('focus, visibility and online returns each check the release, and dispose removes listeners',async()=>{
 let checks=0;const f=fixture({waiting:false,fetchVersion:async()=>{checks++;return APP_VERSION;}});try{Object.defineProperty(f.d,'visibilityState',{value:'visible',configurable:true});await tick();checks=0;
 for(const [target,event] of [[f.dom.window,'focus'],[f.d,'visibilitychange'],[f.dom.window,'online']]){target.dispatchEvent(new f.dom.window.Event(event));await tick();}assert.equal(checks,3);f.prompt.dispose();f.dom.window.dispatchEvent(new f.dom.window.Event('focus'));await tick();assert.equal(checks,3);
 }finally{f.close();}
});
test('release discovery continues while the iPhone worker update is stalled',async()=>{
 let finish;const f=fixture({waiting:false,fetchVersion:async()=>String(Number(APP_VERSION)+1)});try{f.registration.update=()=>new Promise(resolve=>{finish=resolve;});const checked=f.prompt.check();await tick();assert.equal(f.d.getElementById('update-banner').hidden,false);finish();await checked;}finally{f.close();}
});
test('a stalled check times out so a later return can retry',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let checks=0;const f=fixture({waiting:false,fetchVersion:async()=>{checks++;return APP_VERSION;}});try{f.registration.update=()=>new Promise(()=>{});const checked=f.prompt.check();await tick();t.mock.timers.tick(8000);await checked;f.registration.update=async()=>{};await f.prompt.check();assert.equal(checks,2);}finally{f.close();t.mock.timers.reset();}
});
test('release discovery bypasses HTTP caching and works before registration finishes',async()=>{
 const f=fixture({waiting:false,watch:false});try{const requests=[];f.dom.window.fetch=async(url,options)=>{requests.push({url:String(url),options});return {ok:true,json:async()=>({version:String(Number(APP_VERSION)+1)})};};f.dom.reconfigure({url:'https://example.com/Tristana/dist/'});await f.prompt.check();assert.equal(requests[0].url,'https://example.com/Tristana/dist/version.json');assert.equal(requests[0].options.cache,'no-store');assert.equal(f.d.getElementById('update-banner').hidden,false);}finally{f.close();}
});

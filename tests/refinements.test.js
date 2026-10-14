import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createDateNavigator} from '../dist/js/date-nav.js';
import {installKeyboardComfort} from '../dist/js/keyboard-ui.js';
import {pinchCropPose,createCropper} from '../dist/js/crop.js';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){const dom=new JSDOM(html,{url:'https://example.test/',pretendToBeVisual:true,runScripts:'outside-only'});return {dom,win:dom.window,d:dom.window.document};}
test('month mosaics and leap-year grid navigate saved and empty days, blocking future days',async()=>{
 const f=fixture(),entries=new Map([['2024-02-12',{date:'2024-02-12',good:'Hello',photo:{id:1}}]]),chosen=[];let owner='kevin';
 const dialog=f.d.getElementById('time-dialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new f.win.Event('close'));};
 const nav=createDateNavigator({document:f.d,getEntries:()=>entries,getToday:()=> '2026-10-13',getSelected:()=> '2024-02-12',getOwner:()=>owner,getPhotoURL:async()=> 'https://example.test/photo.jpg',displayDate:(date,options)=>new Intl.DateTimeFormat('en-US',{...options,timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')),onSelect:date=>chosen.push(date),onError:e=>{throw e;}});
 try{nav.open();await tick();assert.equal(f.d.querySelectorAll('.time-month-card').length,12);assert.equal(f.d.querySelector('.time-mosaic img').src,'https://example.test/photo.jpg');f.d.querySelector('[data-time-view=year]').click();assert.equal(f.d.querySelectorAll('.time-day').length,366);assert.match(f.d.querySelector('[data-date="2024-02-12"]').className,/partial/);f.d.querySelector('[data-date="2024-02-29"]').click();await tick();assert.deepEqual(chosen,['2024-02-29']);
 nav.open();const select=f.d.getElementById('time-year');select.value='2026';select.dispatchEvent(new f.win.Event('change'));assert.equal(f.d.querySelectorAll('.time-month-card')[10].disabled,true);f.d.querySelector('[data-time-view=year]').click();assert.equal(f.d.querySelector('[data-date="2026-10-14"]').disabled,true);assert.equal(f.d.querySelectorAll('.time-day').length,365);nav.reset();owner=null;nav.open();assert.equal(dialog.open,false);assert.equal(f.d.getElementById('time-content').children.length,0);
 }finally{f.win.close();}
});
test('keyboard keeps composing text intact and restores position unless the user scrolls',async()=>{
 const f=fixture(),viewport=new f.win.EventTarget();viewport.height=800;viewport.offsetTop=0;Object.defineProperty(f.win,'visualViewport',{value:viewport});Object.defineProperty(f.win,'innerHeight',{value:800});let y=100;Object.defineProperty(f.win,'scrollY',{get:()=>y});f.win.scrollTo=options=>y=options.top;f.win.requestAnimationFrame=fn=>{fn();return 1;};
 const input=f.d.getElementById('learned');f.d.getElementById('app-shell').hidden=false;f.d.getElementById('app-shell').removeAttribute('inert');input.disabled=false;input.getBoundingClientRect=()=>({top:450,bottom:550});
 const keyboard=installKeyboardComfort(f.d);
 try{input.focus();viewport.height=400;viewport.dispatchEvent(new f.win.Event('resize'));assert.equal(f.d.documentElement.dataset.keyboardOpen,'true');assert.equal(y,274);input.value='How to tell';input.dispatchEvent(new f.win.InputEvent('input',{isComposing:true}));assert.equal(input.value,'How to tell');viewport.height=800;viewport.dispatchEvent(new f.win.Event('resize'));await new Promise(r=>f.win.setTimeout(r,140));assert.equal(y,100);assert.equal(f.d.documentElement.dataset.keyboardOpen,undefined);
 viewport.height=400;viewport.dispatchEvent(new f.win.Event('resize'));assert.equal(y,274);f.d.dispatchEvent(new f.win.Event('touchmove'));y=320;viewport.height=800;viewport.dispatchEvent(new f.win.Event('resize'));await new Promise(r=>f.win.setTimeout(r,140));assert.equal(y,320);
 }finally{keyboard.dispose();f.win.close();}
});
test('pinch preserves the photo point under moving fingers, including zoom limits',()=>{
 const pose={zoom:1,x:10,y:20},old={x:50,y:40},next={x:60,y:45};const result=pinchCropPose(pose,old,next,2);assert.deepEqual(result,{zoom:2,x:-20,y:5});assert.equal((next.x-result.x)/result.zoom,(old.x-pose.x)/pose.zoom);const capped=pinchCropPose({zoom:3,x:10,y:20},old,next,2);assert.equal(capped.zoom,4);assert.ok(Math.abs((next.x-capped.x)/4-(old.x-10)/3)<1e-10);
});
test('startup exposes loading and a working retry, retaining direct sign-in activation',async()=>{
 const f=fixture();let calls=0,signins=0;f.win.console.error=()=>{};
 f.win.mockImport=async()=>({start:async()=>{calls++;if(calls===1)throw new Error('Offline');f.win.tristanaStartup.setSignIn(()=>{signins++;return Promise.resolve();});}});
 const source=readFileSync(new URL('../dist/js/boot.js',import.meta.url),'utf8').replace(/import\('\.\/app\.js\?v=\d+'\)/,'window.mockImport()');
 try{f.win.eval(source);assert.equal(f.d.getElementById('signin').disabled,true);assert.match(f.d.getElementById('startup-status').textContent,/Restoring/);await tick();assert.equal(f.d.getElementById('signin-label').textContent,'Try again');f.d.getElementById('signin').click();await tick();assert.equal(calls,2);assert.equal(f.d.getElementById('signin-label').textContent,'Log in with Google');f.d.getElementById('signin').click();assert.equal(signins,1);assert.equal(f.d.getElementById('signin-label').textContent,'Signing in…');await tick();assert.equal(f.d.getElementById('signin').disabled,false);f.win.tristanaStartup.initializationFailed(new Error('Local recovery failed'));assert.equal(f.d.getElementById('signin-label').textContent,'Try again');f.d.getElementById('signin').click();await tick();assert.equal(calls,3);assert.equal(f.d.getElementById('signin-label').textContent,'Log in with Google');
 }finally{f.win.close();}
});
test('cached authentication waits for local recovery and retries without duplicating auth',async()=>{
 const source=readFileSync(new URL('../dist/js/cloud.js',import.meta.url),'utf8').replace(/from '\.\/([^']+)';/g,(_,name)=>"from '"+new URL('../dist/js/'+name,import.meta.url).href+"';").replace(/import\('https:\/\/www\.gstatic\.com\/firebasejs\/13\.0\.0\/firebase-[^']+'\)/g,'Promise.resolve(globalThis.__refinementSDK)');
 let initializeCount=0,subscribeCount=0,stops=0,observer,authOptions;
 globalThis.__refinementSDK={getApps:()=>[{}],getApp:()=>({}),initializeAuth:(app,options)=>{initializeCount++;authOptions=options;return {};},getFirestore:()=>({}),indexedDBLocalPersistence:'idb',browserLocalPersistence:'local',browserSessionPersistence:'session',browserPopupRedirectResolver:'popup',onAuthStateChanged:(auth,callback)=>{subscribeCount++;observer=callback;return ()=>stops++;},signOut:async()=>{}};
 try{const cloud=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));let release;const recovery=new Promise(r=>release=r);const pending=cloud.initialize(async()=>recovery);assert.equal(cloud.initialize(()=>{}),pending);await tick();let settled=false;pending.then(()=>settled=true);observer({uid:'owner',email:'allenkevinc@gmail.com',emailVerified:true});await tick();assert.equal(settled,false);release();await pending;assert.deepEqual(authOptions.persistence,['idb','local','session']);assert.equal(authOptions.popupRedirectResolver,'popup');
 const failed=cloud.initialize(async()=>{throw new Error('Storage unavailable');});await tick();observer(null);await assert.rejects(failed,/Storage unavailable/);assert.equal(stops,2);const retry=cloud.initialize(async()=>{});await tick();observer(null);await retry;assert.equal(initializeCount,1);assert.equal(subscribeCount,3);
 }finally{delete globalThis.__refinementSDK;}
});
test('crop gestures pan smoothly after pinch, reset on double tap, and show the grid only while adjusting',async()=>{
 const f=fixture(),descriptors=new Map();for(const [key,value] of Object.entries({document:f.d,ResizeObserver:class{observe(){}}})){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true});}
 const dialog=f.d.getElementById('crop-dialog'),frame=f.d.getElementById('crop-frame'),image=f.d.getElementById('crop-image'),slider=f.d.getElementById('crop-zoom');dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new f.win.Event('close'));};image.decode=async()=>{};Object.defineProperties(image,{naturalWidth:{value:800},naturalHeight:{value:400}});Object.defineProperty(frame,'clientWidth',{value:200});frame.getBoundingClientRect=()=>({left:0,top:0,width:200,height:200});f.win.requestAnimationFrame=fn=>{fn();return 1;};
 const pointer=(type,id,x,y=100)=>{const event=new f.win.Event(type);Object.assign(event,{pointerId:id,clientX:x,clientY:y});frame.dispatchEvent(event);};
 try{const cropper=createCropper(async()=>{},e=>{throw e;});await cropper.open(new Blob(['photo']),'2026-10-13');assert.equal(frame.dataset.adjusting,undefined);pointer('pointerdown',1,80);pointer('pointerdown',2,120);pointer('pointermove',2,160);assert.equal(slider.value,'2');assert.match(image.style.transform,/20px/);pointer('pointerup',2,160);pointer('pointermove',1,90);assert.match(image.style.transform,/30px/);pointer('pointerup',1,90);await new Promise(r=>setTimeout(r,370));assert.equal(frame.dataset.adjusting,undefined);
 pointer('pointerdown',3,100);pointer('pointerup',3,100);pointer('pointerdown',4,100);pointer('pointerup',4,100);assert.equal(slider.value,'1');assert.match(image.style.transform,/scale\(1\)/);assert.equal(frame.dataset.adjusting,'true');dialog.close();assert.equal(frame.dataset.adjusting,undefined);
 }finally{for(const [key,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}f.win.close();}
});

import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';
import {limitedEdit,createPromptEditor} from '../dist/js/prompt-ui.js';
import {createDayStrip} from '../dist/js/strip-ui.js';import {createPhotoRenderer} from '../dist/js/entry-ui.js';
import {restoredCrop} from '../dist/js/image-utils.js';import {cropSource} from '../dist/js/core.js';
import {installDialogs,confirmAction} from '../dist/js/motion-ui.js';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
function fixture(){const dom=new JSDOM(html,{url:'https://example.test/Tristana/dist/',pretendToBeVisual:true}),win=dom.window,d=win.document;d.getElementById('app-shell').hidden=false;d.getElementById('app-shell').removeAttribute('inert');win.matchMedia=()=>({matches:false});win.requestAnimationFrame=fn=>{fn();return 1;};return {dom,win,d};}
const tick=()=>new Promise(r=>setImmediate(r));
test('limit insertion preserves existing suffix, selections and Unicode code points',()=>{
 const edit=limitedEdit('a'.repeat(139)+'Z',4,4,'🌷');assert.equal(edit.value,'a'.repeat(139)+'Z');assert.equal(edit.rejected,'🌷');
 const replace=limitedEdit('a'.repeat(139)+'Z',139,140,'🌷🌿');assert.equal(Array.from(replace.value).length,140);assert.ok(replace.value.endsWith('🌷'));assert.equal(replace.rejected,'🌿');assert.equal(replace.caret,141);
});
test('focused day changes replace the editor and subsequent typing saves to that day',()=>{
 const f=fixture(),saved=[];try{const editor=createPromptEditor(f.d,{onChange:(...args)=>saved.push(args),onError:e=>{throw e;}});editor.setEntry({date:'2026-10-10',good:'Old day',learned:''});const input=f.d.getElementById('good');input.disabled=false;input.focus();editor.setEntry({date:'2026-10-11',good:'New day',learned:''});assert.equal(input.value,'New day');input.value+='!';input.dispatchEvent(new f.win.InputEvent('input'));assert.deepEqual(saved.at(-1),['good','New day!','2026-10-11']);}finally{f.win.close();}
});
test('same-day cloud rendering preserves the active local draft',()=>{
 const f=fixture();try{const editor=createPromptEditor(f.d,{onChange:()=>{},onError:()=>{}});editor.setEntry({date:'2026-10-11',good:'Saved',learned:''});const input=f.d.getElementById('good');input.disabled=false;input.focus();input.value='Typing';editor.setEntry({date:'2026-10-11',good:'Cloud text',learned:'Remote learning'});assert.equal(input.value,'Typing');assert.equal(f.d.getElementById('learned').value,'Remote learning');}finally{f.win.close();}
});
test('overflow characters fall and rotate but never enter the persisted value',()=>{
 const f=fixture(),saved=[],animations=[];try{
 f.win.HTMLElement.prototype.animate=function(frames,options){animations.push({frames,options});return {finished:Promise.resolve()};};
 const editor=createPromptEditor(f.d,{onChange:(...args)=>saved.push(args),onError:()=>{}});editor.setEntry({date:'2026-10-11',good:'a'.repeat(140),learned:''});const input=f.d.getElementById('good');input.setSelectionRange(140,140);
 const event=new f.win.InputEvent('beforeinput',{inputType:'insertText',data:'🌷',cancelable:true});input.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(input.value.length,140);assert.equal(saved.length,0);assert.equal(f.d.querySelector('.falling-character').textContent,'🌷');assert.match(animations[0].frames.at(-1).transform,/72px.*22deg/);
 }finally{f.win.close();}
});
test('pasting accepts remaining capacity and rejects excess without losing the suffix',()=>{
 const f=fixture(),saved=[];try{const editor=createPromptEditor(f.d,{onChange:(...args)=>saved.push(args),onError:()=>{}});editor.setEntry({date:'2026-10-11',good:'a'.repeat(138)+'Z',learned:''});const input=f.d.getElementById('good');input.setSelectionRange(138,138);const event=new f.win.Event('paste',{cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=> '🌷🌿'}});input.dispatchEvent(event);assert.equal(Array.from(input.value).length,140);assert.ok(input.value.endsWith('🌷Z'));assert.equal(saved.at(-1)[1],input.value);}finally{f.win.close();}
});
test('reduced motion avoids falling particles',()=>{
 const f=fixture();try{f.win.matchMedia=()=>({matches:true});const editor=createPromptEditor(f.d,{onChange:()=>{},onError:()=>{}});editor.setEntry({date:'2026-10-11',good:'x'.repeat(140),learned:''});const input=f.d.getElementById('good');input.setSelectionRange(140,140);input.dispatchEvent(new f.win.InputEvent('beforeinput',{inputType:'insertText',data:'y',cancelable:true}));assert.equal(f.d.querySelector('.falling-character'),null);assert.ok(input.classList.contains('limit-reached'));}finally{f.win.close();}
});
test('background renders retain day tiles and horizontal scroll position',()=>{
 const f=fixture(),entries=new Map();try{const element=f.d.getElementById('day-strip');const strip=createDayStrip({element,getEntry:date=>entries.get(date)||{},getToday:()=> '2026-10-11',displayDate:date=>date,getPhotoURL:async()=>null,onSelect:()=>{}});strip.render('2026-10-10');const tile=element.children[10];element.scrollLeft=240;entries.set(tile.dataset.date,{good:'Saved'});strip.render('2026-10-10');assert.equal(element.children[10],tile);assert.equal(element.scrollLeft,240);assert.ok(tile.querySelector('.day-state'));assert.equal(tile.querySelector('.tile-image').className,'tile-image partial');}finally{f.win.close();}
});
test('scrolling to the left extends earlier days and preserves the visible anchor',()=>{
 const f=fixture();try{const element=f.d.getElementById('day-strip');Object.defineProperties(element,{clientWidth:{value:360},scrollWidth:{get:()=>element.children.length*86}});
 Object.defineProperty(f.win.HTMLElement.prototype,'offsetLeft',{get(){return this.classList.contains('day-tile')?[...element.children].indexOf(this)*86:0;}});
 f.win.HTMLElement.prototype.getBoundingClientRect=function(){if(this.classList.contains('day-tile')){const left=this.offsetLeft-element.scrollLeft;return {left,right:left+72,width:72,top:0,bottom:86,height:86};}return {left:0,right:360,width:360,top:0,bottom:120,height:120};};
 const strip=createDayStrip({element,getEntry:()=>({}),getToday:()=> '2026-10-11',displayDate:date=>date,getPhotoURL:async()=>null,onSelect:()=>{}});strip.render('2026-09-20');const anchor=element.firstElementChild;const oldDate=anchor.dataset.date;element.scrollLeft=0;element.dispatchEvent(new f.win.Event('scroll'));assert.equal(element.children.length,36);assert.ok(element.firstElementChild.dataset.date<oldDate);assert.equal(anchor.getBoundingClientRect().left,0);
 }finally{f.win.close();}
});
test('unchanged photographs do not reload and stale requests cannot replace another day',async()=>{
 const f=fixture(),loads=[];try{const image=f.d.getElementById('entry-photo');const renderer=createPhotoRenderer(image,photo=>new Promise(r=>loads.push({id:photo.localId,resolve:r})),()=>{});
 renderer.render({localId:'one'},'2026-10-10');loads[0].resolve('https://example.test/one.jpg');await tick();renderer.render({localId:'one'},'2026-10-10');assert.equal(loads.length,1);assert.ok(image.src.endsWith('one.jpg'));
 renderer.render({localId:'two'},'2026-10-11');renderer.render({localId:'three'},'2026-10-12');loads[1].resolve('https://example.test/two.jpg');await tick();assert.equal(image.hasAttribute('src'),false);loads[2].resolve('https://example.test/three.jpg');await tick();assert.ok(image.src.endsWith('three.jpg'));
 }finally{f.win.close();}
});
test('reframe restores the saved crop after original compression and a different frame size',()=>{
 const original={sx:400,sy:220,size:1500,width:6000,height:4000};const pose=restoredCrop(original,2560,1707,312);const result=cropSource(2560,1707,312,pose.zoom,pose.x,pose.y);assert.ok(Math.abs(result.sx-original.sx*2560/6000)<1);assert.ok(Math.abs(result.sy-original.sy*1707/4000)<1);assert.ok(Math.abs(result.size-original.size*2560/6000)<1);
});
test('Back dismisses only the top modal, and programmatic close cleans up its history entry',async()=>{
 const f=fixture();try{for(const dialog of f.d.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=value=>{dialog.returnValue=value||'';dialog.removeAttribute('open');dialog.dispatchEvent(new f.win.Event('close'));};}installDialogs(f.d);const dialog=f.d.getElementById('date-dialog');dialog.showModal();assert.equal(f.win.history.state.tristanaDialog,'date-dialog');f.win.history.back();await new Promise(r=>setTimeout(r,40));assert.equal(dialog.open,false);dialog.showModal();await dialog.close('cancel');assert.equal(dialog.open,false);assert.equal(f.win.history.state?.tristanaDialog,undefined);}finally{f.win.close();}
});
test('matching confirmation waits for dismissal and leaves the underlying viewer open',async()=>{
 const f=fixture();try{for(const dialog of f.d.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=value=>{dialog.returnValue=value||'';dialog.removeAttribute('open');dialog.dispatchEvent(new f.win.Event('close'));};}installDialogs(f.d);const viewer=f.d.getElementById('photo-lightbox');viewer.showModal();const confirmation=confirmAction(f.d,{title:'Remove photograph?',message:'Keep text',action:'Remove'});await f.d.getElementById('confirm-dialog').close('confirm');assert.equal(await confirmation,true);assert.equal(viewer.open,true);assert.equal(f.win.history.state.tristanaDialog,'photo-lightbox');await viewer.close();assert.equal(f.win.history.state?.tristanaDialog,undefined);}finally{f.win.close();}
});

test('IME composition respects the limit while preserving text after the caret',()=>{
 const f=fixture(),saved=[];try{const editor=createPromptEditor(f.d,{onChange:(...args)=>saved.push(args),onError:()=>{}});editor.setEntry({date:'2026-10-11',good:'a'.repeat(138)+'Z',learned:''});const input=f.d.getElementById('good');input.setSelectionRange(138,138);input.dispatchEvent(new f.win.CompositionEvent('compositionstart'));input.value='a'.repeat(138)+'森山Z';input.dispatchEvent(new f.win.InputEvent('input',{isComposing:true}));assert.equal(saved.length,0);input.dispatchEvent(new f.win.CompositionEvent('compositionend',{data:'森山'}));assert.equal(input.value,'a'.repeat(138)+'森Z');assert.equal(saved.at(-1)[1],input.value);}finally{f.win.close();}
});

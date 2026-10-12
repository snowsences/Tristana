import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {createPhotoZoom} from '../dist/js/photo-zoom.js';
function fixture(){const dom=new JSDOM('<div id="app"></div><img src="https://example.test/original.jpg">'),win=dom.window,image=win.document.querySelector('img');let active=true;
 Object.defineProperties(image,{naturalWidth:{value:600},naturalHeight:{value:600}});image.getBoundingClientRect=()=>({left:0,top:0,width:300,height:500});image.setPointerCapture=()=>{};
 const zoom=createPhotoZoom(image,{isActive:()=>active});zoom.reset();
 function pointer(type,id,x,y,pointerType='touch'){const event=new win.Event(type,{bubbles:true});for(const [key,value] of Object.entries({pointerId:id,clientX:x,clientY:y,pointerType,button:0}))Object.defineProperty(event,key,{value});image.dispatchEvent(event);}
 const double=()=>image.dispatchEvent(new win.MouseEvent('dblclick',{clientX:150,clientY:250,cancelable:true}));
 return {win,image,zoom,pointer,double,disable(){active=false;},close(){win.close();}};
}
test('pinching scales only the photograph around the moving midpoint',()=>{const f=fixture();try{
 f.pointer('pointerdown',1,100,250);f.pointer('pointerdown',2,200,250);f.pointer('pointermove',2,300,250);assert.equal(f.image.style.transform,'translate(50px,0px) scale(2)');assert.equal(f.zoom.isZoomed,true);assert.equal(f.win.document.getElementById('app').style.transform,'');assert.equal(f.win.scrollY,0);assert.equal(f.image.src,'https://example.test/original.jpg');
 }finally{f.close();}});
test('panning a zoomed image stops at its actual photo edges, including letterboxing',()=>{const f=fixture();try{
 f.double();f.pointer('pointerdown',1,150,250);f.pointer('pointermove',1,10000,10000);assert.equal(f.image.style.transform,'translate(225px,125px) scale(2.5)');f.pointer('pointermove',1,-10000,-10000);assert.equal(f.image.style.transform,'translate(-225px,-125px) scale(2.5)');
 }finally{f.close();}});
test('pinch scale remains between one and four and returns to the fitted photo',()=>{const f=fixture();try{
 f.pointer('pointerdown',1,100,250);f.pointer('pointerdown',2,200,250);f.pointer('pointermove',2,2000,250);assert.match(f.image.style.transform,/scale\(4\)$/);f.pointer('pointermove',2,101,250);assert.equal(f.zoom.isZoomed,false);assert.equal(f.image.style.transform,'');assert.equal(f.image.dataset.zoomed,undefined);
 }finally{f.close();}});
test('double-tap and desktop double-click toggle zoom and reset',()=>{const f=fixture();try{
 for(const id of [1,2]){f.pointer('pointerdown',id,150,250);f.pointer('pointerup',id,150,250);}assert.match(f.image.style.transform,/scale\(2.5\)$/);f.double();assert.equal(f.image.style.transform,'');f.double();assert.equal(f.zoom.isZoomed,true);f.zoom.reset();assert.equal(f.zoom.isZoomed,false);assert.equal(f.image.style.transform,'');
 }finally{f.close();}});
test('canceled or closed viewer gestures cannot keep moving the image',()=>{const f=fixture();try{
 f.double();f.pointer('pointerdown',1,150,250);f.pointer('pointercancel',1,150,250);const previous=f.image.style.transform;f.pointer('pointermove',1,10000,10000);assert.equal(f.image.style.transform,previous);f.zoom.reset();f.disable();f.pointer('pointerdown',2,100,250);f.pointer('pointerdown',3,200,250);f.pointer('pointermove',3,400,250);f.double();assert.equal(f.image.style.transform,'');
 }finally{f.close();}});

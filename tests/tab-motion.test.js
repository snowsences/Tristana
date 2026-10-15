import test from 'node:test';
import assert from 'node:assert/strict';
import {conceal,cancelConceal} from '../dist/js/motion-ui.js';

function panel(){
 const effects=[];
 return {hidden:false,inert:false,effects,getAnimations(){return effects.filter(a=>a.active);},animate(frames,options){
   let resolve,reject;const finished=new Promise((yes,no)=>{resolve=yes;reject=no;});
   const effect={frames,options,finished,active:true,finish(){this.active=false;resolve();},cancel(){this.active=false;reject(new Error('cancelled'));}};
   effects.push(effect);return effect;
 }};
}
test('outgoing content stays present until its fade completes and becomes interactive again afterwards',async()=>{
 const element=panel();let complete=false;const pending=conceal(element).then(restore=>{complete=true;return restore;});
 assert.equal(complete,false);assert.equal(element.hidden,false);assert.equal(element.inert,true);
 assert.equal(element.effects[0].frames.at(-1).opacity,0);
 assert.equal(element.effects[0].frames.at(-1).transform,'translateY(6px)');
 element.effects[0].finish();const restore=await pending;assert.equal(complete,true);assert.equal(element.inert,true);
 // Keep the completed fade in place until the caller has swapped the views.
 restore();assert.equal(element.inert,false);
});
test('rapid tab changes cannot leave the outgoing panel inert or retain an old animation',async()=>{
 const element=panel();const first=conceal(element),second=conceal(element);
 await first;assert.equal(element.inert,true);assert.equal(element.effects[0].active,false);
 element.effects[1].finish();const restore=await second;restore();assert.equal(element.inert,false);
 const third=conceal(element);cancelConceal(element);await third;
 assert.equal(element.inert,false);assert.equal(element.getAnimations().length,0);
});
test('reduced motion switches tabs without waiting for an exit animation',async()=>{
 const previous=globalThis.window;
 try{globalThis.window={matchMedia:()=>({matches:true})};const element=panel();await conceal(element);assert.equal(element.effects.length,0);assert.equal(element.inert,false);}
 finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

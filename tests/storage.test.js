import 'fake-indexeddb/auto';
import test from 'node:test';import assert from 'node:assert/strict';
import {put,get,entriesFor,remove} from '../dist/js/storage.js';
test('rapid autosaves leave the last full draft durably stored and separate account records',async()=>{
 const saves=[];for(let i=0;i<100;i++)saves.push(put('entries',{key:'owner:2026-10-11',date:'2026-10-11',good:'draft '+i,learned:'discovery'}));await Promise.all(saves);
 const recovered=await get('entries','owner:2026-10-11');assert.equal(recovered.good,'draft 99');assert.equal(recovered.learned,'discovery');
 await put('entries',{key:'other:2026-10-11',date:'2026-10-11',good:'other account'});assert.equal((await entriesFor('owner')).length,1);
});
test('photo original and crop survive a round trip without string conversion',async()=>{
 const source=new Blob(['original bytes'],{type:'image/jpeg'}),square=new Blob(['cropped bytes'],{type:'image/jpeg'});await put('photos',{key:'owner:photo',source,square});const result=await get('photos','owner:photo');assert.equal(await result.source.text(),'original bytes');assert.equal(await result.square.text(),'cropped bytes');await remove('photos','owner:photo');assert.equal(await get('photos','owner:photo'),undefined);
});

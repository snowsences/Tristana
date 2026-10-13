import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {resolveHeader,monthlySceneOrder} from '../dist/js/themes.js';
const manifest=JSON.parse(readFileSync(new URL('../dist/theme-manifest.json',import.meta.url)));
const ids=order=>order.map(scene=>scene.id);
test('October loops one shuffled permutation of all 13 scenes, without early repeats',()=>{
 const october=manifest.themes.find(t=>t.month===10);assert.equal(october.scenes.length,13);const order=monthlySceneOrder(october,'2026-10-01');assert.equal(new Set(ids(order)).size,13);assert.deepEqual(new Set(ids(order)),new Set(ids(october.scenes)));
 for(let day=1;day<=31;day++){const date=`2026-10-${String(day).padStart(2,'0')}`;assert.equal(resolveHeader(manifest,{date}).scene.id,order[(day-1)%13].id);}
});
test('monthly order survives reloads, scene-array reorder and the selected theme override',()=>{
 const theme=manifest.themes.find(t=>t.month===10),first=ids(monthlySceneOrder(theme,'2026-10-01'));
 assert.deepEqual(ids(monthlySceneOrder(theme,'2026-10-31')),first);assert.deepEqual(ids(monthlySceneOrder(JSON.parse(JSON.stringify(theme)),'2026-10-13')),first);
 assert.deepEqual(ids(monthlySceneOrder({...theme,scenes:[...theme.scenes].reverse()},'2026-10-01')),first);
 assert.notDeepEqual(ids(monthlySceneOrder(theme,'2027-10-01')),first);assert.notDeepEqual(ids(monthlySceneOrder(theme,'2026-11-01')),first);
 for(let day=1;day<=30;day++){const date=`2026-11-${String(day).padStart(2,'0')}`,selection=resolveHeader(manifest,{date,themeMonth:10});assert.equal(selection.theme.month,10);assert.equal(selection.scene.id,monthlySceneOrder(theme,date)[(day-1)%13].id);}
});
test('any number of scenes works, including one and more drawings than days',()=>{
 for(const count of [1,2,10,40]){const theme={month:10,id:'test',scenes:Array.from({length:count},(_,i)=>({id:String(i)}))},m={themes:[theme]},order=monthlySceneOrder(theme,'2026-10-01');assert.equal(new Set(ids(order)).size,count);for(let day=1;day<=31;day++)assert.equal(resolveHeader(m,{date:`2026-10-${String(day).padStart(2,'0')}`}).scene.id,order[(day-1)%count].id);}
 assert.throws(()=>monthlySceneOrder({id:'empty',scenes:[]},'2026-10-01'),/no scenes/);assert.throws(()=>resolveHeader(manifest,{date:'2026-02-29'}),/Invalid/);
});

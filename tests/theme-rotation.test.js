import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {resolveHeader,monthlySceneOrder} from '../dist/js/themes.js';
const manifest=JSON.parse(readFileSync(new URL('../dist/theme-manifest.json',import.meta.url)));
const ids=order=>order.map(scene=>scene.id);
test('February has 28 unique regular images; leap-day artwork appears only on February 29',()=>{
 const theme=manifest.themes.find(t=>t.month===2),reserved=theme.scenes.filter(scene=>scene.reservedForDate);
 assert.equal(theme.scenes.length,29);assert.equal(reserved.length,1);assert.equal(reserved[0].reservedForDate,'02-29');
 for(const year of [2026,2028,2000]){
  const month=`${year}-02`,order=monthlySceneOrder(theme,`${month}-01`);
  assert.equal(order.length,28);assert.equal(new Set(ids(order)).size,28);assert.ok(!ids(order).includes(reserved[0].id));
  const regular=Array.from({length:28},(_,i)=>resolveHeader(manifest,{date:`${month}-${String(i+1).padStart(2,'0')}`}).scene.id);
  assert.deepEqual(regular,ids(order));
  for(const otherMonth of ['01','03','12'])for(let day=1;day<=31;day++)assert.notEqual(resolveHeader(manifest,{date:`${year}-${otherMonth}-${String(day).padStart(2,'0')}`,themeMonth:2}).scene.id,reserved[0].id);
 }
 for(const year of [2000,2028,2032])assert.equal(resolveHeader(manifest,{date:`${year}-02-29`}).scene.id,reserved[0].id);
 for(const year of [2026,2100])assert.throws(()=>resolveHeader(manifest,{date:`${year}-02-29`}),/Invalid/);
 assert.notEqual(resolveHeader(manifest,{date:'2028-02-29',themeMonth:3}).scene.id,reserved[0].id);
});
test('October loops one shuffled permutation of all 31 scenes, without early repeats',()=>{
 const october=manifest.themes.find(t=>t.month===10);assert.equal(october.scenes.length,31);const order=monthlySceneOrder(october,'2026-10-01');assert.equal(new Set(ids(order)).size,31);assert.deepEqual(new Set(ids(order)),new Set(ids(october.scenes)));
 for(let day=1;day<=31;day++){const date=`2026-10-${String(day).padStart(2,'0')}`;assert.equal(resolveHeader(manifest,{date}).scene.id,order[(day-1)%31].id);}
});
test('monthly order survives reloads, scene-array reorder and the selected theme override',()=>{
 const theme=manifest.themes.find(t=>t.month===10),first=ids(monthlySceneOrder(theme,'2026-10-01'));
 assert.deepEqual(ids(monthlySceneOrder(theme,'2026-10-31')),first);assert.deepEqual(ids(monthlySceneOrder(JSON.parse(JSON.stringify(theme)),'2026-10-13')),first);
 assert.deepEqual(ids(monthlySceneOrder({...theme,scenes:[...theme.scenes].reverse()},'2026-10-01')),first);
 assert.notDeepEqual(ids(monthlySceneOrder(theme,'2027-10-01')),first);assert.notDeepEqual(ids(monthlySceneOrder(theme,'2026-11-01')),first);
 for(let day=1;day<=30;day++){const date=`2026-11-${String(day).padStart(2,'0')}`,selection=resolveHeader(manifest,{date,themeMonth:10});assert.equal(selection.theme.month,10);assert.equal(selection.scene.id,monthlySceneOrder(theme,date)[(day-1)%31].id);}
});
test('any number of scenes works, including one and more drawings than days',()=>{
 for(const count of [1,2,10,40]){const theme={month:10,id:'test',scenes:Array.from({length:count},(_,i)=>({id:String(i)}))},m={themes:[theme]},order=monthlySceneOrder(theme,'2026-10-01');assert.equal(new Set(ids(order)).size,count);for(let day=1;day<=31;day++)assert.equal(resolveHeader(m,{date:`2026-10-${String(day).padStart(2,'0')}`}).scene.id,order[(day-1)%count].id);}
 assert.throws(()=>monthlySceneOrder({id:'empty',scenes:[]},'2026-10-01'),/no scenes/);assert.throws(()=>resolveHeader(manifest,{date:'2026-02-29'}),/Invalid/);
});
test('expanded monthly rotations include every addition once before repeating',()=>{
 for(const [month,count,length] of [[1,31,31],[2,29,28],[3,31,31],[4,30,30],[5,31,31],[6,30,30],[7,31,31],[8,31,31],[9,30,30],[10,31,31],[11,30,30],[12,31,31]]){const theme=manifest.themes.find(t=>t.month===month);assert.equal(theme.scenes.length,count);const selections=Array.from({length},(_,i)=>resolveHeader(manifest,{date:`2026-${String(month).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`}).scene.id);assert.equal(new Set(selections.slice(0,count)).size,Math.min(count,length));assert.deepEqual(new Set(selections.slice(0,count)),new Set(ids(theme.scenes.filter(scene=>!scene.reservedForDate))));for(let i=count;i<length;i++)assert.equal(selections[i],selections[i%count]);}
});




import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {monthlySceneOrder,resolveHeader} from '../dist/js/themes.js';
const manifest=JSON.parse(readFileSync(new URL('../dist/theme-manifest.json',import.meta.url)));

test('104 approved replacements mix with 262 retained scenes in their own monthly rotations',()=>{
  let additions=0,retained=0;
  const reviewIds=new Set();
  for(const theme of manifest.themes){
    const month=String(theme.month).padStart(2,'0'),order=monthlySceneOrder(theme,`2026-${month}-01`);
    const added=order.filter(scene=>scene.reviewId);
    additions+=added.length;retained+=theme.scenes.filter(scene=>!scene.reviewId).length;
    assert.deepEqual(new Set(order.map(scene=>scene.id)),new Set(theme.scenes.filter(scene=>!scene.reservedForDate).map(scene=>scene.id)));
    if(!added.length){assert.ok([2,3].includes(theme.month));continue;}
    const kinds=order.map(scene=>Boolean(scene.reviewId));
    assert.ok(kinds.filter((value,index)=>index&&value!==kinds[index-1]).length>2,'New scenes must be shuffled among retained artwork, not grouped at one end.');
    for(const scene of added){
      assert.equal(scene.background,theme.colors.background);
      assert.equal(scene.edgeBlend,'month-paper');assert.equal(scene.reviewStatus,'approved');
      assert.ok(!reviewIds.has(scene.reviewId));reviewIds.add(scene.reviewId);
    }
    for(let day=1;day<=order.length;day++)assert.equal(resolveHeader(manifest,{date:`2026-${month}-${String(day).padStart(2,'0')}`}).scene.id,order[day-1].id);
  }
  assert.equal(additions,104);assert.equal(retained,262);assert.equal(reviewIds.size,104);
});

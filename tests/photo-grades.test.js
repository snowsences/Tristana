import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';
import {PHOTO_GRADES,photoGrade} from '../dist/js/photo-grades.js';import {createDayStrip} from '../dist/js/strip-ui.js';import {bindPhotoLightbox} from '../dist/js/photo-ui.js';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
test('each entry month resolves its own grade and an explicit theme overrides it',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../dist/theme-manifest.json',import.meta.url),'utf8'));
 for(const theme of manifest.themes){const date=`2026-${String(theme.month).padStart(2,'0')}-15`;assert.equal(photoGrade(date),`url("#photo-grade-${theme.id}")`);}
 assert.equal(photoGrade('2026-10-11',5),'url("#photo-grade-daylight")');assert.throws(()=>photoGrade('2026-10-11',13));
});
test('all grades have matching SVG definitions and keep stronger grading within the requested doubled tonal bounds',()=>{
 const dom=new JSDOM(html);try{for(const g of PHOTO_GRADES){const filter=dom.window.document.getElementById('photo-grade-'+g.id);assert.ok(filter);assert.equal(filter.getAttribute('color-interpolation-filters'),'sRGB');assert.equal(Number(filter.querySelector('feColorMatrix').getAttribute('values')),g.saturation);
 for(const [i,ch] of ['R','G','B'].entries()){const transfer=filter.querySelector('feFunc'+ch);const slope=Number(transfer.getAttribute('slope')),lift=Number(transfer.getAttribute('intercept'));assert.ok(Math.abs((.5*slope+lift)-.5)<.12);assert.ok(lift>=0&&lift<=.09);assert.ok(g.saturation>=.55&&g.saturation<=1.12);assert.ok(Math.abs(slope+lift-1)<.25);assert.ok(Math.abs(slope-g.contrast*g.gain[i])<.00001);}
 }}finally{dom.window.close();}
});
test('thumbnails across a month boundary use their own grades without changing photo URLs',async()=>{
 const dom=new JSDOM(html,{pretendToBeVisual:true});try{const d=dom.window.document;d.getElementById('app-shell').hidden=false;dom.window.requestAnimationFrame=fn=>{fn();return 1;};const element=d.getElementById('day-strip');const photos=new Map([['2026-09-30',{localId:'sep'}],['2026-10-01',{localId:'oct'}]]);
 const strip=createDayStrip({element,getEntry:date=>({photo:photos.get(date)}),getToday:()=> '2026-10-11',displayDate:date=>date,getPhotoURL:async photo=>'https://example.test/'+photo.localId+'.jpg',getPhotoFilter:photoGrade,onSelect:()=>{}});strip.render('2026-10-01');strip.update();await new Promise(r=>setImmediate(r));
 const september=element.querySelector('[data-date="2026-09-30"] img'),october=element.querySelector('[data-date="2026-10-01"] img');assert.equal(september.style.filter,photoGrade('2026-09-30'));assert.equal(october.style.filter,photoGrade('2026-10-01'));assert.equal(september.src,'https://example.test/sep.jpg');assert.equal(october.src,'https://example.test/oct.jpg');
 }finally{dom.window.close();}
});
test('the lightbox preserves the same presentation grade as the journal photo',async()=>{
 const dom=new JSDOM(html);try{const d=dom.window.document,dialog=d.getElementById('photo-lightbox');dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');bindPhotoLightbox(d,{isAuthenticated:()=>true,onOpen:async()=>({date:'2026-08-10',photo:{localId:'lake'},url:'https://example.test/lake.jpg',filter:photoGrade('2026-08-10')}),onReframe:async()=>{},onRemove:async()=>true,onError:e=>{throw e;}});d.getElementById('photo-preview').click();await new Promise(r=>setImmediate(r));assert.equal(d.getElementById('lightbox-photo').style.filter,photoGrade('2026-08-10'));assert.equal(d.getElementById('lightbox-photo').src,'https://example.test/lake.jpg');}finally{dom.window.close();}
});

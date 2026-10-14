import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {applyHeader} from '../dist/js/themes.js';

const manifest=JSON.parse(readFileSync(new URL('../dist/theme-manifest.json',import.meta.url)));

test('every scene displays against its own measured paper tone, with its theme ink and accent',()=>{
  const dom=new JSDOM('<div id="header"></div>',{url:'https://example.test/Tristana/dist/'});
  const previous=globalThis.document;
  globalThis.document=dom.window.document;
  try{
    const header=document.getElementById('header');
    for(const theme of manifest.themes)for(const scene of theme.scenes){
      assert.match(scene.background,/^#[0-9a-f]{6}$/i,scene.src+' must declare its paper tone');
      applyHeader(header,{theme,scene});
      assert.equal(header.style.getPropertyValue('--journal-bg'),scene.background,scene.src);
      assert.equal(header.style.getPropertyValue('--journal-ink'),theme.colors.ink);
      assert.equal(header.style.getPropertyValue('--journal-accent'),theme.colors.accent);
      assert.equal(header.querySelector('img').getAttribute('src'),new URL(scene.src,document.baseURI).href);
    }
    const march=manifest.themes.find(theme=>theme.month===3);
    for(const scene of march.scenes){
      const red=parseInt(scene.background.slice(1,3),16),blue=parseInt(scene.background.slice(5,7),16);
      assert.ok(blue>=red,scene.src+' must retain March’s cool background');
    }
    const april=manifest.themes.find(theme=>theme.month===4);
    for(const scene of april.scenes){
      const red=parseInt(scene.background.slice(1,3),16),green=parseInt(scene.background.slice(3,5),16),blue=parseInt(scene.background.slice(5,7),16);
      assert.ok(green>=red&&green>=blue,scene.src+' must retain April’s green-white background');
    }
  }finally{globalThis.document=previous;dom.window.close();}
});

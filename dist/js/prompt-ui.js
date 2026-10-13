import {LIMIT,count} from './core.js?v=71';
export function limitedEdit(value,start,end,text) {
  const prefix=value.slice(0,start),suffix=value.slice(end);
  const available=Math.max(0,LIMIT-count(prefix)-count(suffix));
  const points=Array.from(text),accepted=points.slice(0,available).join('');
  return {value:prefix+accepted+suffix,caret:prefix.length+accepted.length,rejected:points.slice(available).join('')};
}
// Enforce the limit against the browser's actual edit, never composition event.data.
export function limitedNativeEdit(before,after) {
  if(count(after)<=LIMIT)return {value:after,rejected:''};
  const old=Array.from(before||''),next=Array.from(after);let start=0,end=0;
  while(start<old.length&&start<next.length&&old[start]===next[start])start++;
  while(end<old.length-start&&end<next.length-start&&old[old.length-1-end]===next[next.length-1-end])end++;
  const prefix=old.slice(0,start).join(''),suffix=old.slice(old.length-end).join('');
  return limitedEdit(before||'',prefix.length,(before||'').length-suffix.length,next.slice(start,next.length-end).join(''));
}
export function createPromptEditor(document,{onChange,onError}) {
  const win=document.defaultView;const fields=['good','learned'];
  const live=document.createElement('span');live.className='sr-only';live.setAttribute('role','status');document.body.append(live);
  let announceTimer;
  const resize=input=>{if(!input.clientWidth)return;const scroller=input.closest('dialog[open]'),scroll=scroller?.scrollTop,windowScroll=win.scrollY;
    input.style.height='auto';const height=input.scrollHeight;input.style.height=height+'px';
    // Measurement must not collapse the field and move the surrounding scroll area.
    if(scroller&&scroller.scrollTop!==scroll)scroller.scrollTop=scroll;if(win.scrollY!==windowScroll)win.scrollTo({top:windowScroll,behavior:'auto'});
  };
  function spill(input,text) {
    if(!text)return;
    if(!announceTimer){live.textContent='140 characters is the limit.';announceTimer=setTimeout(()=>{live.textContent='';announceTimer=null;},2500);}
    const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduced||!input.animate){input.classList.add('limit-reached');setTimeout(()=>input.classList.remove('limit-reached'),200);return;}
    const rect=input.getBoundingClientRect(),css=win.getComputedStyle(input);
    const mirror=document.createElement('div');mirror.className='caret-mirror';
    for(const property of ['font','fontSize','fontFamily','fontWeight','lineHeight','letterSpacing','padding','border','boxSizing'])mirror.style[property]=css[property];
    Object.assign(mirror.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',whiteSpace:'pre-wrap',overflowWrap:'break-word',visibility:'hidden'});
    mirror.textContent=input.value.slice(0,input.selectionStart);const marker=document.createElement('span');marker.textContent='\u200b';mirror.append(marker);document.body.append(mirror);
    const caret=marker.getBoundingClientRect();mirror.remove();
    const originX=Math.min(rect.right-8,Math.max(rect.left,caret.left)),originY=Math.min(rect.bottom-parseFloat(css.lineHeight),Math.max(rect.top,caret.top));
    for(const [i,char] of Array.from(text).slice(0,12).entries()){
      const particle=document.createElement('span');particle.className='falling-character';particle.setAttribute('aria-hidden','true');particle.textContent=char==='\n'?'↵':char;
      Object.assign(particle.style,{left:Math.min(rect.right-8,originX+i*8)+'px',top:originY+'px',font:css.font,color:css.color});document.body.append(particle);
      const animation=particle.animate([{transform:'translate(0,0) rotate(0deg)',opacity:.9},{transform:'translate(5px,16px) rotate(5deg)',opacity:.8,offset:.25},{transform:'translate(16px,72px) rotate(22deg)',opacity:0}],{duration:650,delay:i*18,easing:'cubic-bezier(.35,0,.85,.65)',fill:'forwards'});
      animation.finished.catch(()=>{}).finally(()=>particle.remove());
    }
  }
  function save(input,baseline=input._beforeValue??input._savedValue??'') {
    if(input.isComposing)return resize(input);
    const edit=limitedNativeEdit(baseline,input.value),value=edit.value;
    // Even assigning the same value can reset Android's composing region.
    if(input.value!==value){input.value=value;if(edit.caret!==undefined)input.setSelectionRange(edit.caret,edit.caret);}
    delete input._beforeValue;resize(input);spill(input,edit.rejected);
    if(input.dataset.day&&input._savedValue!==value){input._savedValue=value;Promise.resolve(onChange(input.id,value,input.dataset.day)).catch(onError);}
  }
  for(const field of fields){const input=document.getElementById(field);
    input.addEventListener('beforeinput',event=>{
      if(event.isComposing||input.isComposing)return;input._beforeValue=input.value;
      if(event.inputType!=='insertText'||event.data===null)return;
      const edit=limitedEdit(input.value,input.selectionStart,input.selectionEnd,event.data);
      if(!edit.rejected)return;
      if(!event.cancelable)return;
      event.preventDefault();input.value=edit.value;input.setSelectionRange(edit.caret,edit.caret);resize(input);spill(input,edit.rejected);save(input);
    });
    input.addEventListener('paste',event=>{if(input.isComposing)return;const text=event.clipboardData?.getData('text/plain');if(!text)return;const edit=limitedEdit(input.value,input.selectionStart,input.selectionEnd,text);if(edit.rejected){event.preventDefault();input.value=edit.value;input.setSelectionRange(edit.caret,edit.caret);resize(input);spill(input,edit.rejected);save(input);}});
    input.addEventListener('input',event=>{input.isComposing=event.isComposing;save(input);});
    function finishComposition(){const baseline=input._composition?.value;delete input._composition;input.isComposing=false;save(input,baseline??input._savedValue??'');}
    input.addEventListener('compositionstart',()=>{input.isComposing=true;input._composition={value:input.value,start:input.selectionStart,end:input.selectionEnd};});
    input.addEventListener('compositionend',()=>finishComposition());
    input.addEventListener('blur',()=>finishComposition());
  }
  return {
    setEntry(entry){for(const field of fields){const input=document.getElementById(field),differentDay=input.dataset.day!==entry.date;if(differentDay||document.activeElement!==input){const value=entry[field]||'';if(input.value!==value)input.value=value;input._savedValue=value;}input.dataset.day=entry.date;}win.requestAnimationFrame(()=>fields.forEach(f=>resize(document.getElementById(f))));},
    commit(){for(const field of fields){const input=document.getElementById(field);if(document.activeElement===input)input.blur();save(input);}},
    resize(){fields.forEach(f=>resize(document.getElementById(f)));},
    reset(){document.querySelectorAll('.falling-character').forEach(p=>{p.getAnimations?.().forEach(a=>a.cancel());p.remove();});live.textContent='';clearTimeout(announceTimer);announceTimer=null;for(const field of fields){const input=document.getElementById(field);input.value='';input._savedValue='';delete input.dataset.day;}},
  };
}

import {LIMIT,count,limit} from './core.js';
export function limitedEdit(value,start,end,text) {
  const prefix=value.slice(0,start),suffix=value.slice(end);
  const available=Math.max(0,LIMIT-count(prefix)-count(suffix));
  const points=Array.from(text),accepted=points.slice(0,available).join('');
  return {value:prefix+accepted+suffix,caret:prefix.length+accepted.length,rejected:points.slice(available).join('')};
}
export function createPromptEditor(document,{onChange,onError}) {
  const win=document.defaultView;const fields=['good','learned'];
  const live=document.createElement('span');live.className='sr-only';live.setAttribute('role','status');document.body.append(live);
  let announceTimer;
  const resize=input=>{input.style.height='auto';if(input.clientWidth)input.style.height=input.scrollHeight+'px';};
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
  function save(input) {
    if(input.isComposing)return resize(input);
    const value=limit(input.value),extra=Array.from(input.value).slice(LIMIT).join('');input.value=value;resize(input);spill(input,extra);
    if(input.dataset.day&&input._savedValue!==value){input._savedValue=value;Promise.resolve(onChange(input.id,value,input.dataset.day)).catch(onError);}
  }
  for(const field of fields){const input=document.getElementById(field);
    input.addEventListener('beforeinput',event=>{
      if(event.isComposing||input.isComposing||!event.inputType?.startsWith('insert')||event.data===null)return;
      const edit=limitedEdit(input.value,input.selectionStart,input.selectionEnd,event.data);
      if(!edit.rejected)return;
      if(!event.cancelable)return;
      event.preventDefault();input.value=edit.value;input.setSelectionRange(edit.caret,edit.caret);resize(input);spill(input,edit.rejected);save(input);
    });
    input.addEventListener('paste',event=>{if(input.isComposing)return;const text=event.clipboardData?.getData('text/plain');if(!text)return;const edit=limitedEdit(input.value,input.selectionStart,input.selectionEnd,text);if(edit.rejected){event.preventDefault();input.value=edit.value;input.setSelectionRange(edit.caret,edit.caret);resize(input);spill(input,edit.rejected);save(input);}});
    input.addEventListener('input',event=>{input.isComposing=event.isComposing;save(input);});
    function finishComposition(text){const base=input._composition;if(base){const inserted=text??input.value.slice(base.start,input.value.length-(base.value.length-base.end));const edit=limitedEdit(base.value,base.start,base.end,inserted);input.value=edit.value;input.setSelectionRange(edit.caret,edit.caret);spill(input,edit.rejected);delete input._composition;}input.isComposing=false;save(input);}
    input.addEventListener('compositionstart',()=>{input.isComposing=true;input._composition={value:input.value,start:input.selectionStart,end:input.selectionEnd};});
    input.addEventListener('compositionend',event=>finishComposition(event.data));
    input.addEventListener('blur',()=>finishComposition());
  }
  return {
    setEntry(entry){for(const field of fields){const input=document.getElementById(field),differentDay=input.dataset.day!==entry.date;if(differentDay||document.activeElement!==input){input.value=entry[field]||'';input._savedValue=input.value;}input.dataset.day=entry.date;}win.requestAnimationFrame(()=>fields.forEach(f=>resize(document.getElementById(f))));},
    commit(){for(const field of fields){const input=document.getElementById(field);if(document.activeElement===input)input.blur();save(input);}},
    resize(){fields.forEach(f=>resize(document.getElementById(f)));},
    reset(){document.querySelectorAll('.falling-character').forEach(p=>{p.getAnimations?.().forEach(a=>a.cancel());p.remove();});live.textContent='';clearTimeout(announceTimer);announceTimer=null;for(const field of fields){const input=document.getElementById(field);input.value='';input._savedValue='';delete input.dataset.day;}},
  };
}

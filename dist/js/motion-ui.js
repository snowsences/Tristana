export const reducedMotion=()=>globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export function reveal(element,{duration=180,offset=0}={}) {
  if(!element||element.hidden||reducedMotion()||!element.animate)return;
  element.getAnimations?.().forEach(a=>a.cancel());
  element.animate([{opacity:.25,transform:`translateY(${offset}px)`},{opacity:1,transform:'translateY(0)'}],{duration,easing:'cubic-bezier(.2,.7,.2,1)'});
}
const departures=new WeakMap();
export function cancelConceal(element){
  const state=element&&departures.get(element);if(!state)return;
  departures.delete(element);state.animation.cancel();element.inert=state.inert;
}
export async function conceal(element,{duration=140,offset=6}={}) {
  if(!element)return;
  const previous=departures.get(element);
  previous?.animation.cancel();
  if(element.hidden||reducedMotion()||!element.animate){
    if(previous){element.inert=previous.inert;departures.delete(element);}
    return;
  }
  element.getAnimations?.().forEach(animation=>animation.cancel());
  const animation=element.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:`translateY(${offset}px)`}],{duration,easing:'cubic-bezier(.8,0,.8,.3)',fill:'forwards'});
  const state={animation,inert:previous?previous.inert:element.inert};
  departures.set(element,state);element.inert=true;
  const restore=()=>{
    if(departures.get(element)===state){animation.cancel();element.inert=state.inert;departures.delete(element);}
  };
  try{await animation.finished;return restore;}catch{restore();}
}
export function containedRect(image){const r=image.getBoundingClientRect(),ratio=(image.naturalWidth||1)/(image.naturalHeight||1);let width=r.width,height=width/ratio;if(height>r.height){height=r.height;width=height*ratio;}return {left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2,width,height};}
export async function animatePhoto(image,from,to,{closing=false}={}){
  if(!image?.animate||reducedMotion()||!from?.width||!to?.width)return;
  const dx=from.left+from.width/2-to.left-to.width/2,dy=from.top+from.height/2-to.top-to.height/2;
  const start=`translate(${dx}px,${dy}px) scale(${from.width/to.width},${from.height/to.height})`;
  const frames=closing?[{transform:'none',opacity:1},{transform:start,opacity:.3}]:[{transform:start,opacity:.5},{transform:'none',opacity:1}];
  try{await image.animate(frames,{duration:closing?170:220,easing:'cubic-bezier(.2,.7,.2,1)'}).finished;}catch{}
}
export function installDialogs(document) {
  const win=document.defaultView,history=win.history;let pendingBack=null;const stack=[];
  function restoreHistory(dialog){if(history.state?.tristanaDialog===dialog.id){return new Promise(resolve=>{
    let timeout;const finish=()=>{if(pendingBack!==finish)return;clearTimeout(timeout);pendingBack=null;resolve();};pendingBack=finish;history.back();timeout=setTimeout(()=>{if(pendingBack===finish){const state={...history.state};delete state.tristanaDialog;history.replaceState(state,'');finish();}},400);
  });}return Promise.resolve();}
  for(const dialog of document.querySelectorAll('dialog')){
    const show=dialog.showModal.bind(dialog),close=dialog.close.bind(dialog);let closing=null;
    dialog.showModal=()=>{if(dialog.open)return;show();stack.push(dialog);history.pushState({...history.state,tristanaDialog:dialog.id},'');
      if(dialog.id!=='photo-lightbox')reveal(dialog,{duration:190,offset:8});
    };
    const dismiss=async(value,immediate=false,fromBack=false)=>{
      if(closing)return closing;if(!dialog.open)return;
      closing=Promise.resolve().then(async()=>{
        if(!immediate){
          dialog.classList.add('is-closing');const effects=[];
          if(dialog._beforeClose)effects.push(dialog._beforeClose());
          if(!reducedMotion()&&dialog.animate){const frames=dialog.id==='photo-lightbox'?[{opacity:1},{opacity:0}]:[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(6px)'}];effects.push(dialog.animate(frames,{duration:dialog.id==='photo-lightbox'?170:140,easing:'ease-in'}).finished.catch(()=>{}));}
          await Promise.all(effects);
        }
        dialog._managedClosing=true;close(value);dialog.classList.remove('is-closing');const index=stack.indexOf(dialog);if(index>=0)stack.splice(index,1);
        if(!fromBack)await restoreHistory(dialog);
      });try{await closing;}finally{closing=null;}
    };
    dialog.close=value=>dismiss(value,false);
    dialog.whenClosed=()=>closing||Promise.resolve();
    dialog.closeImmediately=value=>{dialog.getAnimations?.().forEach(a=>a.cancel());if(dialog.open){dialog._managedClosing=true;close(value);}const index=stack.indexOf(dialog);if(index>=0)stack.splice(index,1);return restoreHistory(dialog);};
    dialog.addEventListener('submit',event=>{if(event.target.method==='dialog'){event.preventDefault();dialog.close(event.submitter?.value||'');}});
    dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close('cancel');});
    // Native form method=dialog also needs to remove its history entry.
    dialog.addEventListener('close',()=>{if(dialog._managedClosing){dialog._managedClosing=false;return;}const index=stack.indexOf(dialog);if(index>=0)stack.splice(index,1);restoreHistory(dialog);});
    dialog._closeFromBack=()=>dismiss('cancel',false,true);
  }
  win.addEventListener('popstate',()=>{if(pendingBack){pendingBack();return;}const top=stack.at(-1);if(top&&history.state?.tristanaDialog!==top.id)top._closeFromBack();});
}
export function confirmAction(document,{title,message,action='Remove'}){
  const dialog=document.getElementById('confirm-dialog');dialog.querySelector('h2').textContent=title;dialog.querySelector('p').textContent=message;dialog.querySelector('[value="confirm"]').textContent=action;
  return new Promise(resolve=>{dialog.addEventListener('close',async()=>{await dialog.whenClosed?.();resolve(dialog.returnValue==='confirm');},{once:true});dialog.returnValue='cancel';dialog.showModal();});
}

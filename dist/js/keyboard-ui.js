// Respect the native composing region. Only the surrounding viewport is adjusted.
export function installKeyboardComfort(document) {
  const win=document.defaultView,viewport=win.visualViewport,root=document.documentElement;
  let baseline=viewport?.height||win.innerHeight,active=null,snapshot=null,manual=false,frame,timer;
  const isPrompt=element=>element?.tagName==='TEXTAREA'&&['good','learned'].includes(element.id);
  const scope=element=>element?.closest('dialog[open]')||win;
  const top=scroller=>scroller===win?win.scrollY:scroller.scrollTop;
  const move=(scroller,value)=>{if(scroller.scrollTo)scroller.scrollTo({top:Math.max(0,value),behavior:'auto'});else scroller.scrollTop=Math.max(0,value);};
  function restore(){
    delete root.dataset.keyboardOpen;root.style.removeProperty('--editor-viewport-height');root.style.removeProperty('--keyboard-occlusion');
    if(snapshot&&!manual)move(snapshot.scroller,snapshot.top);snapshot=null;active=isPrompt(document.activeElement)?document.activeElement:null;manual=false;baseline=viewport?.height||win.innerHeight;
  }
  function update(){
    const height=viewport?.height||win.innerHeight,offset=viewport?.offsetTop||0;
    if(!active){baseline=Math.max(baseline,height);return;}
    const opened=baseline-height>120;
    if(!opened){if(root.dataset.keyboardOpen){win.clearTimeout(timer);timer=win.setTimeout(restore,120);}return;}
    win.clearTimeout(timer);if(!snapshot){const scroller=scope(active);snapshot={scroller,top:top(scroller)};manual=false;}root.dataset.keyboardOpen='true';root.style.setProperty('--editor-viewport-height',height+'px');root.style.setProperty('--keyboard-occlusion',Math.max(0,win.innerHeight-height-offset)+'px');
    if(document.activeElement!==active||!active.isConnected)return;
    const scroller=scope(active),r=active.getBoundingClientRect();const bottom=offset+height-24;
    const sticky=scroller===win?0:scroller.querySelector('.empty-day-head')?.getBoundingClientRect().bottom||offset;
    if(r.bottom>bottom)move(scroller,top(scroller)+r.bottom-bottom);
    else if(r.top<Math.max(offset+20,sticky+12))move(scroller,top(scroller)+r.top-Math.max(offset+20,sticky+12));
  }
  function schedule(){win.cancelAnimationFrame(frame);frame=win.requestAnimationFrame(update);}
  function focus(event){if(!isPrompt(event.target))return;win.clearTimeout(timer);if(!snapshot){const scroller=scope(event.target);snapshot={scroller,top:top(scroller)};baseline=Math.max(baseline,viewport?.height||win.innerHeight);manual=false;}active=event.target;schedule();}
  function blur(){win.clearTimeout(timer);timer=win.setTimeout(()=>{if(isPrompt(document.activeElement)){active=document.activeElement;schedule();}else restore();},160);}
  function userScroll(){if(snapshot)manual=true;}
  document.addEventListener('focusin',focus);document.addEventListener('focusout',blur);document.addEventListener('input',schedule);
  win.addEventListener('resize',schedule);viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule);
  document.addEventListener('touchmove',userScroll,{passive:true});document.addEventListener('wheel',userScroll,{passive:true});
  return {refresh:schedule,dispose(){win.clearTimeout(timer);win.cancelAnimationFrame(frame);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',blur);document.removeEventListener('input',schedule);win.removeEventListener('resize',schedule);viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);document.removeEventListener('touchmove',userScroll);document.removeEventListener('wheel',userScroll);restore();}};
}

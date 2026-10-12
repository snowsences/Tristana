// Android's native stretch is replaced only at vertical page boundaries.
// Normal page scrolling and horizontal day-strip momentum remain browser-owned.
export const rubberBand=distance=>Math.sign(distance)*64*(Math.abs(distance)*.55)/(64+Math.abs(distance)*.55);
export function installElasticScroll(document,{isAllowed=()=>true,now=()=>document.defaultView.performance.now()}={}) {
  const win=document.defaultView,root=document.documentElement,main=document.getElementById('main');
  if(!main||!/Android/i.test(win.navigator.userAgent))return {dispose(){},cancel(){}};
  root.dataset.elasticPlatform='android';
  const media=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let gesture,frame,offset=0,lastScroll=win.scrollY,lastScrollTime=now(),recentTouch=-Infinity,scrollVelocity=0,boundaryListener=false;
  const maximum=()=>Math.max(0,root.scrollHeight-win.innerHeight);
  const allowed=()=>isAllowed()&&!media?.matches&&!document.querySelector('dialog[open]');
  function paint(value){offset=value;root.style.setProperty('--edge-offset',value.toFixed(2)+'px');if(Math.abs(value)>.1)root.dataset.edgeBounce='true';else delete root.dataset.edgeBounce;}
  function cancel(){win.cancelAnimationFrame(frame);frame=null;paint(0);}
  function spring(value,velocity=0){
    win.cancelAnimationFrame(frame);const start=now(),speed=Math.max(-500,Math.min(500,velocity)),frequency=18;
    paint(value);
    const step=()=>{const time=Math.max(0,(now()-start)/1000),position=(value+(speed+frequency*value)*time)*Math.exp(-frequency*time);
      if(time>.7||Math.abs(position)<.15){cancel();return;}paint(position);frame=win.requestAnimationFrame(step);
    };frame=win.requestAnimationFrame(step);
  }
  function detachBoundary(){if(boundaryListener){main.removeEventListener('touchmove',pull);boundaryListener=false;}}
  function start(event){
    reset();if(event.touches.length!==1||!allowed()||event.target.closest('.day-strip,dialog,input,textarea,select,[contenteditable]'))return;
    const point=event.touches[0];gesture={x:point.clientX,y:point.clientY,lastY:point.clientY,lastTime:now(),velocity:0,axis:null,edge:null,base:point.clientY};recentTouch=now();
    // Non-passive delivery is needed only for a gesture beginning at an edge.
    // The entire middle of the page keeps native asynchronous touch scrolling.
    if(win.scrollY<=1||win.scrollY>=maximum()-1){main.addEventListener('touchmove',pull,{passive:false});boundaryListener=true;}
  }
  function track(event){
    if(!gesture)return;if(event.touches.length!==1){cancel();gesture=null;detachBoundary();return;}
    const point=event.touches[0],dx=point.clientX-gesture.x,dy=point.clientY-gesture.y,time=now();
    if(!gesture.axis&&Math.max(Math.abs(dx),Math.abs(dy))>=6)gesture.axis=Math.abs(dx)>Math.abs(dy)?'horizontal':'vertical';
    gesture.velocity=(point.clientY-gesture.lastY)/Math.max(8,time-gesture.lastTime)*1000;gesture.lastY=point.clientY;gesture.lastTime=time;recentTouch=time;
  }
  function pull(event){
    if(!gesture||gesture.axis!=='vertical'||event.touches.length!==1||!event.cancelable||!allowed())return;
    const y=event.touches[0].clientY,dy=y-gesture.y;
    if(!gesture.edge){if(dy>0&&win.scrollY<=1)gesture.edge='top';else if(dy<0&&win.scrollY>=maximum()-1)gesture.edge='bottom';else return;}
    const distance=gesture.edge==='top'?Math.max(0,y-gesture.base):Math.min(0,y-gesture.base);
    event.preventDefault();paint(rubberBand(distance));
  }
  function end(event){
    if(event.touches?.length)return;detachBoundary();if(!gesture)return;const released=gesture;gesture=null;recentTouch=now();
    if(offset)spring(offset,event.type==='touchcancel'?0:released.velocity*.2);
  }
  function scroll(){
    const time=now(),position=win.scrollY,delta=position-lastScroll,elapsed=time-lastScrollTime;
    if(elapsed>0&&elapsed<100&&delta)scrollVelocity=delta/elapsed*1000;
    if(!gesture&&!frame&&delta&&time-recentTouch<1400&&allowed()){
      const edge=position<=1&&delta<0?'top':position>=maximum()-1&&delta>0?'bottom':null;
      if(edge&&Math.abs(scrollVelocity)>80){spring(0,(edge==='top'?1:-1)*Math.min(500,Math.max(150,Math.abs(scrollVelocity)*.4)));recentTouch=-Infinity;}
    }
    lastScroll=position;lastScrollTime=time;
  }
  const reset=()=>{gesture=null;recentTouch=-Infinity;detachBoundary();cancel();lastScroll=win.scrollY;lastScrollTime=now();};
  main.addEventListener('touchstart',start,{passive:true});main.addEventListener('touchmove',track,{passive:true});
  win.addEventListener('touchend',end,{passive:true});win.addEventListener('touchcancel',end,{passive:true});win.addEventListener('scroll',scroll,{passive:true});win.addEventListener('resize',reset);win.addEventListener('pagehide',reset);media?.addEventListener?.('change',reset);
  return {cancel:reset,dispose(){reset();main.removeEventListener('touchstart',start);main.removeEventListener('touchmove',track);win.removeEventListener('touchend',end);win.removeEventListener('touchcancel',end);win.removeEventListener('scroll',scroll);win.removeEventListener('resize',reset);win.removeEventListener('pagehide',reset);media?.removeEventListener?.('change',reset);delete root.dataset.elasticPlatform;root.style.removeProperty('--edge-offset');}};
}

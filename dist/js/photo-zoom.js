// Zoom the photograph itself, never the browser viewport or journal UI.
export function createPhotoZoom(image,{isActive=()=>true}={}) {
  const win=image.ownerDocument.defaultView,pointers=new Map();
  let scale=1,x=0,y=0,frame=null,lastTap=null;
  const clamp=(value,bound)=>Math.min(bound,Math.max(-bound,value));
  function bounds(){
    const ratio=(image.naturalWidth||frame.width)/(image.naturalHeight||frame.height);
    let width=frame.width,height=width/ratio;if(height>frame.height){height=frame.height;width=height*ratio;}
    return {x:Math.max(0,(width*scale-frame.width)/2),y:Math.max(0,(height*scale-frame.height)/2)};
  }
  function render(){if(!frame?.width||!frame.height)return;const b=bounds();x=clamp(x,b.x);y=clamp(y,b.y);
    if(scale===1){image.style.removeProperty('transform');delete image.dataset.zoomed;}else{image.style.transform=`translate(${x}px,${y}px) scale(${scale})`;image.dataset.zoomed='true';}
  }
  function reset(){scale=1;x=y=0;pointers.clear();lastTap=null;image.style.removeProperty('transform');delete image.dataset.zoomed;frame=image.getBoundingClientRect();}
  function local(point){return {x:point.x-frame.left-frame.width/2,y:point.y-frame.top-frame.height/2};}
  function zoomAt(next,point){if(!frame?.width||!frame.height)return;const anchor=local(point),ratio=next/scale;x=anchor.x-(anchor.x-x)*ratio;y=anchor.y-(anchor.y-y)*ratio;scale=next;render();}
  image.addEventListener('pointerdown',event=>{
    if(!isActive()||event.button>0)return;
    image.getAnimations?.().forEach(animation=>animation.cancel());if(scale===1)frame=image.getBoundingClientRect();
    image.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,time:Date.now(),type:event.pointerType,moved:false,pinched:false});
    if(pointers.size>1){lastTap=null;for(const p of pointers.values())p.pinched=true;}
  });
  image.addEventListener('pointermove',event=>{
    const p=pointers.get(event.pointerId);if(!p||!frame?.width||!frame.height)return;
    const before=[...pointers.values()].slice(0,2).map(v=>({x:v.x,y:v.y})),dx=event.clientX-p.x,dy=event.clientY-p.y;p.x=event.clientX;p.y=event.clientY;
    if(Math.hypot(p.x-p.startX,p.y-p.startY)>8)p.moved=true;
    if(pointers.size>=2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),oldDistance=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y);if(oldDistance<1)return;
      const prior=local({x:(before[0].x+before[1].x)/2,y:(before[0].y+before[1].y)/2}),next=local({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
      const newScale=Math.min(4,Math.max(1,scale*distance/oldDistance)),ratio=newScale/scale;
      x=next.x-(prior.x-x)*ratio;y=next.y-(prior.y-y)*ratio;scale=newScale;
    }else if(scale>1){x+=dx;y+=dy;}
    render();
  });
  function finish(event,canceled=false){const p=pointers.get(event.pointerId);if(!p)return;pointers.delete(event.pointerId);
    if(canceled){lastTap=null;return;}if(p.type!=='touch'||p.pinched||p.moved||pointers.size||Date.now()-p.time>300)return;
    const now=Date.now();if(lastTap&&now-lastTap.time<300&&Math.hypot(p.x-lastTap.x,p.y-lastTap.y)<24){zoomAt(scale>1?1:2.5,p);lastTap=null;}else lastTap={time:now,x:p.x,y:p.y};
  }
  image.addEventListener('pointerup',event=>finish(event));image.addEventListener('pointercancel',event=>finish(event,true));image.addEventListener('lostpointercapture',event=>finish(event,true));
  image.addEventListener('dblclick',event=>{if(!isActive())return;event.preventDefault();zoomAt(scale>1?1:2.5,{x:event.clientX,y:event.clientY});});
  image.addEventListener('dragstart',event=>event.preventDefault());
  win.addEventListener('resize',()=>{if(isActive())reset();});
  return {reset,get isZoomed(){return scale>1;}};
}

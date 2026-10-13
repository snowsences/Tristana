import {cropBounds,cropSource} from './core.js?v=74';
import {scaledPhoto,restoredCrop} from './image-utils.js?v=74';

export function pinchCropPose(pose,oldCenter,newCenter,distanceRatio){
  const zoom=Math.min(4,Math.max(1,pose.zoom*distanceRatio)),ratio=zoom/pose.zoom;
  return {zoom,x:newCenter.x+(pose.x-oldCenter.x)*ratio,y:newCenter.y+(pose.y-oldCenter.y)*ratio};
}
export function createCropper(onSave,onError,{onPlaced=()=>{}}={}) {
  const dialog=document.querySelector('#crop-dialog'),frame=document.querySelector('#crop-frame'),image=document.querySelector('#crop-image'),slider=document.querySelector('#crop-zoom'),win=document.defaultView;
  let source,date,oldPhoto,url,width,height,x=0,y=0,zoom=1,serial=0,saving=false,lastFrameWidth=0,raf,gridTimer,tap;
  const pointers=new Map();let gesture;
  const reduced=()=>win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function showGrid(){clearTimeout(gridTimer);frame.dataset.adjusting='true';}
  function hideGrid(){clearTimeout(gridTimer);gridTimer=setTimeout(()=>{delete frame.dataset.adjusting;},350);}
  function render(){
    if(!width||!dialog.open||!frame.clientWidth)return;
    const fw=frame.clientWidth;if(lastFrameWidth&&fw!==lastFrameWidth){x*=fw/lastFrameWidth;y*=fw/lastFrameWidth;}lastFrameWidth=fw;
    const b=cropBounds(width,height,fw,zoom,x,y);x=b.x;y=b.y;
    const base=cropBounds(width,height,fw,1,0,0).scale;
    image.style.width=width*base+'px';image.style.height=height*base+'px';
    image.style.transform=`translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(${zoom})`;
  }
  function schedule(){win.cancelAnimationFrame(raf);raf=win.requestAnimationFrame(render);}
  function reset(){
    const previous=image.style.transform;zoom=1;x=0;y=0;slider.value='1';render();showGrid();hideGrid();
    if(previous&&image.animate&&!reduced())image.animate([{transform:previous},{transform:image.style.transform}],{duration:180,easing:'ease-out'});
  }
  async function open(blob,entryDate,previous) {
    if(blob.size>20*1024*1024)throw new Error('Choose a photo smaller than 20 MB.');
    const request=++serial;source=blob;date=entryDate;oldPhoto=previous;zoom=1;x=0;y=0;slider.value='1';width=0;lastFrameWidth=0;pointers.clear();tap=null;gesture=null;
    if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);image.src=url;
    await image.decode();if(request!==serial)return;width=image.naturalWidth;height=image.naturalHeight;
    if(!width||!height)throw new Error('This photo format could not be opened. Try a JPEG or PNG.');
    dialog.showModal();lastFrameWidth=frame.clientWidth;
    if(previous?.crop){const restored=restoredCrop(previous.crop,width,height,frame.clientWidth);({x,y,zoom}=restored);slider.value=zoom;}
    delete frame.dataset.adjusting;render();
  }
  const center=points=>{const [a,b]=points,r=frame.getBoundingClientRect();return {x:(a.x+b.x)/2-r.left-r.width/2,y:(a.y+b.y)/2-r.top-r.height/2};};
  const distance=points=>Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
  frame.addEventListener('pointerdown',event=>{
    if(!dialog.open||saving||pointers.size>=2)return;
    image.getAnimations?.().forEach(a=>a.cancel());frame.setPointerCapture?.(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});showGrid();
    if(pointers.size===1)gesture={x:event.clientX,y:event.clientY,time:Date.now(),moved:false,pinched:false};
    else{if(gesture)gesture.pinched=true;tap=null;}
  });
  frame.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId)||saving)return;
    const before=[...pointers.values()],prior=pointers.get(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(gesture&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>8)gesture.moved=true;
    if(pointers.size===2){
      const after=[...pointers.values()],d=distance(before);if(d>0)({x,y,zoom}=pinchCropPose({x,y,zoom},center(before),center(after),distance(after)/d));slider.value=zoom;
    }else{x+=event.clientX-prior.x;y+=event.clientY-prior.y;}
    schedule();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(type,event=>{
    if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);render();
    if(!pointers.size){
      if(type==='pointerup'&&gesture&&!gesture.moved&&!gesture.pinched&&Date.now()-gesture.time<300){
        if(tap&&Date.now()-tap.time<300&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)<24){reset();tap=null;}
        else tap={x:event.clientX,y:event.clientY,time:Date.now()};
      }else tap=null;gesture=null;hideGrid();
    }
  });
  frame.addEventListener('dblclick',()=>{if(dialog.open&&!saving)reset();});
  slider.addEventListener('input',()=>{if(saving)return;zoom=Number(slider.value);showGrid();render();hideGrid();});
  document.querySelector('#crop-reset').onclick=reset;
  document.querySelector('#cancel-crop').onclick=()=>{if(!saving)dialog.close();};
  new ResizeObserver(schedule).observe(frame);
  dialog.addEventListener('close',()=>{serial++;pointers.clear();gesture=null;tap=null;clearTimeout(gridTimer);win.cancelAnimationFrame(raf);delete frame.dataset.adjusting;if(url){URL.revokeObjectURL(url);url=null;}});
  document.querySelector('#save-crop').onclick=async()=>{
    if(saving||!dialog.open)return;render();
    const button=document.querySelector('#save-crop'),cancel=document.querySelector('#cancel-crop'),label=button.textContent,request=serial;
    saving=true;button.disabled=true;cancel.disabled=true;button.textContent='Preparing…';
    const targetDate=date,from=frame.getBoundingClientRect();
    try{
      const s=cropSource(width,height,frame.clientWidth,zoom,x,y),canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1024,1024);ctx.drawImage(image,s.sx,s.sy,s.size,s.size,0,0,1024,1024);
      const square=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!square)throw new Error('Could not crop this photo.');
      const optimized=await scaledPhoto(source);if(request!==serial||!dialog.open)return;
      await onSave({source:optimized,square,date:targetDate,oldPhoto,crop:{sx:s.sx,sy:s.sy,size:s.size,width,height}});
      if(request!==serial)return;await dialog.close();await onPlaced({date:targetDate,from});
    }catch(error){onError(error);}finally{saving=false;button.disabled=false;cancel.disabled=false;button.textContent=label;}
  };
  return {open};
}

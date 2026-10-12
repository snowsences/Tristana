import {cropBounds,cropSource} from './core.js';
import {scaledPhoto,restoredCrop} from './image-utils.js';
export function createCropper(onSave,onError,{photoFilter=()=> 'none'}={}) {
  const dialog=document.querySelector('#crop-dialog'),frame=document.querySelector('#crop-frame'),image=document.querySelector('#crop-image'),slider=document.querySelector('#crop-zoom');
  let source,date,oldPhoto,url,width,height,x=0,y=0,zoom=1;const pointers=new Map();let lastDistance;
  const render=()=>{
    if(!width)return;const b=cropBounds(width,height,frame.clientWidth,zoom,x,y);x=b.x;y=b.y;
    image.style.width=width*b.scale+'px';image.style.height=height*b.scale+'px';image.style.transform=`translate(calc(-50% + ${x}px),calc(-50% + ${y}px))`;
  };
  async function open(blob,entryDate,previous) {
    if(blob.size>20*1024*1024) throw new Error('Choose a photo smaller than 20 MB.');
    source=blob;date=entryDate;oldPhoto=previous;zoom=1;x=0;y=0;slider.value='1';width=0;
    if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);image.style.filter=photoFilter(entryDate);image.src=url;
    await image.decode();width=image.naturalWidth;height=image.naturalHeight;
    if(!width||!height)throw new Error('This photo format could not be opened. Try a JPEG or PNG.');
    dialog.showModal();if(previous?.crop){const restored=restoredCrop(previous.crop,width,height,frame.clientWidth);({x,y,zoom}=restored);slider.value=zoom;}render();
  }
  frame.addEventListener('pointerdown',e=>{frame.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastDistance=undefined;});
  frame.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;const prior=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const [a,b]=[...pointers.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);if(lastDistance)zoom=Math.min(4,Math.max(1,zoom*distance/lastDistance));lastDistance=distance;slider.value=zoom;}
    else{x+=e.clientX-prior.x;y+=e.clientY-prior.y;} render();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(event,e=>{pointers.delete(e.pointerId);lastDistance=undefined;});
  slider.addEventListener('input',()=>{zoom=Number(slider.value);render();});
  document.querySelector('#crop-reset').onclick=()=>{zoom=1;x=0;y=0;slider.value=1;render();};
  document.querySelector('#cancel-crop').onclick=()=>dialog.close();
  new ResizeObserver(render).observe(frame);
  document.querySelector('#save-crop').onclick=async()=>{
    const button=document.querySelector('#save-crop');const label=button.textContent;button.disabled=true;button.textContent='Preparing…';
    try {
      const s=cropSource(width,height,frame.clientWidth,zoom,x,y);const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1024,1024);ctx.drawImage(image,s.sx,s.sy,s.size,s.size,0,0,1024,1024);
      const square=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!square)throw new Error('Could not crop this photo.');
      const optimized=await scaledPhoto(source);
      await onSave({source:optimized,square,date,oldPhoto,crop:{sx:s.sx,sy:s.sy,size:s.size,width,height}});await dialog.close();
    }catch(error){onError(error);}finally{button.disabled=false;button.textContent=label;}
  };
  return {open};
}

// Private photographs stay in IndexedDB and authenticated storage.
export async function decodePhoto(blob) {
  const url=URL.createObjectURL(blob),image=new Image();image.src=url;
  try { await image.decode();return {image,release:()=>URL.revokeObjectURL(url)}; }
  catch(error){URL.revokeObjectURL(url);throw error;}
}
export async function scaledPhoto(blob,{maxEdge=2560,maxBytes=2500000,quality=.88}={}) {
  const {image,release}=await decodePhoto(blob);
  try {
    if(blob.type==='image/jpeg'&&blob.size<=maxBytes&&Math.max(image.naturalWidth,image.naturalHeight)<=maxEdge)return blob;
    const scale=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    let result;
    for(let q=quality;q>=.48;q-=.08){result=await new Promise(r=>canvas.toBlob(r,'image/jpeg',q));if(!result)throw new Error('This photograph could not be prepared.');if(result.size<=maxBytes)break;}
    return result;
  } finally {release();}
}
export const thumbnailPhoto=blob=>scaledPhoto(blob,{maxEdge:224,maxBytes:80000,quality:.78});
export function restoredCrop(crop,width,height,frame) {
  if(!crop||!crop.size||!crop.width||!crop.height)return {zoom:1,x:0,y:0};
  // Coordinates survive a downscaled original by normalizing to its dimensions.
  const size=crop.size*width/crop.width,sx=crop.sx*width/crop.width,sy=crop.sy*height/crop.height;
  const zoom=Math.max(1,Math.min(4,Math.min(width,height)/size));
  const scale=Math.max(frame/width,frame/height)*zoom;
  return {zoom,x:((width-size)/2-sx)*scale,y:((height-size)/2-sy)*scale};
}

import {paintPixels} from './artistic-filter.js';
self.onmessage=async({data:{id,blob,strength}})=>{
  let image;
  try{
    image=await createImageBitmap(blob);
    const scale=Math.min(1,896/Math.max(image.width,image.height)),width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));
    const canvas=new OffscreenCanvas(width,height),context=canvas.getContext('2d',{willReadFrequently:true});
    context.drawImage(image,0,0,width,height);const input=context.getImageData(0,0,width,height);
    input.data.set(paintPixels(input.data,width,height,strength));context.putImageData(input,0,0);
    const result=await canvas.convertToBlob({type:'image/jpeg',quality:.9});self.postMessage({id,blob:result});
  }catch(error){self.postMessage({id,error:error.message});}finally{image?.close();}
};

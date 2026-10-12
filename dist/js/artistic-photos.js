import {ARTISTIC_VERSION,artisticStrength,paintSteps} from './artistic-filter.js';
import {decodePhoto} from './image-utils.js';
export function artisticPreference(value={}){return {enabled:value?.enabled===true,strength:artisticStrength(value?.strength??55)};}
export function artisticKey(preference){const p=artisticPreference(preference);return p.enabled&&p.strength>0?`${ARTISTIC_VERSION}-${p.strength}`:'original';}
export function createPhotoPainter(){
  let worker,failed=false,serial=0,tail=Promise.resolve(),pending;
  async function fallback(blob,strength){
    const {image,release}=await decodePhoto(blob);
    try{
      const scale=Math.min(1,640/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);const input=ctx.getImageData(0,0,canvas.width,canvas.height),steps=paintSteps(input.data,canvas.width,canvas.height,strength);let next;
      do{next=steps.next();if(!next.done)await new Promise(resolve=>setTimeout(resolve,0));}while(!next.done);
      input.data.set(next.value);ctx.putImageData(input,0,0);return await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('The artistic preview could not be prepared.')),'image/jpeg',.9));
    }finally{release();}
  }
  return {
    process(blob,strength){
      const task=tail.catch(()=>{}).then(async()=>{
        if(failed||typeof Worker==='undefined')return fallback(blob,strength);
        try{
          if(!worker){worker=new Worker(new URL('./artistic-worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{if(data.id!==pending?.id)return;const current=pending;pending=null;clearTimeout(current.timeout);data.error?current.reject(new Error(data.error)):current.resolve(data.blob);};worker.onerror=()=>{failed=true;worker?.terminate();worker=null;if(pending){clearTimeout(pending.timeout);pending.reject(new Error('Photo painting is unavailable.'));pending=null;}};}
          return await new Promise((resolve,reject)=>{const id=++serial,timeout=setTimeout(()=>{failed=true;worker?.terminate();worker=null;pending=null;reject(new Error('Photo painting took too long.'));},20000);pending={id,resolve,reject,timeout};worker.postMessage({id,blob,strength});});
        }catch{failed=true;worker?.terminate();worker=null;return fallback(blob,strength);}
      });tail=task;return task;
    },
  };
}
export function createArtisticPhotos({getOwner,getPreference,getRecord,saveRecord,loadSquare,makeThumbnail,paint,onError=()=>{}}){
  const pending=new Map();
  return {
    async get(photo,kind='square'){
      const uid=getOwner(),preference=artisticPreference(getPreference()),key=artisticKey(preference),recordKey=uid+':'+photo.localId;
      if(!uid)return null;
      if(key==='original')return loadSquare(photo,kind);
      const taskKey=recordKey+':'+key;
      if(!pending.has(taskKey)){
        const task=(async()=>{
          const record=await getRecord(recordKey);if(record?.artistic?.key===key)return record.artistic;
          const square=await loadSquare(photo,'square');if(!square||getOwner()!==uid)return null;
          let blob;
          try{blob=await paint(square,preference.strength);}catch(error){onError(error);return {blob:square,thumbnail:await makeThumbnail(square)};}
          if(getOwner()!==uid)return null;
          const thumbnail=await makeThumbnail(blob),artistic={key,blob,thumbnail};
          // A setting change or logout must not save a stale presentation.
          if(getOwner()===uid&&artisticKey(getPreference())===key){const latest=await getRecord(recordKey);if(getOwner()===uid)try{await saveRecord({...latest,key:recordKey,artistic});}catch{/* Cached artwork is expendable; original photos stay durable. */}}
          return artistic;
        })();pending.set(taskKey,task);task.finally(()=>{if(pending.get(taskKey)===task)pending.delete(taskKey);}).catch(()=>{});
      }
      const result=await pending.get(taskKey);return getOwner()===uid?(kind==='thumbnail'?result?.thumbnail:result?.blob):null;
    },
  };
}

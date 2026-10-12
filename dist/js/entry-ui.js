import {reveal} from './motion-ui.js';
export function createPhotoRenderer(image,load,onError,getPresentationKey=()=> '') {
  let identity=null,generation=0;
  return {
    render(photo,date){const key=photo?date+':'+photo.localId+':'+getPresentationKey():null;if(key===identity)return;identity=key;const serial=++generation;image.removeAttribute('src');image.parentElement.classList.toggle('photo-loading',Boolean(photo));
      if(!photo)return;
      load(photo).then(async url=>{if(!url||serial!==generation)return;image.src=url;try{await image.decode?.();}catch{}if(serial!==generation)return;image.parentElement.classList.remove('photo-loading');reveal(image);}).catch(error=>{if(serial===generation){image.parentElement.classList.remove('photo-loading');identity=null;onError(error);}});
    },
    reset(){generation++;identity=null;image.removeAttribute('src');image.parentElement.classList.remove('photo-loading');},
  };
}

import {animatePhoto,containedRect,reveal} from './motion-ui.js';
export function applyPhotoPresence(document, hasPhoto) {
  document.getElementById('photo-empty').hidden = hasPhoto;
  document.getElementById('photo-preview').hidden = !hasPhoto;
  document.getElementById('photo-input-actions').hidden = hasPhoto;
}
export function bindPhotoLightbox(document, {onOpen,onReframe,onRemove,onError,isAuthenticated}) {
  const dialog=document.getElementById('photo-lightbox');
  const image=document.getElementById('lightbox-photo');
  let context=null;const preview=document.getElementById('photo-preview'),actions=dialog.querySelector('.lightbox-actions');
  dialog._beforeClose=async()=>{const origin=context?.origin||preview;if(origin.isConnected&&!origin.hidden)await animatePhoto(image,origin.getBoundingClientRect(),containedRect(image),{closing:true});};
  async function open(photo){if(!photo||!isAuthenticated())return;context=photo;image.style.filter=photo.filter||'none';image.src=photo.url;if(image.decode)await image.decode();if(!isAuthenticated())return;const from=(photo.origin||preview).getBoundingClientRect();actions.hidden=Boolean(photo.readOnly);dialog.dataset.readOnly=String(Boolean(photo.readOnly));dialog.showModal();reveal(actions);animatePhoto(image,from,containedRect(image)).catch(onError);}
  preview.onclick=async()=>{try{await open(await onOpen());}catch(error){onError(error);}};
  document.getElementById('close-photo').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{context=null;actions.hidden=false;delete dialog.dataset.readOnly;image.removeAttribute('src');});
  document.getElementById('recrop').onclick=async()=>{
    const photo=context;if(!photo||photo.readOnly)return;await dialog.close();
    try{await onReframe(photo);}catch(error){onError(error);}
  };
  document.getElementById('remove-photo').onclick=async()=>{
    const photo=context;if(!photo||photo.readOnly)return;
    try{if(await onRemove(photo)!==false)dialog.close();}catch(error){onError(error);}
  };
  return {open};
}

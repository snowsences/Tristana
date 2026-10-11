export function applyPhotoPresence(document, hasPhoto) {
  document.getElementById('photo-empty').hidden = hasPhoto;
  document.getElementById('photo-preview').hidden = !hasPhoto;
  document.getElementById('photo-input-actions').hidden = hasPhoto;
}
export function bindPhotoLightbox(document, {onOpen,onReframe,onRemove,onError,isAuthenticated}) {
  const dialog=document.getElementById('photo-lightbox');
  const image=document.getElementById('lightbox-photo');
  let context=null;
  document.getElementById('photo-preview').onclick=async()=>{
    try{const photo=await onOpen();if(!photo||!isAuthenticated())return;context=photo;image.src=photo.url;dialog.showModal();}catch(error){onError(error);}
  };
  document.getElementById('close-photo').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{context=null;image.removeAttribute('src');});
  document.getElementById('recrop').onclick=async()=>{
    const photo=context;if(!photo)return;dialog.close();
    try{await onReframe(photo);}catch(error){onError(error);}
  };
  document.getElementById('remove-photo').onclick=async()=>{
    const photo=context;if(!photo)return;
    try{if(await onRemove(photo)!==false)dialog.close();}catch(error){onError(error);}
  };
}

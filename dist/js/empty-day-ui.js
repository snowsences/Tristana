// The same editor moves into the modal; there is only one set of draft fields.
export function createEmptyDayEditor(document,{canOpen,renderEntry,commit,waitForSave,resize,onOpen,onClose,onError,displayDate}) {
  const dialog=document.getElementById('empty-day-dialog'),panel=document.getElementById('entry-panel');
  const body=dialog.querySelector('.empty-day-body'),title=document.getElementById('empty-day-title');
  const home=document.createComment('daily editor');panel.before(home);
  let date=null,scroll=0;
  dialog._beforeClose=async()=>{commit();await waitForSave().catch(onError);};
  document.getElementById('close-empty-day').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{const rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))dialog.close();});
  dialog.addEventListener('close',()=>{
    if(!date)return;commit();const previous=date;date=null;
    home.after(panel);panel.hidden=true;title.textContent='';delete dialog.dataset.date;
    delete document.documentElement.dataset.memoryEditing;
    onClose(previous);document.defaultView.scrollTo({top:scroll,behavior:'auto'});
  });
  return {
    get date(){return date;},
    open(target){
      if(date||!canOpen(target))return false;
      commit();date=target;scroll=document.defaultView.scrollY;onOpen(target);
      title.textContent=displayDate(target,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
      dialog.dataset.date=target;body.append(panel);panel.hidden=false;renderEntry(target);
      document.documentElement.dataset.memoryEditing='true';dialog.showModal();
      document.defaultView.requestAnimationFrame(resize);return true;
    },
  };
}

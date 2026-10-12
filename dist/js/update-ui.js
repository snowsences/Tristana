export function createUpdatePrompt({document,serviceWorker,saveDrafts,reload,onError}) {
  const banner=document.getElementById('update-banner'),button=document.getElementById('apply-update');
  let registration,waiting,requested=false,busy=false,checking=false,hadController=Boolean(serviceWorker.controller),timeout;
  function show(worker){waiting=worker||waiting;banner.hidden=false;document.body.dataset.updateReady='true';}
  function inspect(){if(registration?.waiting&&(registration.active||serviceWorker.controller))show(registration.waiting);}
  function watchInstalling(){const worker=registration?.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&(registration.active||serviceWorker.controller))show(registration.waiting||worker);});}
  const controllerChanged=()=>{
    if(requested){requested=false;clearTimeout(timeout);reload();}
    else if(hadController)show();
    hadController=true;
  };
  serviceWorker.addEventListener('controllerchange',controllerChanged);
  button.onclick=async()=>{
    if(busy)return;busy=true;button.disabled=true;button.textContent='Updating…';
    try{
      await saveDrafts(); // IndexedDB must commit before we activate or reload.
      requested=true;const worker=registration?.waiting||waiting;
      if(worker&&worker.state!=='activated'&&worker.state!=='redundant'){
        worker.postMessage({type:'ACTIVATE_UPDATE'});
        timeout=setTimeout(()=>{requested=false;busy=false;button.disabled=false;button.textContent='Update';onError(new Error('The update is still preparing. Please try again.'));},12000);
      }else reload();
    }catch(error){requested=false;busy=false;button.disabled=false;button.textContent='Update';onError(error);}
  };
  return {
    watch(value){registration=value;inspect();watchInstalling();registration.addEventListener('updatefound',watchInstalling);},
    async check(){if(!registration||checking)return;checking=true;try{await registration.update();inspect();}catch{/* Retry on return/connection; no interruption while offline. */}finally{checking=false;}},
    dispose(){clearTimeout(timeout);serviceWorker.removeEventListener('controllerchange',controllerChanged);registration?.removeEventListener('updatefound',watchInstalling);},
  };
}

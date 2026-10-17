export const APP_VERSION='102';

export function createUpdatePrompt({document,serviceWorker,saveDrafts,reload,onError,fetchVersion}) {
  const banner=document.getElementById('update-banner'),button=document.getElementById('apply-update');
  const win=document.defaultView,workers=new Map();
  let registration,waiting,requested=false,busy=false,checking=false,disposed=false,hadController=Boolean(serviceWorker.controller),timeout;
  async function bounded(task){let timer;try{return await Promise.race([task,new Promise(resolve=>{timer=setTimeout(resolve,8000);})]);}finally{clearTimeout(timer);}}
  fetchVersion=fetchVersion||(async()=>{
    if(!win?.fetch)return;
    const controller=new win.AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{const response=await win.fetch(new URL('./version.json',win.location.href),{cache:'no-store',signal:controller.signal});if(response.ok)return (await response.json()).version;}
    finally{clearTimeout(timer);}
  });
  function show(worker){if(disposed)return;waiting=worker||waiting;banner.hidden=false;document.body.dataset.updateReady='true';}
  function inspect(){if(registration?.waiting&&(registration.active||serviceWorker.controller))show(registration.waiting);}
  function watchInstalling(){
    const worker=registration?.installing;if(!worker)return;
    const changed=()=>{if(worker.state==='installed'&&(registration.active||serviceWorker.controller))show(registration.waiting||worker);};
    if(!workers.has(worker)){workers.set(worker,changed);worker.addEventListener('statechange',changed);}
    changed(); // iOS can resume after the installed event has already fired.
  }
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
        timeout=setTimeout(()=>{requested=false;busy=false;button.disabled=false;button.textContent='Update';onError(new Error('The update is still preparing. Please try again.'));},12000);
        worker.postMessage({type:'ACTIVATE_UPDATE'});
      }else reload();
    }catch(error){clearTimeout(timeout);requested=false;busy=false;button.disabled=false;button.textContent='Update';onError(error);}
  };
  async function check(){
    inspect();watchInstalling();if(checking||disposed)return;checking=true;
    try{await Promise.allSettled([
      bounded((async()=>{const version=Number(await fetchVersion());if(Number.isSafeInteger(version)&&version>Number(APP_VERSION))show();})()),
      bounded((async()=>{if(!registration&&serviceWorker.getRegistration)watch(await serviceWorker.getRegistration());if(registration){await registration.update();inspect();watchInstalling();}})()),
    ]);}finally{checking=false;}
  }
  function watch(value){if(!value||disposed)return;if(registration!==value){registration?.removeEventListener('updatefound',watchInstalling);registration=value;registration.addEventListener('updatefound',watchInstalling);}inspect();watchInstalling();}
  const resume=()=>{if(document.visibilityState==='visible')check();};
  document.addEventListener('visibilitychange',resume);
  for(const event of ['pageshow','focus','online'])win?.addEventListener(event,resume);
  return {
    watch,check,
    dispose(){disposed=true;clearTimeout(timeout);serviceWorker.removeEventListener('controllerchange',controllerChanged);registration?.removeEventListener('updatefound',watchInstalling);for(const [worker,listener] of workers)worker.removeEventListener('statechange',listener);document.removeEventListener('visibilitychange',resume);for(const event of ['pageshow','focus','online'])win?.removeEventListener(event,resume);},
  };
}

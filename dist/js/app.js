import {CONFIG} from './config.js';
import {FIELDS,LIMIT,count,limit,dayInZone,shiftDay,daysInYear,validDay,filled,status,blankEntry,mergeEntry,same} from './core.js';
import {resolveHeader} from './themes.js';
import * as store from './storage.js';
import * as cloud from './cloud.js';
import {createCropper} from './crop.js';
import {applyAuthGate} from './auth-ui.js';
import {applyPhotoPresence,bindPhotoLightbox} from './photo-ui.js';
const $=s=>document.querySelector(s);
const manifest=await fetch('./theme-manifest.json').then(r=>r.json());
const deviceId=localStorage.getItem('tristana-device')||crypto.randomUUID();localStorage.setItem('tristana-device',deviceId);
let user=null,entries=new Map(),settings={},tab='today',yearView=false,selectedYear=new Date().getFullYear(),selectedDate,unsubscribers=[],syncing=false,localWrites=Promise.resolve(),photoURLs=new Map(),photoPromises=new Map(),installEvent,backend=null;
let zone=Intl.DateTimeFormat().resolvedOptions().timeZone;selectedDate=dayInZone(zone);
const today=()=>dayInZone(zone);
const entry=(date=selectedDate)=>entries.get(date)||blankEntry(date);
const displayDate=(date,options)=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',...options}).format(new Date(date+'T12:00:00Z'));
const toast=message=>{const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,6500);};
const error=err=>toast(readableError(err));
function readableError(err){const code=err.code||'';if(code.includes('unauthorized-domain'))return 'Add snowsences.github.io to Firebase Authentication’s authorized domains.';if(code.includes('operation-not-allowed'))return 'Enable the Google sign-in provider in Firebase Authentication.';if(code.includes('permission-denied'))return 'Firebase access was denied. Publish the supplied Firestore rules.';if(code.includes('popup-blocked'))return 'Allow the Google sign-in popup, then try again.';if(code.includes('popup-closed'))return 'Sign-in closed. Your journal is still here.';return err.message||'Something went wrong. Please try again.';}
function savedLabel(message){$('#save-status').textContent=message;}
function snapshot(value){return structuredClone(value);}
function persist(e){const copy=snapshot(e);copy.key=user.uid+':'+e.date;localWrites=localWrites.catch(()=>{}).then(()=>store.put('entries',copy));return localWrites;}
async function change(field,value,date=selectedDate){
  if(!user)return;
  dayTouched=true;
  const current=entry(date);const e={...current,_base:{...current._base},_dirty:[...new Set([...current._dirty,field])],updatedAt:Date.now(),updatedBy:deviceId,[field]:value};
  entries.set(date,e);savedLabel('Saving on this device…');
  try{await persist(e);savedLabel(navigator.onLine?'Saved on device · syncing':'Saved on device · offline');refreshProgress();closeNotifications(date);queueSync();}catch(err){savedLabel('Could not save · export a copy');error(err);}
}
function applyTheme(){
  const override=localStorage.getItem('tristana-theme');const selection=resolveHeader(manifest,{date:selectedDate,themeMonth:override?Number(override):undefined});
  const {theme,scene}=selection;for(const [key,value] of Object.entries({bg:theme.colors.background,ink:theme.colors.ink,accent:theme.colors.accent}))document.documentElement.style.setProperty('--'+key,value);
  document.body.dataset.theme=theme.id;document.documentElement.style.setProperty('--tide-motif',scene.motifSrc?`url("./${scene.motifSrc}")`:'none');
  const art=$('#header-art');art.src=scene.src;art.srcset=`${scene.smallSrc} 600w, ${scene.src} 1200w`;art.sizes='(max-width:680px) 100vw, 680px';
  $('#theme-select').value=override||'';
  $('meta[name=theme-color]').content=theme.colors.background;
}
function header(){
  applyTheme();$('#eyebrow').hidden=tab==='settings';$('#header-line').hidden=tab==='settings';$('#eyebrow').textContent=tab==='settings'?'':displayDate(selectedDate,{weekday:'long',month:'long',day:'numeric'});
  $('#page-title').innerHTML=tab==='past'?'Past<br>days.':tab==='settings'?'Make it yours.':'A little<br>of today.';
  $('#date-label').textContent=displayDate(selectedDate,{month:'long',year:'numeric'});
  $('#entry-date').textContent=selectedDate===today()?'Today':displayDate(selectedDate,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  $('#next-day').disabled=selectedDate>=today();
}
async function photoURL(photo,kind='square'){
  if(!photo)return null;const key=user?.uid+':'+photo.localId+':'+kind;
  if(photoURLs.has(key))return photoURLs.get(key);
  if(photoPromises.has(key))return photoPromises.get(key);
  const task=(async()=>{
    let local=await store.get('photos',user.uid+':'+photo.localId);let blob=local?.[kind];
    if(!blob&&photo[kind]){blob=await cloud.media(photo[kind]);local={...local,key:user.uid+':'+photo.localId,[kind]:blob};await store.put('photos',local);}
    if(!blob)return null;const url=URL.createObjectURL(blob);photoURLs.set(key,url);return url;
  })();photoPromises.set(key,task);try{return await task;}finally{photoPromises.delete(key);}
}
function renderStrip(){
  const strip=$('#day-strip');const dates=Array.from({length:15},(_,i)=>shiftDay(selectedDate,i-7));strip.replaceChildren();
  for(const date of dates){const e=entry(date);const button=document.createElement('button');button.className='day-tile';button.dataset.date=date;button.setAttribute('aria-pressed',String(date===selectedDate));button.setAttribute('aria-label',displayDate(date,{weekday:'long',month:'long',day:'numeric'})+', '+status(e,date,today()));
    const image=document.createElement('span');image.className='tile-image '+status(e,date,today());image.textContent=displayDate(date,{day:'numeric'});
    if(e.photo){const img=document.createElement('img');img.alt='';image.append(img);photoURL(e.photo).then(url=>{if(url&&img.isConnected)img.src=url;}).catch(()=>{});}
    if(filled(e)){const dot=document.createElement('span');dot.className='day-state';image.append(dot);}
    const label=document.createElement('span');label.className='tile-date';label.textContent=displayDate(date,{month:'short',day:'numeric'});button.append(image,label);button.disabled=date>today()&&!entries.has(date);button.onclick=()=>openDay(date);strip.append(button);
  }
  const tile=strip.querySelector('[aria-pressed=true]');if(tile)strip.scrollLeft=tile.offsetLeft-strip.clientWidth/2+tile.clientWidth/2;
}
function refreshProgress(){
  const e=entry();
  const tile=$('#day-strip').querySelector(`[data-date="${selectedDate}"]`);if(tile){tile.setAttribute('aria-label',selectedDate+', '+status(e,selectedDate,today()));tile.querySelector('.tile-image').className='tile-image '+status(e,selectedDate,today());}
  if(yearView)renderYear();
}
function renderEntry(){
  const e=entry();for(const field of ['good','learned']){if(document.activeElement!==$('#'+field))$('#'+field).value=e[field]||'';}
  applyPhotoPresence(document,Boolean(e.photo));$('#photo-note').textContent=e.photo?.pending?'Photo saved on device · waiting for cloud backup':'';
  if(e.photo){const identity=e.photo.localId;$('#entry-photo').removeAttribute('src');photoURL(e.photo).then(url=>{if(entry().photo?.localId===identity&&url)$('#entry-photo').src=url;}).catch(()=>{$('#photo-note').textContent='Photo backup needs a connection. Your entry is saved.';});}
  savedLabel(e._dirty.length?'Saved on device · waiting to sync':e.revision?'Saved & synced':'');refreshProgress();
}
function render(){applyAuthGate(document,Boolean(user));if(!user)return;header();renderStrip();renderEntry();$('#journal-view').hidden=tab==='settings';$('#settings-view').hidden=tab!=='settings';$('#past-tools').hidden=tab!=='past';$('#year-panel').hidden=!yearView;$('#entry-panel').hidden=tab==='past'&&yearView;$('#day-strip').hidden=tab==='past'&&yearView;for(const button of document.querySelectorAll('[data-tab]')){if(button.dataset.tab===tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}if(yearView&&tab==='past')renderYear();}
async function openDay(date){if(!validDay(date)||(date>today()&&!entries.has(date)))return;await localWrites.catch(()=>{});selectedDate=date;dayTouched=true;selectedYear=Number(date.slice(0,4));yearView=false;$('#photos-view').setAttribute('aria-pressed','true');$('#year-view').setAttribute('aria-pressed','false');render();}
function renderYear(){
  $('#year-title').textContent=selectedYear;const grid=$('#year-grid');grid.replaceChildren();const dates=daysInYear(selectedYear);
  for(let month=1;month<=12;month++){const block=document.createElement('section');block.className='month-block';const h=document.createElement('h3');h.textContent=displayDate(`${selectedYear}-${String(month).padStart(2,'0')}-01`,{month:'short'});const week=document.createElement('div');week.className='month-weekdays';for(const d of ['M','T','W','T','F','S','S']){const s=document.createElement('span');s.textContent=d;week.append(s);}const days=document.createElement('div');days.className='month-days';const monthDates=dates.filter(d=>Number(d.slice(5,7))===month);const start=(new Date(monthDates[0]+'T12:00:00Z').getUTCDay()+6)%7;for(let i=0;i<start;i++)days.append(document.createElement('span'));
    for(const date of monthDates){const b=document.createElement('button');b.className=status(entry(date),date,today())+(date===selectedDate?' selected':'');b.textContent=Number(date.slice(-2));b.setAttribute('aria-label',date+', '+status(entry(date),date,today()));b.title=b.getAttribute('aria-label');b.disabled=date>today()&&!entries.has(date);b.onclick=()=>{openDay(date);$('#entry-panel').scrollIntoView({block:'start'});};days.append(b);}block.append(h,week,days);grid.append(block);
  }
}
let syncTimer;
let dayTouched=false,firstSettings=true;
function queueSync(){clearTimeout(syncTimer);syncTimer=setTimeout(runSync,600);}
async function runSync(){
  if(!user||!navigator.onLine||syncing)return;syncing=true;const uid=user.uid;
  try{
    await localWrites;
    for(const [date,current] of entries){if(!current._dirty.length)continue;
      const e=snapshot(current);
      let photoError;
      if(e.photo?.pending){try {const local=await store.get('photos',uid+':'+e.photo.localId);if(!local?.square||!local?.source)throw new Error('The local photograph could not be found.');
        const source=e.photo.source||await cloud.upload(local.source,date,'original',e.photo.localId);
        // Persist the original receipt immediately, so interruption does not duplicate it.
        if(entry(date).photo?.localId===e.photo.localId){const partial={...entry(date),photo:{...e.photo,source}};entries.set(date,partial);await persist(partial);}
        const square=e.photo.square||await cloud.upload(local.square,date,'square',e.photo.localId);
        e.photo={...e.photo,source,square,pending:false};
        if(entry(date).photo?.localId===e.photo.localId){const updated={...entry(date),photo:e.photo};entries.set(date,updated);await persist(updated);}else continue;
      } catch(err) {photoError=err;e._dirty=e._dirty.filter(f=>f!=='photo');} }
      if(!e._dirty.length) { $('#connection-status').textContent=readableError(photoError); continue; }
      const {data}=await cloud.sync(uid,e);
      if(user?.uid!==uid)return;
      const latest=entry(date);const clean={...latest,_base:{...latest._base},_dirty:[...latest._dirty],revision:data.revision};
      for(const field of e._dirty){clean._base[field]=data[field];if(same(latest[field],e[field]))clean._dirty=clean._dirty.filter(f=>f!==field);}
      entries.set(date,clean);await persist(clean);
    }
    $('#connection-status').textContent=[...entries.values()].some(e=>e.photo?.pending)?'Text entries synced. Photo backups are waiting for the Worker.':'Firebase connected. Your entries are synced.';if(entry()._dirty.length===0)savedLabel('Saved & synced');renderEntry();renderStrip();
  }catch(err){savedLabel('Saved on device · backup pending');$('#connection-status').textContent=readableError(err);if(entry().photo?.pending)$('#photo-note').textContent='Saved on device. Photo backup is waiting for the Worker setup.';}
  finally{syncing=false;if(user&&[...entries.values()].some(e=>e._dirty.length)&&navigator.onLine){clearTimeout(syncTimer);syncTimer=setTimeout(runSync,15000);}}
}
async function checkBackend(){try{backend=await cloud.backendStatus();$('#connection-status').textContent=backend.photos?'Firebase and photo backend connected.':'Firebase connected. Configure Cloudinary secrets in the Worker.';$('#reminder-status').textContent=backend.reminders?(settings.reminderDeviceId===deviceId?'Enabled on this phone at '+(settings.reminderTime||'21:00')+'.':'Ready to enable on this phone.'):'Reminder backend needs its VAPID and Firebase service-account secrets.';}catch(err){backend=null;$('#connection-status').textContent='Firebase connected; the Worker still needs deployment.';$('#reminder-status').textContent='Phone reminders need the Worker setup first.';}}
async function onUser(account,message){
  for(const stop of unsubscribers)stop();unsubscribers=[];user=account;entries=new Map();settings={};dayTouched=false;firstSettings=true;for(const url of photoURLs.values())URL.revokeObjectURL(url);photoURLs.clear();
  for(const id of ['good','learned','camera-button','library-button','export','import','enable-reminders'])$('#'+id).disabled=!user;
  $('#signout').hidden=!user;$('#account-label').textContent=user?user.email:'';
  if(!user){tab='today';yearView=false;applyAuthGate(document,false);for(const field of ['good','learned'])$('#'+field).value='';$('#entry-photo').removeAttribute('src');for(const id of ['day-strip','year-grid'])$('#'+id).replaceChildren();$('#toast').hidden=true;clearTimeout(toast.timer);window.scrollTo({top:0,behavior:'auto'});}
  if(message)toast(message);
  if(user){const cached=await store.entriesFor(user.uid);entries=new Map(cached.map(e=>[e.date,e]));settings=(await store.get('settings',user.uid))?.value||{};applySettings();selectedDate=today();await store.persistStorage();
    unsubscribers=cloud.listen(user.uid,async remote=>{for(const r of remote){const merged=mergeEntry(entry(r.date),r);entries.set(r.date,merged);await persist(merged);}renderEntry();renderStrip();if(yearView)renderYear();},async incoming=>{settings={...settings,...incoming};await store.put('settings',{key:user.uid,value:settings});applySettings();if(firstSettings&&!dayTouched&&tab==='today'){selectedDate=today();render();}firstSettings=false;},err=>{$('#connection-status').textContent=readableError(err);savedLabel('Saved on device · cloud unavailable');});
    checkBackend();queueSync();
  }
  render();
}
function applySettings(){zone=settings.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;$('#timezone-label').textContent='Journal timezone: '+zone.replaceAll('_',' ');$('#phone-toggle').checked=settings.phoneDeviceId===deviceId;$('#reminder-time').value=settings.reminderTime||'21:00';if(settings.phoneDeviceId===deviceId){const currentZone=Intl.DateTimeFormat().resolvedOptions().timeZone;if(currentZone!==zone){zone=currentZone;cloud.settings(user.uid,{timezone:zone}).catch(error);}}$('#disable-reminders').hidden=settings.reminderDeviceId!==deviceId;header();}
async function closeNotifications(date){if(date!==today()||!filled(entry(date)))return;try{const registration=await navigator.serviceWorker?.getRegistration();for(const n of await registration?.getNotifications()||[])if(n.data?.date===date)n.close();}catch{}}
const cropper=createCropper(async({source,square,date,oldPhoto,crop})=>{
  if(!user)return;const localId=crypto.randomUUID();await store.put('photos',{key:user.uid+':'+localId,source,square});
  await change('photo',{localId,crop,pending:true,source:null,square:null},date);if(selectedDate===date){renderEntry();renderStrip();}
},error);
for(const field of ['good','learned']){
  const input=$('#'+field);const save=()=>{if(input.isComposing)return;input.value=limit(input.value);change(field,input.value).catch(error);};input.addEventListener('input',e=>{input.isComposing=e.isComposing;save();});input.addEventListener('compositionend',()=>{input.isComposing=false;save();});
}
for(const type of ['camera','library']){$('#'+type+'-button').onclick=()=>$('#'+type+'-input').click();$('#'+type+'-input').onchange=async e=>{const file=e.target.files[0];if(file)try{await cropper.open(file,selectedDate,entry().photo);}catch(err){error(err);}e.target.value='';};}
bindPhotoLightbox(document,{
  isAuthenticated:()=>Boolean(user),
  async onOpen(){
    const date=selectedDate,photo=entry(date).photo;if(!user||!photo)return null;
    const url=await photoURL(photo);if(!user||entry(date).photo?.localId!==photo.localId||!url)return null;
    return {date,photo,url};
  },
  async onReframe({date,photo}){
    if(!user||entry(date).photo?.localId!==photo.localId)return;
    const local=await store.get('photos',user.uid+':'+photo.localId);
    const source=local?.source||await cloud.media(photo.source);
    if(user)await cropper.open(source,date,photo);
  },
  async onRemove({date,photo}){
    if(!user||entry(date).photo?.localId!==photo.localId)return true;
    if(!confirm('Remove this photograph from this day?'))return false;
    await change('photo',null,date);if(selectedDate===date){renderEntry();renderStrip();}return true;
  },
  onError:error
});
$('#signin').onclick=()=>cloud.signIn().catch(error);
$('#signout').onclick=async()=>{await localWrites;await cloud.signOut();};
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{tab=b.dataset.tab;if(tab==='today'){selectedDate=today();yearView=false;}render();window.scrollTo({top:0,behavior:'auto'});};
$('#prev-day').onclick=()=>openDay(shiftDay(selectedDate,-1));$('#next-day').onclick=()=>openDay(shiftDay(selectedDate,1));
$('#date-button').onclick=()=>{$('#selected-date').value=selectedDate;$('#selected-date').max=today();$('#date-dialog').showModal();};$('#date-dialog').addEventListener('close',()=>{if($('#date-dialog').returnValue==='choose')openDay($('#selected-date').value);});
$('#photos-view').onclick=()=>{yearView=false;$('#photos-view').setAttribute('aria-pressed','true');$('#year-view').setAttribute('aria-pressed','false');render();};$('#year-view').onclick=()=>{yearView=true;$('#photos-view').setAttribute('aria-pressed','false');$('#year-view').setAttribute('aria-pressed','true');render();};$('#prev-year').onclick=()=>{selectedYear--;renderYear();};$('#next-year').onclick=()=>{selectedYear++;renderYear();};
for(const theme of manifest.themes){const option=document.createElement('option');option.value=theme.month;option.textContent=displayDate(`2026-${String(theme.month).padStart(2,'0')}-01`,{month:'long'})+' · '+theme.name;$('#theme-select').append(option);}
$('#theme-select').onchange=e=>{localStorage.setItem('tristana-theme',e.target.value);applyTheme();};
$('#phone-toggle').onchange=async e=>{if(!user){e.target.checked=false;return toast('Sign in first.');}const patch={phoneDeviceId:e.target.checked?deviceId:'',timezone:e.target.checked?Intl.DateTimeFormat().resolvedOptions().timeZone:zone};try{await cloud.settings(user.uid,patch);settings={...settings,...patch};applySettings();}catch(err){error(err);}};
$('#reminder-time').onchange=async e=>{if(user)try{await cloud.settings(user.uid,{reminderTime:e.target.value});if(settings.reminderDeviceId===deviceId)await cloud.api('/reminders/time',{method:'POST',body:{time:e.target.value,timezone:zone}});}catch(err){error(err);}};
$('#enable-reminders').onclick=async()=>{
  try{
    if(!navigator.userAgentData?.mobile&&!/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))return toast('Open Tristana on your phone to enable phone-only reminders.');
    if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw new Error('This browser does not support push notifications. Use Chrome on Android.');
    const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Notifications are blocked. Enable them in your browser’s site settings.');
    if(!backend)backend=await cloud.backendStatus();if(!backend.reminders||!backend.vapidPublicKey)throw new Error('Deploy and configure the reminder Worker first.');
    const registration=await navigator.serviceWorker.ready;let subscription=await registration.pushManager.getSubscription();if(!subscription){const padded=backend.vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(padded+'='.repeat((4-padded.length%4)%4)),c=>c.charCodeAt(0));subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});}
    const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;await cloud.api('/reminders',{method:'POST',body:{subscription:subscription.toJSON(),deviceId,time:$('#reminder-time').value,timezone}});await cloud.settings(user.uid,{phoneDeviceId:deviceId,reminderDeviceId:deviceId,timezone});settings={...settings,phoneDeviceId:deviceId,reminderDeviceId:deviceId,timezone};applySettings();$('#reminder-status').textContent='Enabled on this phone. Nothing saved today? A nudge at '+$('#reminder-time').value+'.';toast('Phone reminders enabled.');
  }catch(err){error(err);}
};
$('#disable-reminders').onclick=async()=>{try{await cloud.api('/reminders',{method:'DELETE',body:{deviceId}});const reg=await navigator.serviceWorker.ready;await(await reg.pushManager.getSubscription())?.unsubscribe();await cloud.settings(user.uid,{reminderDeviceId:''});$('#reminder-status').textContent='Reminders are off.';$('#disable-reminders').hidden=true;}catch(err){error(err);}};
const blobToData=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
$('#export').onclick=async()=>{try{await localWrites;const exportEntries=[...entries.values()].map(e=>({date:e.date,good:e.good,learned:e.learned,photo:e.photo}));const photos=[];for(const p of (await store.all('photos')).filter(x=>x.key.startsWith(user.uid+':'))){photos.push({localId:p.key.slice(user.uid.length+1),source:p.source?await blobToData(p.source):null,square:p.square?await blobToData(p.square):null});}const json={format:'tristana-backup',version:1,exportedAt:new Date().toISOString(),entries:exportEntries,photos};const url=URL.createObjectURL(new Blob([JSON.stringify(json)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='tristana-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#backup-status').textContent='Exported '+exportEntries.length+' entries and '+photos.length+' local photographs. Photos not cached on this device remain Cloudinary references.';}catch(err){error(err);}};
$('#import').onclick=()=>$('#import-input').click();$('#import-input').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>250*1024*1024)throw new Error('This backup is too large to import on this device.');const backup=JSON.parse(await file.text());if(backup.format!=='tristana-backup'||backup.version!==1||!Array.isArray(backup.entries)||!Array.isArray(backup.photos))throw new Error('This is not a Tristana backup.');for(const r of backup.entries)if(!validDay(r.date)||count(r.good)>LIMIT||count(r.learned)>LIMIT||typeof r.good!=='string'||typeof r.learned!=='string')throw new Error('A backup entry is invalid.');if(!confirm('Import '+backup.entries.length+' entries? Matching days will be replaced.'))return;for(const p of backup.photos){if(typeof p.localId!=='string'||!/^[-a-zA-Z0-9]+$/.test(p.localId))throw new Error('Invalid photo identifier.');const value={key:user.uid+':'+p.localId};for(const kind of ['source','square'])if(p[kind]){if(!/^data:image\/(jpeg|png|webp);base64,/.test(p[kind]))throw new Error('Invalid backup photograph.');value[kind]=await fetch(p[kind]).then(r=>r.blob());}await store.put('photos',value);}for(const r of backup.entries){for(const field of FIELDS)await change(field,r[field]??(field==='photo'?null:''),r.date);}render();toast('Backup imported and saved on this device.');}catch(err){error(err);}finally{e.target.value='';}};
$('#retry-sync').onclick=()=>{checkBackend();runSync();};window.addEventListener('online',()=>{queueSync();if(user)checkBackend();});window.addEventListener('pagehide',()=>{if(user)for(const e of entries.values())if(e._dirty.length)persist(e);});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(user){applySettings();queueSync();}header();}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;$('#install').hidden=false;});$('#install').onclick=async()=>{await installEvent?.prompt();installEvent=null;$('#install').hidden=true;};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('Offline installation could not be enabled.'));
render();cloud.initialize(onUser).then(()=>{$('#signin').disabled=false;}).catch(err=>{$('#signin').disabled=false;$('#connection-status').textContent='Connect to the internet for your first sign-in.';error(err);});

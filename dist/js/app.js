import {CONFIG} from './config.js?v=79';
import {FIELDS,LIMIT,count,limit,dayInZone,shiftDay,daysInYear,validDay,filled,status,blankEntry,mergeEntry,same} from './core.js?v=79';
import {resolveHeader} from './themes.js?v=79';
import * as store from './storage.js?v=79';
import * as cloud from './cloud.js?v=79';
import {createCropper} from './crop.js?v=79';
import {createUpdatePrompt} from './update-ui.js?v=79';
import {thumbnailPhoto} from './image-utils.js?v=79';
import {createPromptEditor} from './prompt-ui.js?v=79';
import {createMemories} from './memories-ui.js?v=79';
import {createEmptyDayEditor} from './empty-day-ui.js?v=79';
import {createDayStrip} from './strip-ui.js?v=79';
import {createPhotoRenderer} from './entry-ui.js?v=79';
import {installDialogs,reveal,confirmAction,reducedMotion,animatePhoto} from './motion-ui.js?v=79';
import {applyAuthGate} from './auth-ui.js?v=79';
import {applyPhotoPresence,bindPhotoLightbox} from './photo-ui.js?v=79';
import {createDateNavigator} from './date-nav.js?v=79';
import {installKeyboardComfort} from './keyboard-ui.js?v=79';
const $=s=>document.querySelector(s);
const manifest=await fetch('./theme-manifest.json').then(r=>r.json());
const deviceId=localStorage.getItem('tristana-device')||crypto.randomUUID();localStorage.setItem('tristana-device',deviceId);
let user=null,entries=new Map(),settings={},tab='today',yearView=false,selectedYear=new Date().getFullYear(),selectedDate,unsubscribers=[],syncing=false,localWrites=Promise.resolve(),photoURLs=new Map(),photoPromises=new Map(),installEvent,backend=null;
let navigationId=0,artGeneration=0,artIdentity='',selectedMonth=1,memoryDate=null;const tabScroll={today:0,past:0,settings:0};const preloadedArt=new Set();
let zone=Intl.DateTimeFormat().resolvedOptions().timeZone;selectedDate=dayInZone(zone);
const today=()=>dayInZone(zone);
const entry=(date=selectedDate)=>entries.get(date)||blankEntry(date);
const dateFormatters=new Map();
const displayDate=(date,options)=>{const key=JSON.stringify(options);if(!dateFormatters.has(key))dateFormatters.set(key,new Intl.DateTimeFormat('en-US',{timeZone:'UTC',...options}));return dateFormatters.get(key).format(new Date(date+'T12:00:00Z'));};
const toast=message=>{const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,6500);};
const error=err=>toast(readableError(err));
function readableError(err){const code=err.code||'';if(code.includes('unauthorized-domain'))return 'Add snowsences.github.io to Firebase Authentication’s authorized domains.';if(code.includes('operation-not-allowed'))return 'Enable the Google sign-in provider in Firebase Authentication.';if(code.includes('permission-denied'))return 'Firebase access was denied. Publish the supplied Firestore rules.';if(code.includes('popup-blocked'))return 'Allow the Google sign-in popup, then try again.';if(code.includes('popup-closed'))return 'Sign-in closed. Your journal is still here.';return err.message||'Something went wrong. Please try again.';}
function savedLabel(message){if(message)$('#connection-status').textContent=message;}
installDialogs(document);
const prompts=createPromptEditor(document,{onChange:change,onError:error});
const keyboard=installKeyboardComfort(document);
const dayStrip=createDayStrip({element:$('#day-strip'),getEntry:entry,getToday:today,displayDate,getPhotoURL:photoURL,onSelect:openDay,onBrowse:date=>{if(tab==='past'&&!memoryEditor.date){selectMemoryDay(date,{keepScroll:true});memories.scrollTo(date);}},getIsBrowsing:()=>tab==='past'&&!memoryEditor.date});
const photoRenderer=createPhotoRenderer($('#entry-photo'),photoURL,()=>{$('#photo-note').textContent='Photo backup needs a connection. Your entry is saved.';});
const memoryEditor=createEmptyDayEditor(document,{canOpen:date=>Boolean(user)&&tab==='past'&&validDay(date)&&date<=today()&&!filled(entry(date)),renderEntry,
  commit:()=>prompts.commit(),waitForSave:()=>localWrites,resize:()=>prompts.resize(),displayDate,onError:error,
  onOpen:()=>{memories.setActive(false);},
  onClose:date=>{if(user){refreshProgress(date);memories.setActive(tab==='past');}else memories.setActive(false);}});
const memories=createMemories({element:$('#memories-panel'),daySection:$('.day-section'),getEntries:()=>entries,getPhotoURL:photoURL,
  getAccent:date=>resolveHeader(manifest,{date,themeMonth:Number(localStorage.getItem('tristana-theme'))||undefined}).theme.colors.accent,displayDate,
  onDayChange:date=>{if(tab==='past')selectMemoryDay(date);},onPhoto:openMemoryPhoto,onCreate:date=>memoryEditor.open(date),canCreate:date=>date<=today()});
function selectMemoryDay(date,{keepScroll=false}={}){if(!user||memoryEditor.date||tab!=='past'||!validDay(date))return;selectedDate=memoryDate=date;dayTouched=true;selectedYear=Number(date.slice(0,4));header();memories.select(date);renderStrip({keepScroll});}
const dateNavigator=createDateNavigator({document,getEntries:()=>entries,getToday:today,getSelected:()=>selectedDate,getOwner:()=>user?.uid,getPhotoURL:photoURL,displayDate,onError:error,
  onSelect:date=>{if(!user)return;prompts.commit();tabScroll[tab]=window.scrollY;tab='past';selectedDate=memoryDate=date;dayTouched=true;render();window.scrollTo({top:0,behavior:'auto'});selectMemoryDay(date);memories.scrollTo(date);}});
$('#open-time').onclick=()=>{if(user&&!memoryEditor.date)dateNavigator.open();};
async function openMemoryPhoto(date,origin){const uid=user?.uid,photo=entry(date).photo;if(!uid||!photo)return;try{const url=await photoURL(photo,'source');if(user?.uid!==uid||tab!=='past'||entry(date).photo?.localId!==photo.localId||!url)return;await lightbox.open({date,photo,url,origin,readOnly:true});}catch(err){error(err);}}
function snapshot(value){return structuredClone(value);}
function persist(e){const copy=snapshot(e);copy.key=user.uid+':'+e.date;localWrites=localWrites.catch(()=>{}).then(()=>store.put('entries',copy));return localWrites;}
async function change(field,value,date=selectedDate){
  if(!user)return;
  dayTouched=true;
  const current=entry(date);const e={...current,_base:{...current._base},_dirty:[...new Set([...current._dirty,field])],updatedAt:Date.now(),updatedBy:deviceId,[field]:value};
  entries.set(date,e);savedLabel('Saving on this device…');
  try{await persist(e);savedLabel(navigator.onLine?'Saved on device · syncing':'Saved on device · offline');refreshProgress(date);closeNotifications(date);queueSync();}catch(err){savedLabel('Could not save · export a copy');error(err);}
}
function applyTheme(){
  const override=localStorage.getItem('tristana-theme');const {theme,scene}=resolveHeader(manifest,{date:selectedDate,themeMonth:override?Number(override):undefined});
  $('#theme-select').value=override||'';
  const identity=scene.src;if(identity===artIdentity)return;artIdentity=identity;const serial=++artGeneration;
  const art=$('#header-art'),next=new Image();next.srcset=`${scene.smallSrc} 600w, ${scene.src} 1200w`;next.sizes='(max-width:680px) 100vw, 680px';next.src=scene.src;
  const apply=()=>{if(serial!==artGeneration)return;
    for(const [key,value] of Object.entries({bg:scene.background||theme.colors.background,ink:theme.colors.ink,accent:theme.colors.accent}))document.documentElement.style.setProperty('--'+key,value);
    document.documentElement.style.setProperty('--decoration-src',`url("./${theme.decorationSrc}")`);$('#page-decoration').dataset.ready='true';
    document.documentElement.style.setProperty('--prompt-good-art',`url("./${theme.promptArt.good}")`);
    document.documentElement.style.setProperty('--prompt-learned-art',`url("./${theme.promptArt.learned}")`);
    document.body.dataset.theme=theme.id;document.documentElement.style.setProperty('--tide-motif',scene.motifSrc?`url("./${scene.motifSrc}")`:'none');
    const previous=art.src&&art.animate&&!reducedMotion()?art.cloneNode(false):null;art.parentElement.querySelectorAll('.hero-previous').forEach(img=>img.remove());if(previous){previous.removeAttribute('id');previous.classList.add('hero-previous');previous.removeAttribute('fetchpriority');art.parentElement.append(previous);}
    art.srcset=next.srcset;art.sizes=next.sizes;art.src=scene.src;reveal(art,{duration:180});if(previous)previous.animate([{opacity:1},{opacity:0}],{duration:180,easing:'ease-out'}).finished.catch(()=>{}).finally(()=>previous.remove());
    for(const day of [-1,1]){const adjacent=resolveHeader(manifest,{date:shiftDay(selectedDate,day),themeMonth:override?Number(override):undefined}).scene;if(preloadedArt.has(adjacent.src))continue;preloadedArt.add(adjacent.src);const preload=new Image();preload.srcset=`${adjacent.smallSrc} 600w, ${adjacent.src} 1200w`;preload.sizes=next.sizes;preload.src=adjacent.src;}
  };
  next.decode().then(apply).catch(()=>{if(serial===artGeneration){artIdentity='';error(new Error('The illustration could not load. Your entry is still available.'));}});
}
function header(){
  $('#open-time').hidden=tab==='settings'||!user;
  $('#hero').dataset.page=tab;applyTheme();$('#eyebrow').hidden=tab==='settings';$('#header-line').hidden=tab==='settings';$('#eyebrow').textContent=tab==='settings'?'':tab==='past'?'Tristana':displayDate(selectedDate,{weekday:'long',month:'long',day:'numeric'});
  $('#page-title').innerHTML=tab==='past'?'Memories.':tab==='settings'?'Make it yours.':'A little<br>of today.';
  $('#date-label').textContent=displayDate(selectedDate,{month:'long',year:'numeric'});
  $('#next-day').disabled=selectedDate>=today();
}
async function photoURL(photo,kind='square'){
  if(!photo||!user)return null;const uid=user.uid,key=uid+':'+photo.localId+':'+kind;
  if(photoURLs.has(key)){const url=photoURLs.get(key);photoURLs.delete(key);photoURLs.set(key,url);return url;}
  if(photoPromises.has(key))return photoPromises.get(key);
  const task=(async()=>{
    const photoKey=uid+':'+photo.localId;let local=await store.get('photos',photoKey);let blob=local?.[kind];
    if(!blob){const assetKind=kind==='thumbnail'?'square':kind;let sourceBlob=local?.[assetKind];if(!sourceBlob&&kind==='thumbnail'){await photoURL(photo,'square');sourceBlob=(await store.get('photos',photoKey))?.square;}if(!sourceBlob&&photo[assetKind])sourceBlob=await cloud.media(photo[assetKind]);
      if(sourceBlob){blob=kind==='thumbnail'?await thumbnailPhoto(sourceBlob):sourceBlob;const latest=await store.get('photos',photoKey);await store.put('photos',{...latest,key:photoKey,[assetKind]:sourceBlob,[kind]:blob});}}
    if(!blob||user?.uid!==uid)return null;const url=URL.createObjectURL(blob);photoURLs.set(key,url);
    if(photoURLs.size>96){for(const [oldKey,oldURL] of photoURLs){if(![...document.querySelectorAll('img')].some(img=>img.src===oldURL)){URL.revokeObjectURL(oldURL);photoURLs.delete(oldKey);break;}}}
    return url;
  })();photoPromises.set(key,task);try{return await task;}finally{if(photoPromises.get(key)===task)photoPromises.delete(key);}
}
function renderStrip(options){if(tab==='past')dayStrip.render(selectedDate,options);}
function refreshProgress(date=selectedDate){dayStrip.update([date]);memories.update([date]);dateNavigator.refresh();}
function renderEntry(date=memoryEditor.date||selectedDate){
  const e=entry(date);prompts.setEntry(e);applyPhotoPresence(document,Boolean(e.photo));$('#photo-note').textContent=e.photo?.pending?'Photo saved on device · waiting for cloud backup':'';
  photoRenderer.render(e.photo,date);savedLabel(e._dirty.length?'Saved on device · waiting to sync':e.revision?'Saved & synced':'');
}
function render({dayMotion=false,recenterDay=false}={}){applyAuthGate(document,Boolean(user));if(!user)return;header();$('#date-bar').hidden=true;$('.day-section').classList.toggle('today-days',tab==='today');$('.day-section').hidden=tab!=='past';
  $('#journal-view').hidden=tab==='settings';$('#journal-view').dataset.view=tab==='past'?'memories':'today';$('#settings-view').hidden=tab!=='settings';$('#past-tools').hidden=true;$('#year-panel').hidden=true;$('#entry-panel').hidden=tab!=='today'&&!memoryEditor.date;$('#memories-panel').hidden=tab!=='past';$('#day-strip').hidden=tab!=='past';
  renderStrip({animate:dayMotion,recenter:recenterDay});if(tab==='today'||memoryEditor.date)renderEntry();if(tab==='past'){memories.render();memories.ensure(selectedDate);memories.select(selectedDate);}memories.setActive(tab==='past'&&!memoryEditor.date);
  for(const button of document.querySelectorAll('[data-tab]')){if(button.dataset.tab===tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
}
async function openDay(date){
  if(memoryEditor.date)return;
  if(!validDay(date)||(date>today()&&!entries.has(date))||(tab==='today'&&date!==today()))return;
  if(tab==='past'){selectMemoryDay(date);memories.scrollTo(date);return;}
  const request=++navigationId;prompts.commit();await localWrites.catch(()=>{});if(request!==navigationId||!user)return;
  const changed=date!==selectedDate;selectedDate=date;dayTouched=true;selectedYear=Number(date.slice(0,4));yearView=false;$('#photos-view').setAttribute('aria-pressed','true');$('#year-view').setAttribute('aria-pressed','false');render({dayMotion:true});if(changed)reveal($('#entry-panel'),{duration:170});
}
function renderYear(){
  $('#year-title').textContent=selectedYear;const grid=$('#year-grid');grid.replaceChildren();const dates=daysInYear(selectedYear);
  for(let month=1;month<=12;month++){
    const monthDates=dates.filter(d=>Number(d.slice(5,7))===month),saved=monthDates.filter(d=>filled(entry(d))).length;
    const block=document.createElement('button');block.type='button';block.className='month-block';block.setAttribute('aria-label',displayDate(monthDates[0],{month:'long',year:'numeric'})+', '+saved+' days saved. Select a day.');
    const h=document.createElement('h3');h.textContent=displayDate(monthDates[0],{month:'short'});const week=document.createElement('div');week.className='month-weekdays';week.setAttribute('aria-hidden','true');for(const d of ['M','T','W','T','F','S','S']){const label=document.createElement('span');label.textContent=d;week.append(label);}
    const days=document.createElement('div');days.className='month-days';days.setAttribute('aria-hidden','true');const start=(new Date(monthDates[0]+'T12:00:00Z').getUTCDay()+6)%7;for(let i=0;i<start;i++)days.append(document.createElement('span'));
    for(const date of monthDates){const cell=document.createElement('span');cell.className='year-day '+status(entry(date),date,today())+(date===selectedDate?' selected':'');days.append(cell);}
    block.onclick=()=>openMonth(month);block.append(h,week,days);grid.append(block);
  }
}
function renderMonth(){
  const monthDate=`${selectedYear}-${String(selectedMonth).padStart(2,'0')}-01`;$('#month-title').textContent=displayDate(monthDate,{month:'long',year:'numeric'});const grid=$('#month-grid');grid.replaceChildren();
  const dates=daysInYear(selectedYear).filter(d=>Number(d.slice(5,7))===selectedMonth);const start=(new Date(monthDate+'T12:00:00Z').getUTCDay()+6)%7;for(let i=0;i<start;i++)grid.append(document.createElement('span'));
  for(const date of dates){const button=document.createElement('button');button.type='button';button.textContent=Number(date.slice(-2));button.className=status(entry(date),date,today());button.setAttribute('aria-label',displayDate(date,{weekday:'long',month:'long',day:'numeric'})+', '+status(entry(date),date,today()));if(date===selectedDate)button.setAttribute('aria-current','date');button.disabled=date>today()&&!entries.has(date);button.onclick=async()=>{await $('#month-dialog').close();await openDay(date);$('#entry-panel').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};grid.append(button);}
}
function openMonth(month){selectedMonth=month;renderMonth();$('#month-dialog').showModal();}
let syncTimer;
let dayTouched=false,firstSettings=true;
function queueSync(){clearTimeout(syncTimer);syncTimer=setTimeout(runSync,600);}
async function runSync(){
  if(!user||!navigator.onLine||syncing)return;syncing=true;const uid=user.uid;
  try{
    await localWrites;const updatedDates=[];
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
      entries.set(date,clean);await persist(clean);updatedDates.push(date);
    }
    $('#connection-status').textContent=[...entries.values()].some(e=>e.photo?.pending)?'Text entries synced. Photo backups are waiting for the Worker.':'Firebase connected. Your entries are synced.';if(entry()._dirty.length===0)savedLabel('Saved & synced');if(tab==='today'||memoryEditor.date)renderEntry();dayStrip.update(updatedDates);memories.update(updatedDates);dateNavigator.refresh();
  }catch(err){savedLabel('Saved on device · backup pending');$('#connection-status').textContent=readableError(err);if(entry().photo?.pending)$('#photo-note').textContent='Saved on device. Photo backup is waiting for the Worker setup.';}
  finally{syncing=false;if(user&&[...entries.values()].some(e=>e._dirty.length)&&navigator.onLine){clearTimeout(syncTimer);syncTimer=setTimeout(runSync,15000);}}
}
async function checkBackend(){try{backend=await cloud.backendStatus();$('#connection-status').textContent=backend.photos?'Firebase and photo backend connected.':'Firebase connected. Configure Cloudinary secrets in the Worker.';$('#reminder-status').textContent=backend.reminders?(settings.reminderDeviceId===deviceId?'Enabled on this phone at '+(settings.reminderTime||'21:00')+'.':'Ready to enable on this phone.'):'Reminder backend needs its VAPID and Firebase service-account secrets.';}catch(err){backend=null;$('#connection-status').textContent='Firebase connected; the Worker still needs deployment.';$('#reminder-status').textContent='Phone reminders need the Worker setup first.';}}
async function onUser(account,message){

  for(const stop of unsubscribers)stop();unsubscribers=[];user=account;entries=new Map();settings={};dayTouched=false;firstSettings=true;for(const url of photoURLs.values())URL.revokeObjectURL(url);photoURLs.clear();photoPromises.clear();dayStrip.reset();photoRenderer.reset();prompts.reset();memories.reset();memoryDate=null;navigationId++;
  for(const id of ['good','learned','camera-button','library-button','export','import','enable-reminders'])$('#'+id).disabled=!user;
  $('#signout').hidden=!user;$('#account-label').textContent=user?user.email:'';
  if(!user){dateNavigator.reset();tab='today';yearView=false;applyAuthGate(document,false);for(const field of ['good','learned'])$('#'+field).value='';$('#entry-photo').removeAttribute('src');for(const id of ['day-strip','year-grid'])$('#'+id).replaceChildren();$('#toast').hidden=true;clearTimeout(toast.timer);window.scrollTo({top:0,behavior:'auto'});}
  if(message)toast(message);
  if(user){const cached=await store.entriesFor(user.uid);entries=new Map(cached.map(e=>[e.date,e]));settings=(await store.get('settings',user.uid))?.value||{};applySettings();selectedDate=today();store.persistStorage().catch(()=>{});
    unsubscribers=cloud.listen(user.uid,async changes=>{const uid=account.uid,changed=[];for(const {type,data:r} of changes){if(user?.uid!==uid)return;if(type==='removed'&&!entry(r.date)._dirty.length){entries.delete(r.date);await store.remove('entries',uid+':'+r.date);}else{const merged=mergeEntry(entry(r.date),r);entries.set(r.date,merged);await persist(merged);}changed.push(r.date);}if(user?.uid!==uid)return;dayStrip.update(changed);if(changed.includes(memoryEditor.date||selectedDate)&&(tab==='today'||memoryEditor.date))renderEntry();memories.update(changed);dateNavigator.refresh();if($('#month-dialog').open)renderMonth();},async incoming=>{if(user?.uid!==account.uid)return;settings={...settings,...incoming};await store.put('settings',{key:user.uid,value:settings});applySettings();if(firstSettings&&!dayTouched&&tab==='today'){selectedDate=today();render();}firstSettings=false;},err=>{$('#connection-status').textContent=readableError(err);savedLabel('Saved on device · cloud unavailable');});
    checkBackend();queueSync();
    try{const restored=JSON.parse(sessionStorage.getItem('tristana-after-update')||'null');sessionStorage.removeItem('tristana-after-update');if(restored?.uid===user.uid&&['today','past','settings'].includes(restored.tab)&&validDay(restored.date)){tab=restored.tab;selectedDate=tab==='today'?today():restored.date;yearView=false;if(tab==='past')memoryDate=selectedDate;selectedYear=Number(restored.year)||Number(selectedDate.slice(0,4));dayTouched=true;$('#photos-view').setAttribute('aria-pressed',String(!yearView));$('#year-view').setAttribute('aria-pressed',String(yearView));requestAnimationFrame(()=>window.scrollTo({top:Math.max(0,Number(restored.scroll)||0),behavior:'auto'}));}}catch{}
  }
  render();
}
function applySettings(){zone=settings.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;$('#timezone-label').textContent='Journal timezone: '+zone.replaceAll('_',' ');$('#phone-toggle').checked=settings.phoneDeviceId===deviceId;$('#reminder-time').value=settings.reminderTime||'21:00';if(settings.phoneDeviceId===deviceId){const currentZone=Intl.DateTimeFormat().resolvedOptions().timeZone;if(currentZone!==zone){zone=currentZone;cloud.settings(user.uid,{timezone:zone}).catch(error);}}$('#disable-reminders').hidden=settings.reminderDeviceId!==deviceId;header();}
async function closeNotifications(date){if(date!==today()||!filled(entry(date)))return;try{const registration=await navigator.serviceWorker?.getRegistration();for(const n of await registration?.getNotifications()||[])if(n.data?.date===date)n.close();}catch{}}
const cropper=createCropper(async({source,square,date,oldPhoto,crop})=>{
  if(!user)return;const localId=crypto.randomUUID();const thumbnail=await thumbnailPhoto(square);await store.put('photos',{key:user.uid+':'+localId,source,square,thumbnail});
  await change('photo',{localId,crop,pending:true,source:null,square:null},date);if((memoryEditor.date||selectedDate)===date){renderEntry();renderStrip();}
},error,{onPlaced:async({date,from})=>{if(!user||(memoryEditor.date||selectedDate)!==date)return;await photoRenderer.ready;const preview=$('#photo-preview'),image=$('#entry-photo');if(preview.hidden||!image.src)return;preview.scrollIntoView({block:'nearest',behavior:'auto'});await animatePhoto(image,from,image.getBoundingClientRect());}});
let photoCapture;
for(const type of ['camera','library']){$('#'+type+'-button').onclick=()=>{photoCapture={date:memoryEditor.date||selectedDate,uid:user?.uid};$('#'+type+'-input').click();};$('#'+type+'-input').onchange=async e=>{const file=e.target.files[0],capture=photoCapture;photoCapture=null;if(file&&capture?.uid===user?.uid&&user)try{await cropper.open(file,capture.date,entry(capture.date).photo);}catch(err){error(err);}e.target.value='';};}
const lightbox=bindPhotoLightbox(document,{
  isAuthenticated:()=>Boolean(user),
  async onOpen(){
    const date=memoryEditor.date||selectedDate,photo=entry(date).photo;if(!user||!photo)return null;
    const uid=user.uid,url=await photoURL(photo,'source');if(user?.uid!==uid||entry(date).photo?.localId!==photo.localId||!url)return null;
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
    if(!await confirmAction(document,{title:'Remove photograph?',message:'This day’s text will stay saved.',action:'Remove'}))return false;
    if(!user||entry(date).photo?.localId!==photo.localId)return true;
    await change('photo',null,date);if((memoryEditor.date||selectedDate)===date){renderEntry();renderStrip();}return true;
  },
  onError:error
});
const signIn=()=>cloud.signIn().catch(err=>{error(err);throw err;});
if(window.tristanaStartup)window.tristanaStartup.setSignIn(signIn);else $('#signin').onclick=()=>signIn().catch(()=>{});
$('#signout').onclick=async()=>{await localWrites;await cloud.signOut();};
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=async()=>{
  if(memoryEditor.date)await $('#empty-day-dialog').close();
  const target=b.dataset.tab,request=++navigationId;prompts.commit();await localWrites.catch(()=>{});if(request!==navigationId||!user)return;
  tabScroll[tab]=window.scrollY;const changed=tab!==target;tab=target;if(tab==='today'){selectedDate=today();yearView=false;}if(tab==='past'){selectedDate=memoryDate=memoryDate||memories.latest()||today();yearView=false;}render({recenterDay:tab==='today'});
  window.scrollTo({top:target==='today'?0:tabScroll[target],behavior:'auto'});if(changed)reveal(tab==='settings'?$('#settings-view'):$('#journal-view'),{duration:200,offset:6});
};
$('#prev-day').onclick=()=>openDay(shiftDay(selectedDate,-1));$('#next-day').onclick=()=>openDay(shiftDay(selectedDate,1));
$('#date-button').onclick=()=>{$('#selected-date').value=selectedDate;$('#selected-date').max=today();$('#date-dialog').showModal();};$('#date-dialog').addEventListener('click',event=>{const dialog=$('#date-dialog');const rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))dialog.close('cancel');});$('#date-dialog').addEventListener('close',()=>{if($('#date-dialog').returnValue==='choose')openDay($('#selected-date').value);});
$('#photos-view').onclick=()=>{yearView=false;$('#photos-view').setAttribute('aria-pressed','true');$('#year-view').setAttribute('aria-pressed','false');render();};$('#year-view').onclick=()=>{yearView=true;$('#photos-view').setAttribute('aria-pressed','false');$('#year-view').setAttribute('aria-pressed','true');render();};$('#prev-year').onclick=()=>{selectedYear--;renderYear();};$('#next-year').onclick=()=>{selectedYear++;renderYear();};
for(const theme of manifest.themes){const option=document.createElement('option');option.value=theme.month;option.textContent=displayDate(`2026-${String(theme.month).padStart(2,'0')}-01`,{month:'long'})+' · '+theme.name;$('#theme-select').append(option);}
$('#theme-select').onchange=e=>{localStorage.setItem('tristana-theme',e.target.value);applyTheme();if(tab==='today')renderEntry();dayStrip.update();memories.update();};
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
$('#retry-sync').onclick=()=>{checkBackend();runSync();};window.addEventListener('resize',()=>prompts.resize());window.addEventListener('online',()=>{queueSync();if(user)checkBackend();});window.addEventListener('pagehide',()=>{if(user)for(const e of entries.values())if(e._dirty.length)persist(e);});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(user){applySettings();queueSync();}header();}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;$('#install').hidden=false;});$('#install').onclick=async()=>{await installEvent?.prompt();installEvent=null;$('#install').hidden=true;};
if('serviceWorker'in navigator){
  const updater=createUpdatePrompt({document,serviceWorker:navigator.serviceWorker,
    async saveDrafts(){prompts.commit();if(user)for(const e of entries.values())if(e._dirty.length)await persist(e);await localWrites;sessionStorage.setItem('tristana-after-update',JSON.stringify({uid:user?.uid,tab,date:selectedDate,yearView,year:selectedYear,scroll:window.scrollY}));},
    reload:()=>window.location.reload(),onError:error});
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>{updater.watch(registration);updater.check();}).catch(()=>toast('Offline installation could not be enabled.'));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')updater.check();});window.addEventListener('online',()=>updater.check());
  setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)updater.check();},5*60*1000);
}
render();
export async function start(){await cloud.initialize(onUser);$('#signin').disabled=false;}

$('#close-month').onclick=()=>$('#month-dialog').close('cancel');
for(const id of ['month-dialog','confirm-dialog'])$('#'+id).addEventListener('click',event=>{const dialog=$('#'+id),rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))dialog.close('cancel');});

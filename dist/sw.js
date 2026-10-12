const VERSION='tristana-v27';
const SHELL=['./','./index.html','./style.css','./manifest.webmanifest','./theme-manifest.json','./js/app.js','./js/auth-ui.js','./js/photo-ui.js','./js/prompt-ui.js','./js/strip-ui.js','./js/entry-ui.js','./js/image-utils.js','./js/photo-grades.js','./js/update-ui.js','./js/memories-ui.js','./js/motion-ui.js','./fonts/lato-regular.woff2','./fonts/lato-medium.woff2','./fonts/lato-semibold.woff2','./js/config.js','./js/core.js','./js/storage.js','./js/cloud.js','./js/crop.js','./js/themes.js','./icons/nav/today-outline.svg','./icons/nav/today-filled.svg','./icons/nav/calendar-outline.svg','./icons/nav/calendar-filled.svg','./icons/nav/settings-outline.svg','./icons/nav/settings-filled.svg','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(VERSION);await c.addAll(SHELL);try{await c.addAll(['firebase-app','firebase-auth','firebase-firestore'].map(name=>'https://www.gstatic.com/firebasejs/13.0.0/'+name+'.js'));}catch{/* Local shell remains usable if SDK caching is interrupted. */}})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('tristana-')&&k!==VERSION)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  const same=u.origin===self.location.origin;
  const sdk=u.origin==='https://www.gstatic.com'&&u.pathname.startsWith('/firebasejs/13.0.0/');
  if(!same&&!sdk)return;
  // Only public shell/artwork and SDK scripts enter Cache Storage. Journal photos never do.
  if(same&&!(u.pathname.startsWith(new URL('./',self.location).pathname)) )return;
  e.respondWith((async()=>{
    const cache=await caches.open(VERSION);
    const cached=await cache.match(e.request);
    const isAsset=sdk||u.pathname.includes('/assets/')||u.pathname.includes('/icons/');
    if(isAsset&&cached)return cached;
    try{const response=await fetch(e.request);if(response.ok&&response.type!=='opaque')await cache.put(e.request,response.clone());return response;}catch(err){if(cached)return cached;if(e.request.mode==='navigate')return await cache.match('./index.html');throw err;}
  })());
});
async function locallyFilled(uid,date){
  return new Promise(resolve=>{const r=indexedDB.open('tristana',1);r.onerror=()=>resolve(false);r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('entries')){db.close();return resolve(false);}const q=db.transaction('entries').objectStore('entries').get(uid+':'+date);q.onsuccess=()=>{const e=q.result;db.close();resolve(Boolean(e?.good?.trim()||e?.learned?.trim()||e?.photo));};q.onerror=()=>{db.close();resolve(false);};};});
}
self.addEventListener('push',e=>e.waitUntil((async()=>{let data;try{data=e.data.json();}catch{return;}if(!data.date||!data.uid)return;if(await locallyFilled(data.uid,data.date)){for(const n of await self.registration.getNotifications({tag:'tristana-'+data.date}))n.close();return;}await self.registration.showNotification('A little of today',{body:'Something good, something learned, or one photograph.',icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:'tristana-'+data.date,data:{date:data.date,url:new URL('./',self.location).href}});})()));
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=windows.find(c=>c.url.startsWith(new URL('./',self.location).href));if(client)await client.focus();else await self.clients.openWindow(e.notification.data.url);})());});

self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());});

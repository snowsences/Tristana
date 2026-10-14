import {CONFIG} from './config.js?v=78';
import {reconcile} from './core.js?v=78';
let sdk,auth,db,initializing,stopAuth;
export function initialize(onUser) {
  if(initializing)return initializing;
  const task=(async()=>{
  const [appAPI,authAPI,storeAPI]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')
  ]);
  sdk={...appAPI,...authAPI,...storeAPI};
  const app=sdk.getApps().length?sdk.getApp():sdk.initializeApp(CONFIG.firebase);
  if(!auth){try{auth=sdk.initializeAuth(app,{persistence:[sdk.indexedDBLocalPersistence,sdk.browserLocalPersistence,sdk.browserSessionPersistence],popupRedirectResolver:sdk.browserPopupRedirectResolver});}catch(error){if(error.code!=='auth/already-initialized')throw error;auth=sdk.getAuth(app);}}
  db=sdk.getFirestore(app);
  stopAuth?.();
  await new Promise((resolve,reject)=>{let first=true;
    stopAuth=sdk.onAuthStateChanged(auth,user=>{
      (async()=>{if(user&&(user.email?.toLowerCase()!==CONFIG.ownerEmail||!user.emailVerified)){await sdk.signOut(auth);await onUser(null,'This journal is only for '+CONFIG.ownerEmail);}else await onUser(user);})().then(()=>{if(first){first=false;resolve();}},error=>{if(first){first=false;reject(error);}else globalThis.window?.tristanaStartup?.initializationFailed(error);});
    },error=>{if(first){first=false;reject(error);}else globalThis.window?.tristanaStartup?.initializationFailed(error);});
  });
  })();initializing=task;task.then(()=>{initializing=null;},()=>{initializing=null;stopAuth?.();stopAuth=null;});return task;
}
export async function signIn() {
  if(!auth) throw new Error('Connect to the internet to sign in.');
  const provider=new sdk.GoogleAuthProvider(); provider.setCustomParameters({login_hint:CONFIG.ownerEmail,prompt:'select_account'});
  return sdk.signInWithPopup(auth,provider);
}
export async function signOut() { if(auth) await sdk.signOut(auth); }
export function listen(uid,onEntries,onSettings,onError) {
  return [
    sdk.onSnapshot(sdk.collection(db,'users',uid,'entries'),snap=>onEntries(snap.docChanges().map(change=>({type:change.type,data:change.doc.data()}))),onError),
    sdk.onSnapshot(sdk.doc(db,'users',uid),snap=>onSettings(snap.data() || {}),onError)
  ];
}
export async function sync(uid,local) {
  const ref=sdk.doc(db,'users',uid,'entries',local.date);
  return sdk.runTransaction(db,async tx=>{
    const snap=await tx.get(ref); const remote=snap.data() || {date:local.date,learned:'',good:'',photo:null,revision:0};
    const {next}=reconcile(local,remote);
    const data={date:local.date,learned:next.learned||'',good:next.good||'',photo:next.photo||null,revision:(remote.revision||0)+1,updatedAt:Date.now(),updatedBy:local.updatedBy||'device'};
    tx.set(ref,data);
    return {data};
  });
}
export async function settings(uid,patch) { await sdk.setDoc(sdk.doc(db,'users',uid),patch,{merge:true}); }
export async function api(path,{method='GET',body}={}) {
  if(!auth?.currentUser) throw new Error('Sign in to connect to your backup.');
  const token=await auth.currentUser.getIdToken();
  const response=await fetch(CONFIG.workerURL+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  if(!response.ok) {let message='Backend connection failed';try{message=(await response.json()).error||message;}catch{}throw new Error(message);}
  return response;
}
export async function backendStatus() {
  const r=await api('/status');
  if(!r.headers.get('content-type')?.includes('application/json')) throw new Error('The Worker is not configured yet.');
  return r.json();
}
export async function upload(blob,date,kind,uploadId) {
  const signature=await (await api('/upload-sign',{method:'POST',body:{date,kind,uploadId}})).json();
  if(signature.cloudName!==CONFIG.cloudName) throw new Error('Unexpected photo storage configuration.');
  const form=new FormData(); form.append('file',blob);
  for(const [key,value] of Object.entries(signature.params)) form.append(key,String(value));
  form.append('api_key',signature.apiKey);form.append('signature',signature.signature);
  const r=await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.cloudName}/image/upload`,{method:'POST',body:form});
  const data=await r.json();
  if(!r.ok) {
    throw new Error(data.error?.message||'Photo upload failed.');
  }
  return {publicId:data.public_id,format:data.format,version:data.version};
}
export async function media(asset) {
  if(!asset?.publicId) throw new Error('Photo is not backed up yet.');
  const query=new URLSearchParams({publicId:asset.publicId,format:asset.format||'jpg',version:String(asset.version||1)});
  return (await api('/media?'+query)).blob();
}

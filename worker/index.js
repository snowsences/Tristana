import {createRemoteJWKSet,jwtVerify,SignJWT,importPKCS8} from 'jose';
import webpush from 'web-push';
import {allowedOwner,safePushEndpoint,validDate,validTime,validZone,localClock,shouldRemind} from './security.js';
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
let serviceToken,serviceExpires=0;
const encoder=new TextEncoder();
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
async function sha1(value){const buffer=await crypto.subtle.digest('SHA-1',encoder.encode(value));return [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function signature(params,secret){return sha1(Object.keys(params).sort().map(key=>`${key}=${params[key]}`).join('&')+secret);}
function response(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});}
async function identity(request,env){
 const bearer=request.headers.get('Authorization');if(!bearer?.startsWith('Bearer '))fail('Sign in first.',401);
 try{const {payload}=await jwtVerify(bearer.slice(7),jwks,{issuer:`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,audience:env.FIREBASE_PROJECT_ID,requiredClaims:['exp','iat','sub','auth_time']});if(!allowedOwner(payload,env))fail('This journal is private.',403);return payload;}catch(err){if(err.status)throw err;fail('Sign-in expired. Please sign in again.',401);}
}
async function json(request){if(Number(request.headers.get('Content-Length')||0)>16000)fail('Request too large.',413);const text=await request.text();if(text.length>16000)fail('Request too large.',413);try{return JSON.parse(text);}catch{fail('Invalid JSON.');}}
function requirePhotos(env){if(!env.CLOUDINARY_API_KEY||!env.CLOUDINARY_API_SECRET)fail('Cloudinary secrets are not configured in the Worker.',503);}
function requireReminders(env){if(!env.TRISTANA_STATE||!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.FIREBASE_CLIENT_EMAIL||!env.FIREBASE_PRIVATE_KEY)fail('Reminder secrets and KV are not configured in the Worker.',503);}
function cors(env){return {'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'86400','Cache-Control':'no-store'};}
async function api(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/health'&&request.method==='GET')return response({app:'Tristana',version:1});
 const owner=await identity(request,env);
 if(url.pathname==='/status'&&request.method==='GET')return response({photos:Boolean(env.CLOUDINARY_API_KEY&&env.CLOUDINARY_API_SECRET),reminders:Boolean(env.TRISTANA_STATE&&env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.FIREBASE_CLIENT_EMAIL&&env.FIREBASE_PRIVATE_KEY),vapidPublicKey:env.VAPID_PUBLIC_KEY||null});
 if(url.pathname==='/upload-sign'&&request.method==='POST'){
  requirePhotos(env);const body=await json(request);if(!validDate(body.date)||!['original','square'].includes(body.kind)||!/^[-a-f0-9]{36}$/.test(body.uploadId||''))fail('Invalid photo request.');
  const params={timestamp:Math.floor(Date.now()/1000),public_id:`tristana/${owner.sub}/${body.date}/${body.uploadId}-${body.kind}`,type:'authenticated',overwrite:true};
  return response({cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,params,signature:await signature(params,env.CLOUDINARY_API_SECRET)});
 }
 if(url.pathname==='/media'&&request.method==='GET'){
  requirePhotos(env);const publicId=url.searchParams.get('publicId'),format=url.searchParams.get('format');
  if(!publicId?.startsWith(`tristana/${owner.sub}/`)||!/^tristana\/[A-Za-z0-9_-]+\/\d{4}-\d{2}-\d{2}\/[-a-f0-9]{36}-(original|square)$/.test(publicId)||!['jpg','jpeg','png','webp','heic','avif'].includes(format))fail('Invalid photograph.',403);
  // Cloudinary's download endpoint gives a short-lived authenticated download;
  // its signed URL never leaves the server. Only authorized bytes are returned.
  const params={timestamp:Math.floor(Date.now()/1000),public_id:publicId,format,type:'authenticated',expires_at:Math.floor(Date.now()/1000)+60};
  const query=new URLSearchParams({...params,api_key:env.CLOUDINARY_API_KEY,signature:await signature(params,env.CLOUDINARY_API_SECRET)});
  const upstream=await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/download?${query}`,{redirect:'follow'});
  if(!upstream.ok)fail('Photograph is not available from the backup yet.',502);
  const type=upstream.headers.get('Content-Type')||'application/octet-stream';if(!type.startsWith('image/'))fail('Unexpected photo response.',502);
  return new Response(upstream.body,{headers:{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(url.pathname==='/reminders'&&request.method==='POST'){
  requireReminders(env);const body=await json(request);if(!safePushEndpoint(body.subscription?.endpoint)||!body.subscription.keys?.p256dh||!body.subscription.keys?.auth||typeof body.deviceId!=='string'||body.deviceId.length>80||!validTime(body.time)||!validZone(body.timezone))fail('Invalid reminder settings.');
  // There is exactly one subscribed device for this personal journal.
  await env.TRISTANA_STATE.put('reminder',JSON.stringify({uid:owner.sub,subscription:body.subscription,deviceId:body.deviceId,time:body.time,timezone:body.timezone,lastSentDate:null}));return response({enabled:true});
 }
 if(url.pathname==='/reminders/time'&&request.method==='POST'){
  requireReminders(env);const body=await json(request);if(!validTime(body.time)||!validZone(body.timezone))fail('Invalid reminder settings.');const state=await env.TRISTANA_STATE.get('reminder','json');if(state?.uid!==owner.sub)fail('Enable reminders on your phone first.',404);await env.TRISTANA_STATE.put('reminder',JSON.stringify({...state,time:body.time,timezone:body.timezone}));return response({updated:true});
 }
 if(url.pathname==='/reminders'&&request.method==='DELETE'){
  requireReminders(env);const body=await json(request);const state=await env.TRISTANA_STATE.get('reminder','json');if(state?.uid===owner.sub&&state.deviceId===body.deviceId)await env.TRISTANA_STATE.delete('reminder');return response({enabled:false});
 }
 fail('Endpoint not found.',404);
}
async function serviceAccess(env){
 if(serviceToken&&Date.now()<serviceExpires)return serviceToken;
 const privateKey=await importPKCS8(env.FIREBASE_PRIVATE_KEY.replaceAll('\\n','\n'),'RS256');
 const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/datastore'}).setProtectedHeader({alg:'RS256'}).setIssuer(env.FIREBASE_CLIENT_EMAIL).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(privateKey);
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
 const data=await r.json();if(!r.ok)throw new Error('Firebase service account could not authenticate.');serviceToken=data.access_token;serviceExpires=Date.now()+Math.min(data.expires_in-120,3300)*1000;return serviceToken;
}
function decode(value){if('stringValue'in value)return value.stringValue;if('booleanValue'in value)return value.booleanValue;if('integerValue'in value)return Number(value.integerValue);if('nullValue'in value)return null;if(value.mapValue)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,decode(v)]));if(value.arrayValue)return(value.arrayValue.values||[]).map(decode);return null;}
async function document(env,path){const token=await serviceAccess(env);const r=await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,{headers:{Authorization:'Bearer '+token}});if(r.status===404)return null;if(!r.ok)throw new Error('Firebase reminder check failed.');const data=await r.json();return Object.fromEntries(Object.entries(data.fields||{}).map(([k,v])=>[k,decode(v)]));}
export async function scheduled(env,instant=new Date()){
 requireReminders(env);const state=await env.TRISTANA_STATE.get('reminder','json');if(!state)return;
 if(env.OWNER_UID&&state.uid!==env.OWNER_UID)return;
 const settings=await document(env,`users/${state.uid}`);const timezone=settings?.timezone||state.timezone;const time=settings?.reminderTime||state.time;
 if(!validZone(timezone)||!validTime(time))return;const clock=localClock(timezone,instant);if(clock.time!==time||state.lastSentDate===clock.date)return;
 const entry=await document(env,`users/${state.uid}/entries/${clock.date}`);if(!shouldRemind(entry,clock,time,state.lastSentDate))return;
 if(!safePushEndpoint(state.subscription.endpoint))return;
 const details=webpush.generateRequestDetails(state.subscription,JSON.stringify({date:clock.date,uid:state.uid}),{TTL:3600,urgency:'normal',vapidDetails:{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY}});
 const result=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body});
 if([404,410].includes(result.status)){await env.TRISTANA_STATE.delete('reminder');return;}
 if(!result.ok)throw new Error('Push provider rejected the reminder.');
 await env.TRISTANA_STATE.put('reminder',JSON.stringify({...state,lastSentDate:clock.date}));
}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');if(origin&&origin!==env.ALLOWED_ORIGIN)return response({error:'Origin not allowed.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(env)});
  try{const result=await api(request,env);const headers=new Headers(result.headers);for(const [k,v]of Object.entries(cors(env)))headers.set(k,v);return new Response(result.body,{status:result.status,headers});}catch(err){return response({error:err.status?err.message:'Backend request failed.'},err.status||500,cors(env));}
 },
 scheduled(controller,env,ctx){ctx.waitUntil(scheduled(env,new Date(controller.scheduledTime)).catch(err=>console.error('Tristana reminder:',err.message)));}
};

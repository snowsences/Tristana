export function allowedOwner(payload,env){
  return Boolean(payload.sub && payload.email===env.OWNER_EMAIL && payload.email_verified===true && payload.firebase?.sign_in_provider==='google.com' && (!env.OWNER_UID||payload.sub===env.OWNER_UID));
}
export function safePushEndpoint(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname);}catch{return false;}
}
export function validDate(date){const d=new Date(date+'T12:00:00Z');return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(+d)&&d.toISOString().slice(0,10)===date;}
export function validTime(value){return typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);}
export function validZone(value){try{if(typeof value!=='string'||value.length>80)return false;new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}}
export function localClock(timezone,instant=new Date()){
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);const v=k=>p.find(x=>x.type===k).value;return {date:`${v('year')}-${v('month')}-${v('day')}`,time:`${v('hour')}:${v('minute')}`};
}
export function shouldRemind(entry,clock,time,lastSentDate){return clock.time===time&&clock.date!==lastSentDate&&!Boolean(entry?.good?.trim()||entry?.learned?.trim()||entry?.photo);}

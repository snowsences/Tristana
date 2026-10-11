export const FIELDS = ['learned', 'good', 'photo'];
export const LIMIT = 140;
export const count = value => Array.from(value || '').length;
export const limit = value => Array.from(value || '').slice(0, LIMIT).join('');
export function dayInZone(zone, instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(instant);
  const part = key => parts.find(p=>p.type===key).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(day+'T12:00:00Z');
  return !Number.isNaN(+d) && d.toISOString().slice(0,10)===day;
}
export function shiftDay(day, amount) {
  if (!validDay(day)) throw new Error('Invalid date');
  const d = new Date(day+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+amount);
  return d.toISOString().slice(0,10);
}
export function daysInYear(year) {
  const out = []; let day = `${year}-01-01`;
  while (day.startsWith(`${year}-`)) { out.push(day); day = shiftDay(day,1); }
  return out;
}
export function filled(entry) {
  return Number(Boolean(entry?.learned?.trim()))+Number(Boolean(entry?.good?.trim()))+Number(Boolean(entry?.photo));
}
export function status(entry, day, today) {
  if(day>today) return 'future';
  return ['missing','partial','partial','done'][filled(entry)];
}
export const blankEntry = day => ({date:day,learned:'',good:'',photo:null,revision:0,_dirty:[],_base:{learned:'',good:'',photo:null}});
export const same = (a,b) => JSON.stringify(a??null) === JSON.stringify(b??null);
export function mergeEntry(local, remote) {
  const result = {...blankEntry(local.date), ...remote, ...local, _base:{...local._base}, _dirty:[...local._dirty]};
  for (const field of FIELDS) if (!local._dirty.includes(field)) {
    result[field] = remote?.[field] ?? (field==='photo'?null:'');
    result._base[field] = result[field];
  }
  result.revision = remote?.revision || 0;
  return result;
}
export function reconcile(local, remote) {
  const next = {...remote, date:local.date}; const conflicts=[];
  for (const field of local._dirty) {
    if (!same(local._base[field],remote?.[field]) && !same(local[field],remote?.[field])) conflicts.push(field);
    next[field] = local[field];
  }
  return {next, conflicts};
}
export function cropBounds(width,height,frame,zoom,x,y) {
  const scale=Math.max(frame/width,frame/height)*zoom;
  const maxX=(width*scale-frame)/2, maxY=(height*scale-frame)/2;
  return {scale,x:Math.min(maxX,Math.max(-maxX,x)),y:Math.min(maxY,Math.max(-maxY,y))};
}
export function cropSource(width,height,frame,zoom,x,y) {
  const b=cropBounds(width,height,frame,zoom,x,y);
  return {sx:(width-frame/b.scale)/2-b.x/b.scale,sy:(height-frame/b.scale)/2-b.y/b.scale,size:frame/b.scale,...b};
}

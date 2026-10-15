/** Asset selection only. No journal data, authentication, or app routing. */
export function localISODate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function parseISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('Use a YYYY-MM-DD calendar date.');
  const [y,m,d] = value.split('-').map(Number);
  const dt = new Date(0);
  dt.setUTCFullYear(y,m-1,d); dt.setUTCHours(0,0,0,0);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m-1 || dt.getUTCDate() !== d) throw new RangeError('Invalid calendar date.');
  return {month:m, weekday:(dt.getUTCDay()+6)%7}; // Monday=0 ... Sunday=6
}
/** A portable seeded shuffle keeps each month's loop identical across devices. */
export function monthlySceneOrder(theme,date) {
  parseISODate(date);
  if(!theme.scenes?.length)throw new Error('Theme has no scenes.');
  const order=theme.scenes.filter(scene=>!scene.reservedForDate).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  if(!order.length)throw new Error('Theme has no regular scenes.');
  let seed=2166136261;
  for(const char of `tristana-monthly-v1:${date.slice(0,7)}:${theme.id}`)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  const random=()=>{seed=(seed+0x6D2B79F5)>>>0;let value=seed;value=Math.imul(value^(value>>>15),value|1);value^=value+Math.imul(value^(value>>>7),value|61);return ((value^(value>>>14))>>>0)/4294967296;};
  for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  return order;
}
export function resolveHeader(manifest, {date=localISODate(), themeMonth}={}) {
  const parsed=parseISODate(date);
  const month=themeMonth ?? parsed.month;
  if(!Number.isInteger(month)||month<1||month>12) throw new RangeError('Theme month must be 1 through 12.');
  const theme=manifest.themes.find(t=>t.month===month);
  if(!theme) throw new Error('Theme is missing from manifest.');
  const order=monthlySceneOrder(theme,date);
  const scene=theme.scenes.find(scene=>scene.reservedForDate===date.slice(5))
    ?? order[(Number(date.slice(8,10))-1)%order.length];
  return {date,theme,scene};
}
/** Pass the same resolved selection to BOTH Today and Past Days. */
export function applyHeader(element, selection, {baseURL='./'}={}) {
  const {theme,scene}=selection;
  const base = new URL(baseURL, document.baseURI);
  element.style.setProperty('--journal-bg',scene.background||theme.colors.background);
  element.style.setProperty('--journal-ink',theme.colors.ink);
  element.style.setProperty('--journal-accent',theme.colors.accent);
  let image=element.querySelector('.journal-header__art');
  if(!image){image=document.createElement('img');image.className='journal-header__art';element.prepend(image);}
  image.dataset.edgeBlend=scene.edgeBlend||'';
  image.src=new URL(scene.src,base).href;
  image.srcset=`${new URL(scene.smallSrc,base).href} 600w, ${new URL(scene.src,base).href} 1200w`;
  image.sizes='(max-width: 600px) 100vw, 680px';
  image.width=1200; image.height=800;
  image.alt=''; // Theme artwork is decorative; entry photos need their own alt text.
  image.decoding='async';
  element.dataset.theme=theme.id;
  element.dataset.scene=scene.id;
}

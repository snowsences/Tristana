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
export function resolveHeader(manifest, {date=localISODate(), themeMonth, weekday}={}) {
  const parsed=parseISODate(date);
  const month=themeMonth ?? parsed.month;
  const day=weekday ?? parsed.weekday;
  if(!Number.isInteger(month)||month<1||month>12) throw new RangeError('Theme month must be 1 through 12.');
  if(!Number.isInteger(day)||day<0||day>6) throw new RangeError('Weekday must be Monday=0 through Sunday=6.');
  const theme=manifest.themes.find(t=>t.month===month);
  if(!theme) throw new Error('Theme is missing from manifest.');
  const scene=theme.scenes.find(s=>s.weekday===day);
  if(!scene) throw new Error('Weekday is missing from theme.');
  return {date,theme,scene};
}
/** Pass the same resolved selection to BOTH Today and Past Days. */
export function applyHeader(element, selection, {baseURL='./'}={}) {
  const {theme,scene}=selection;
  const base = new URL(baseURL, document.baseURI);
  element.style.setProperty('--journal-bg',theme.colors.background);
  element.style.setProperty('--journal-ink',theme.colors.ink);
  element.style.setProperty('--journal-accent',theme.colors.accent);
  let image=element.querySelector('.journal-header__art');
  if(!image){image=document.createElement('img');image.className='journal-header__art';element.prepend(image);}
  image.src=new URL(scene.src,base).href;
  image.srcset=`${new URL(scene.smallSrc,base).href} 600w, ${new URL(scene.src,base).href} 1200w`;
  image.sizes='(max-width: 600px) 100vw, 680px';
  image.width=1200; image.height=800;
  image.alt=''; // Theme artwork is decorative; entry photos need their own alt text.
  image.decoding='async';
  element.dataset.theme=theme.id;
  element.dataset.scene=scene.id;
}

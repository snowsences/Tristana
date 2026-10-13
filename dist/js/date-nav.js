import {daysInYear,filled,status,validDay} from './core.js?v=71';

export function createDateNavigator({document,getEntries,getToday,getSelected,getOwner,getPhotoURL,displayDate,onSelect,onError}) {
  const dialog=document.getElementById('time-dialog'),content=document.getElementById('time-content');
  const yearSelect=document.getElementById('time-year'),monthSelect=document.getElementById('time-month');
  const views=[...dialog.querySelectorAll('[data-time-view]')];
  let year=Number(getToday().slice(0,4)),mode='months',generation=0;
  const entry=date=>getEntries().get(date)||{date};
  function stamp(date,options){return displayDate(date,options);}
  function years(){
    const current=Number(getToday().slice(0,4));
    const earliest=Math.min(current-5,...[...getEntries().keys()].filter(validDay).map(d=>Number(d.slice(0,4))));
    yearSelect.replaceChildren();
    for(let value=current;value>=Math.max(1900,earliest);value--){const option=document.createElement('option');option.value=value;option.textContent=value;yearSelect.append(option);}
    if(![...yearSelect.options].some(o=>Number(o.value)===year)){const option=document.createElement('option');option.value=year;option.textContent=year;yearSelect.append(option);}
    yearSelect.value=year;
  }
  function weekdays(){const row=document.createElement('div');row.className='time-weekdays';row.setAttribute('aria-hidden','true');for(const day of ['M','T','W','T','F','S','S']){const span=document.createElement('span');span.textContent=day;row.append(span);}return row;}
  async function choose(date){if(!validDay(date)||date>getToday()||!getOwner())return;await dialog.close('choose');onSelect(date);}
  function calendar(month,{mini=false}={}){
    const first=`${year}-${String(month).padStart(2,'0')}-01`,dates=daysInYear(year).filter(d=>Number(d.slice(5,7))===month);
    const block=document.createElement('section');block.className='time-calendar';
    const heading=document.createElement('h3');heading.textContent=stamp(first,{month:mini?'short':'long'});block.append(heading,weekdays());
    const grid=document.createElement('div');grid.className='time-days'+(mini?' time-days-mini':'');
    const offset=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
    for(let i=0;i<offset;i++)grid.append(document.createElement('span'));
    for(const date of dates){const button=document.createElement('button');button.type='button';button.dataset.date=date;button.className='time-day '+status(entry(date),date,getToday());button.textContent=Number(date.slice(-2));button.disabled=date>getToday();
      button.setAttribute('aria-label',stamp(date,{weekday:'long',month:'long',day:'numeric',year:'numeric'})+', '+(filled(entry(date))?'saved':'empty'));
      if(date===getSelected())button.setAttribute('aria-current','date');button.onclick=()=>choose(date);grid.append(button);}
    block.append(grid);return block;
  }
  function loadMosaic(image,photo,serial,owner){
    getPhotoURL(photo,'thumbnail').then(url=>{if(url&&serial===generation&&dialog.open&&getOwner()===owner&&image.isConnected){image.src=url;image.classList.add('is-ready');}}).catch(error=>{if(serial===generation&&dialog.open&&getOwner()===owner)onError(error);});
  }
  function render(){
    const serial=++generation,owner=getOwner(),scroll=dialog.scrollTop;content.replaceChildren();years();
    for(const button of views)button.setAttribute('aria-pressed',String(button.dataset.timeView===mode));
    monthSelect.parentElement.hidden=mode!=='month';
    document.getElementById('time-prev-year').disabled=year<=1900;
    document.getElementById('time-next-year').disabled=year>=Number(getToday().slice(0,4));
    content.className='time-content time-'+mode;
    if(mode==='month'){content.append(calendar(Number(monthSelect.value)));dialog.scrollTop=scroll;return;}
    for(let month=1;month<=12;month++){
      if(mode==='year'){content.append(calendar(month,{mini:true}));continue;}
      const first=`${year}-${String(month).padStart(2,'0')}-01`,prefix=first.slice(0,7);
      const button=document.createElement('button');button.type='button';button.className='time-month-card';button.disabled=first>getToday();
      const title=document.createElement('span');title.className='time-month-name';title.textContent=stamp(first,{month:'long'});
      const mosaic=document.createElement('span');mosaic.className='time-mosaic';mosaic.setAttribute('aria-hidden','true');
      const photos=[...getEntries().values()].filter(e=>e.date.startsWith(prefix)&&e.photo).sort((a,b)=>a.date.localeCompare(b.date));
      const sample=photos.length<=4?photos:[0,1,2,3].map(i=>photos[Math.round(i*(photos.length-1)/3)]);
      for(let i=0;i<4;i++){const tile=document.createElement('span');if(sample[i]){const image=document.createElement('img');image.alt='';image.decoding='async';tile.append(image);loadMosaic(image,sample[i].photo,serial,owner);}mosaic.append(tile);}
      button.append(mosaic,title);button.setAttribute('aria-label',stamp(first,{month:'long',year:'numeric'})+', select a day');
      button.onclick=()=>{monthSelect.value=month;mode='month';render();};content.append(button);
    }dialog.scrollTop=scroll;
  }
  for(let month=1;month<=12;month++){const option=document.createElement('option');option.value=month;option.textContent=stamp(`2026-${String(month).padStart(2,'0')}-01`,{month:'long'});monthSelect.append(option);}
  for(const button of views)button.onclick=()=>{mode=button.dataset.timeView;render();};
  yearSelect.onchange=()=>{year=Number(yearSelect.value);render();};monthSelect.onchange=render;
  document.getElementById('time-prev-year').onclick=()=>{year=Math.max(1900,year-1);render();};
  document.getElementById('time-next-year').onclick=()=>{year=Math.min(Number(getToday().slice(0,4)),year+1);render();};
  document.getElementById('close-time').onclick=()=>dialog.close('cancel');
  dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close('cancel');});
  dialog.addEventListener('close',()=>{generation++;content.replaceChildren();});
  return {open(){if(!getOwner())return;year=Number(getSelected().slice(0,4));monthSelect.value=Number(getSelected().slice(5,7));mode='months';dialog.showModal();render();},refresh(){if(dialog.open)render();},reset(){generation++;content.replaceChildren();if(dialog.open)(dialog.closeImmediately||dialog.close).call(dialog,'cancel');}};
}

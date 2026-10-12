import {filled,validDay} from './core.js';
export function createMemories({element,daySection,getEntries,getPhotoURL,getPhotoFilter=()=> 'none',getPhotoIdentity=photo=>photo?.localId,getAccent=()=> '',displayDate,onDayChange,onPhoto}) {
  const doc=element.ownerDocument,win=doc.defaultView,records=new Map(),requestedEmpty=new Set();
  let active=false,selected=null,limit=60,frame,settleTimer,programmatic=false,rendering=false;
  const empty=doc.createElement('p');empty.className='memories-empty';empty.textContent='Your days will appear here.';element.append(empty);
  const observer=win.IntersectionObserver?new win.IntersectionObserver(changes=>{for(const change of changes){const record=records.get(change.target.dataset.date);if(!record)continue;record.visible=change.isIntersecting;if(record.visible&&active)loadPhoto(record);else if(!record.visible){record.image?.remove();record.image=null;record.loaded=null;}}},{rootMargin:'450px 0px'}):null;
  const reduced=()=>win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function getEntry(date){return getEntries().get(date)||{date};}
  function allDates(){return [...new Set([...getEntries().values()].filter(e=>validDay(e.date)&&filled(e)).map(e=>e.date).concat([...requestedEmpty]))].sort().reverse();}
  function pinOffset(){const top=parseFloat(win.getComputedStyle(daySection).top)||0;return top+daySection.getBoundingClientRect().height+12;}
  function focusLine(){const rect=daySection.getBoundingClientRect();return Math.max(pinOffset(),rect.bottom+12);}
  function loadPhoto(record){const photo=getEntry(record.date).photo,identity=getPhotoIdentity(photo);if(!active||!photo||record.loaded===identity)return;record.loaded=identity;
    getPhotoURL(photo,'thumbnail').then(url=>{if(!url||!record.node.isConnected||record.loaded!==identity||getPhotoIdentity(getEntry(record.date).photo)!==identity)return;
      const image=doc.createElement('img');image.alt='';image.decoding='async';image.style.filter=getPhotoFilter(record.date);image.src=url;record.image?.remove();record.image=image;record.photo.append(image);
    }).catch(()=>{if(record.loaded===identity)record.loaded=null;});
  }
  function update(record){const entry=getEntry(record.date);record.good.hidden=!entry.good?.trim();record.learned.hidden=!entry.learned?.trim();
    record.good.querySelector('.memory-text').textContent=entry.good||'';record.learned.querySelector('.memory-text').textContent=entry.learned||'';
    record.empty.hidden=Boolean(filled(entry));record.photo.hidden=!entry.photo;record.node.classList.toggle('has-photo',Boolean(entry.photo));
    const accent=getAccent(record.date);if(accent)record.node.style.setProperty('--memory-accent',accent);
    if(record.identity!==getPhotoIdentity(entry.photo)){record.identity=getPhotoIdentity(entry.photo);record.loaded=null;record.image?.remove();record.image=null;}
    if(record.image)record.image.style.filter=getPhotoFilter(record.date);
    if(record.visible)loadPhoto(record);
  }
  function make(date){const node=doc.createElement('article');node.className='memory-card';node.dataset.date=date;node.setAttribute('aria-label',displayDate(date,{weekday:'long',month:'long',day:'numeric',year:'numeric'}));
    const stamp=doc.createElement('time');stamp.className='memory-date';stamp.dateTime=date;
    for(const [className,options] of [['memory-weekday',{weekday:'short'}],['memory-day',{day:'numeric'}],['memory-month',{month:'short'}]]){const label=doc.createElement('span');label.className=className;label.textContent=displayDate(date,options).toUpperCase();stamp.append(label);}
    const sentences=doc.createElement('div');sentences.className='memory-sentences';
    const paragraph=(className,label)=>{const p=doc.createElement('p');p.className=className;const prefix=doc.createElement('span');prefix.className='sr-only';prefix.textContent=label+': ';const text=doc.createElement('span');text.className='memory-text';p.append(prefix,text);sentences.append(p);return p;};
    const good=paragraph('memory-good','Something good'),learned=paragraph('memory-learned','Something learned');const absent=doc.createElement('p');absent.className='memory-no-entry';absent.textContent='Nothing saved for this day.';sentences.append(absent);
    const photo=doc.createElement('button');photo.type='button';photo.className='memory-photo';photo.setAttribute('aria-label','View photograph for '+displayDate(date,{month:'long',day:'numeric',year:'numeric'}));photo.onclick=()=>onPhoto(date,photo);
    node.addEventListener('click',event=>{if(!event.target.closest('button'))select(date,{notify:true});});
    node.append(stamp,sentences,photo);const record={date,node,good,learned,empty:absent,photo,visible:!observer};records.set(date,record);update(record);observer?.observe(node);return record;
  }
  function select(date,{notify=false}={}){const changed=selected!==date;records.get(selected)?.node.removeAttribute('aria-current');selected=date;records.get(date)?.node.setAttribute('aria-current','date');if(changed&&notify)onDayChange(date);}
  function render(){if(rendering)return;rendering=true;
    try{
      const anchor=records.get(selected)?.node,oldTop=anchor?.getBoundingClientRect().top,oldScroll=win.scrollY;
      const dates=allDates().slice(0,limit),wanted=new Set(dates);let cursor=element.firstElementChild;if(cursor===empty)cursor=empty.nextElementSibling;
      for(const date of dates){const record=records.get(date)||make(date);update(record);if(record.node!==cursor)element.insertBefore(record.node,cursor);cursor=record.node.nextElementSibling;}
      for(const [date,record] of records)if(!wanted.has(date)){observer?.unobserve(record.node);record.node.remove();records.delete(date);}
      empty.hidden=dates.length>0;select(selected);
      if(active&&oldScroll>pinOffset()&&anchor?.isConnected&&oldTop!==undefined){const delta=anchor.getBoundingClientRect().top-oldTop;if(Math.abs(delta)>1)win.scrollTo({top:oldScroll+delta,behavior:'auto'});}
    }finally{rendering=false;}
  }
  function visibleDate(){const cards=[...element.querySelectorAll('.memory-card')];if(!cards.length)return null;const max=Math.max(0,doc.documentElement.scrollHeight-win.innerHeight);
    if(max<=1)return records.has(selected)?selected:cards[0].dataset.date;
    if(win.scrollY>=max-2&&win.scrollY>0)return cards.at(-1).dataset.date;
    const line=focusLine();let low=0,high=cards.length-1,index=0;
    while(low<=high){const middle=(low+high)>>1;if(cards[middle].getBoundingClientRect().top<=line){index=middle;low=middle+1;}else high=middle-1;}
    if(cards[index].getBoundingClientRect().bottom<=line&&cards[index+1])index++;
    return cards[index].dataset.date;
  }
  function readViewport(){if(!active||element.hidden)return;
    const last=element.lastElementChild;if(last&&last.getBoundingClientRect().bottom<win.innerHeight+700&&records.size<allDates().length){limit+=40;render();}
    if(!observer)for(const record of records.values())loadPhoto(record);
    if(!programmatic){const date=visibleDate();if(date)select(date,{notify:true});}
  }
  function onScroll(){if(!active)return;win.cancelAnimationFrame(frame);frame=win.requestAnimationFrame(readViewport);
    if(programmatic){clearTimeout(settleTimer);settleTimer=setTimeout(()=>{programmatic=false;},160);}
  }
  const interrupt=event=>{if(active&&!(event.target?.nodeType&&daySection.contains(event.target))){programmatic=false;clearTimeout(settleTimer);}};
  win.addEventListener('scroll',onScroll,{passive:true});win.addEventListener('resize',onScroll);win.addEventListener('wheel',interrupt,{passive:true});win.addEventListener('pointerdown',interrupt,{passive:true});
  return {
    render,
    update(dates){if(!dates)return render();let reconcile=false;for(const date of dates){const record=records.get(date),entry=getEntry(date);if(record){if(!filled(entry)&&!requestedEmpty.has(date))reconcile=true;else update(record);}else if(filled(entry))reconcile=true;}if(reconcile)render();},
    ensure(date){const index=allDates().indexOf(date);if(index>=limit){limit=index+21;render();}},
    select,
    setActive(value){active=value;if(active){for(const record of records.values())if(record.visible)loadPhoto(record);win.requestAnimationFrame(readViewport);}else{programmatic=false;clearTimeout(settleTimer);}},
    scrollTo(date){if(!validDay(date))return;requestedEmpty.add(date);const index=allDates().indexOf(date);limit=Math.max(limit,index+21);render();select(date);const record=records.get(date);if(!record)return;
      const max=Math.max(0,doc.documentElement.scrollHeight-win.innerHeight),top=Math.min(max,Math.max(0,win.scrollY+record.node.getBoundingClientRect().top-pinOffset()));programmatic=true;win.scrollTo({top,behavior:reduced()?'auto':'smooth'});
      clearTimeout(settleTimer);settleTimer=setTimeout(()=>{programmatic=false;},700);
    },
    latest(){return allDates()[0]||null;},
    reset(){active=false;programmatic=false;selected=null;limit=60;clearTimeout(settleTimer);win.cancelAnimationFrame(frame);observer?.disconnect();for(const record of records.values())record.node.remove();records.clear();requestedEmpty.clear();empty.hidden=false;},
    dispose(){this.reset();win.removeEventListener('scroll',onScroll);win.removeEventListener('resize',onScroll);win.removeEventListener('wheel',interrupt);win.removeEventListener('pointerdown',interrupt);},
  };
}

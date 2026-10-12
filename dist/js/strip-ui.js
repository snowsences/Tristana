import {shiftDay,filled,status} from './core.js';
export function createDayStrip({element,getEntry,getToday,displayDate,getPhotoURL,getPhotoFilter=()=> 'none',onSelect}) {
  const doc=element.ownerDocument,win=doc.defaultView;let selected,first,last,scrollFrame,observer;const tiles=new Map();
  const observe=win.IntersectionObserver?new win.IntersectionObserver(changes=>{for(const item of changes)if(item.isIntersecting)loadPhoto(item.target);},{root:element,rootMargin:'0px 160px'}):null;
  function loadPhoto(button){const photo=getEntry(button.dataset.date).photo;if(!photo||button._loaded===photo.localId)return;button._loaded=photo.localId;const identity=photo.localId;
    getPhotoURL(photo,'thumbnail').then(url=>{if(!url||!button.isConnected||getEntry(button.dataset.date).photo?.localId!==identity)return;let img=button.querySelector('img');if(!img){img=doc.createElement('img');img.alt='';img.decoding='async';button.querySelector('.tile-image').append(img);}img.style.filter=getPhotoFilter(button.dataset.date);img.src=url;}).catch(()=>{button._loaded=null;});
  }
  function update(button){const date=button.dataset.date,e=getEntry(date),state=status(e,date,getToday());
    button.setAttribute('aria-pressed',String(date===selected));button.setAttribute('aria-label',displayDate(date,{weekday:'long',month:'long',day:'numeric'})+', '+state);button.disabled=date>getToday()&&!filled(e);
    const image=button.querySelector('.tile-image');const img=image.querySelector('img');if(img)img.style.filter=getPhotoFilter(date);image.className='tile-image '+state;
    let dot=image.querySelector('.day-state');if(filled(e)&&!dot){dot=doc.createElement('i');dot.className='day-state';image.append(dot);}if(!filled(e))dot?.remove();
    if(button._identity!==e.photo?.localId){button._identity=e.photo?.localId;button._loaded=null;image.querySelector('img')?.remove();if(e.photo){if(observe)observe.observe(button);else loadPhoto(button);}}
    if(e.photo&&button._loaded!==e.photo.localId){const r=button.getBoundingClientRect(),er=element.getBoundingClientRect();if(button.isConnected&&r.right>=er.left-160&&r.left<=er.right+160)loadPhoto(button);}
  }
  function make(date){const button=doc.createElement('button');button.className='day-tile';button.dataset.date=date;button.type='button';
    const image=doc.createElement('span');image.className='tile-image';image.textContent=displayDate(date,{day:'numeric'});
    const label=doc.createElement('span');label.className='tile-date';label.textContent=displayDate(date,{month:'short',day:'numeric'});button.append(image,label);button.onclick=()=>onSelect(date);tiles.set(date,button);update(button);return button;
  }
  function fill(from,to,prepend=false){const fragment=doc.createDocumentFragment();for(let date=from;date<=to;date=shiftDay(date,1))fragment.append(make(date));if(prepend)element.prepend(fragment);else element.append(fragment);}
  function center(behavior='auto'){const tile=tiles.get(selected);if(!tile)return;const left=tile.offsetLeft-element.clientWidth/2+tile.clientWidth/2;if(element.scrollTo)element.scrollTo({left,behavior});else element.scrollLeft=left;}
  function extend(){if(!first||element.hidden||!element.clientWidth)return;const max=element.scrollWidth-element.clientWidth;if(max<=0)return;
    if(element.scrollLeft<160){const anchor=element.firstElementChild;const left=anchor.getBoundingClientRect().left,newFirst=shiftDay(first,-14);fill(newFirst,shiftDay(first,-1),true);first=newFirst;element.scrollLeft+=anchor.getBoundingClientRect().left-left;trim('end');}
    else if(max-element.scrollLeft<160&&last<shiftDay(getToday(),7)){const candidate=shiftDay(last,14),ceiling=shiftDay(getToday(),7),newLast=candidate<ceiling?candidate:ceiling;fill(shiftDay(last,1),newLast);last=newLast;trim('start');}
  }
  function trim(side){while(tiles.size>91){const button=side==='start'?element.firstElementChild:element.lastElementChild;const anchor=element.children[1],left=anchor?.getBoundingClientRect().left;tiles.delete(button.dataset.date);observe?.unobserve(button);button.remove();if(side==='start'&&anchor)element.scrollLeft+=anchor.getBoundingClientRect().left-left;}first=element.firstElementChild?.dataset.date;last=element.lastElementChild?.dataset.date;}
  element.addEventListener('scroll',()=>{win.cancelAnimationFrame(scrollFrame);scrollFrame=win.requestAnimationFrame(extend);},{passive:true});
  return {
    render(date,{recenter=false,animate=false}={}){const prior=selected;selected=date;
      if(!first||((prior!==date||recenter)&&(date<first||date>last))){observe?.disconnect();tiles.clear();element.replaceChildren();first=shiftDay(date,-14);last=shiftDay(date,7);fill(first,last);recenter=true;}
      for(const button of tiles.values())update(button);
      if(recenter||prior!==date)win.requestAnimationFrame(()=>{center(animate&&!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'smooth':'auto');for(const button of tiles.values())update(button);});
    },
    update(dates){for(const date of dates||tiles.keys()){const button=tiles.get(date);if(button)update(button);}},
    reset(){observe?.disconnect();tiles.clear();element.replaceChildren();first=last=selected=null;},
  };
}

// Local, deterministic coarse-to-fine brush rendering, inspired by Hertzmann's
// multi-size painterly rendering. Originals and their alpha are never changed.
export const ARTISTIC_VERSION='paint-v2-brush';
export const artisticStrength=value=>Math.max(0,Math.min(100,Math.round((Number(value)||0)/5)*5));
export function* paintSteps(source,width,height,strength=55) {
  const amount=artisticStrength(strength)/100,result=new Uint8ClampedArray(source);
  if(!amount||!width||!height)return result;
  const stride=width+1,size=stride*(height+1),channels=Array.from({length:3},()=>new Float64Array(size));
  for(let y=0;y<height;y++){
    const row=[0,0,0];
    for(let x=0;x<width;x++){
      const pixel=(y*width+x)*4,i=(y+1)*stride+x+1;
      for(let c=0;c<3;c++){row[c]+=source[pixel+c];channels[c][i]=channels[c][i-stride]+row[c];}
    }
    if(y%32===31)yield;
  }
  const random=(x,y,salt=0)=>{
    let seed=Math.imul(x+1,374761393)^Math.imul(y+1,668265263)^Math.imul(salt+1,1442695041);
    seed=Math.imul(seed^(seed>>>13),1274126177);return ((seed^(seed>>>16))>>>0)/4294967295;
  };
  const scale=Math.max(.3,Math.min(width,height)/500),base=scale*(.65+amount*.8);
  const painting=new Float32Array(source.length),reference=new Float32Array(source.length);
  const luminance=(x,y)=>{const p=(Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x)))*4;return reference[p]*.2126+reference[p+1]*.7152+reference[p+2]*.0722;};
  // Build a smooth reference at each brush size. Smaller brushes are placed only
  // where the existing painting misses meaningful color/detail in that reference.
  for(const [layer,factor] of [10,5,2].entries()){
    const radius=Math.max(1.1,base*factor),blur=Math.max(1,Math.round(radius*.65));
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        const x0=Math.max(0,x-blur),x1=Math.min(width-1,x+blur),y0=Math.max(0,y-blur),y1=Math.min(height-1,y+blur),n=(x1-x0+1)*(y1-y0+1),p=(y*width+x)*4;
        for(let c=0;c<3;c++){const a=channels[c];reference[p+c]=(a[(y1+1)*stride+x1+1]-a[y0*stride+x1+1]-a[(y1+1)*stride+x0]+a[y0*stride+x0])/n;if(layer===0)painting[p+c]=reference[p+c];}
      }
      if(y%32===31)yield;
    }
    const spacing=Math.max(2,Math.round(radius*.95)),strokes=[];
    for(let y=0;y<height;y+=spacing){
      for(let x=0;x<width;x+=spacing){
        const cx=Math.min(width-1,x+Math.floor(random(x,y,layer)*spacing)),cy=Math.min(height-1,y+Math.floor(random(y,x,layer+9)*spacing));
        let best=-1,bx=cx,by=cy;
        // Select a high-error point within the cell, rather than recreating a grid.
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          const sx=Math.max(0,Math.min(width-1,cx+dx*Math.floor(spacing/3))),sy=Math.max(0,Math.min(height-1,cy+dy*Math.floor(spacing/3))),p=(sy*width+sx)*4;
          const error=(Math.abs(reference[p]-painting[p])+Math.abs(reference[p+1]-painting[p+1])+Math.abs(reference[p+2]-painting[p+2]))/3;
          if(error>best){best=error;bx=sx;by=sy;}
        }
        if(layer===0||best>7+amount*12)strokes.push({x:bx,y:by,order:random(cx,cy,layer+21)});
      }
      if(y%(spacing*16)===0)yield;
    }
    strokes.sort((a,b)=>a.order-b.order);
    for(let index=0;index<strokes.length;index++){
      const {x,y}=strokes[index],p=(y*width+x)*4,step=Math.max(1,Math.round(radius*.5));
      const gx=luminance(x+step,y)-luminance(x-step,y),gy=luminance(x,y+step)-luminance(x,y-step);
      const angle=Math.hypot(gx,gy)>4?Math.atan2(gy,gx)+Math.PI/2:random(x,y,41)*Math.PI;
      const cos=Math.cos(angle),sin=Math.sin(angle),long=radius*(1.55+random(x,y,17)*.6),short=radius*.7,extent=Math.ceil(long);
      const tint=(random(x,y,31)-.5)*3;
      for(let yy=Math.max(0,y-extent);yy<=Math.min(height-1,y+extent);yy++)for(let xx=Math.max(0,x-extent);xx<=Math.min(width-1,x+extent);xx++){
        const dx=xx-x,dy=yy-y,u=(dx*cos+dy*sin)/long,v=(-dx*sin+dy*cos)/short,d=u*u+v*v;
        if(d>=1)continue;
        const q=(yy*width+xx)*4;
        // Avoid drawing across strong color boundaries (faces, silhouettes, etc.).
        const difference=(Math.abs(reference[q]-reference[p])+Math.abs(reference[q+1]-reference[p+1])+Math.abs(reference[q+2]-reference[p+2]))/3;
        const edge=Math.max(0,1-difference/55);
        const bristle=1-.07*Math.cos(v*24+random(x,y,71)*6.28);
        const opacity=Math.min(1,(1-d)*5)*.88*edge*bristle;
        for(let c=0;c<3;c++)painting[q+c]+=(reference[p+c]+tint-painting[q+c])*opacity;
      }
      if(index%128===127)yield;
    }
  }
  // Strength primarily controls brush size; only low strengths crossfade. No photographic
  // microtexture is reintroduced. Fine paper tooth stays below visible noise.
  const mix=Math.min(1,amount/.35);
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const p=(y*width+x)*4,tooth=(random(x,y,99)-.5)*1.2*amount;
      for(let c=0;c<3;c++)result[p+c]=source[p+c]*(1-mix)+painting[p+c]*mix+tooth;
    }
    if(y%32===31)yield;
  }
  return result;
}
export function paintPixels(source,width,height,strength) {
  const steps=paintSteps(source,width,height,strength);let next;
  do{next=steps.next();}while(!next.done);return next.value;
}

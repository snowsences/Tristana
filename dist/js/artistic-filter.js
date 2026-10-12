// Deterministic painterly abstraction. It never reads or writes journal data.
export const ARTISTIC_VERSION='paint-v1';
export const artisticStrength=value=>Math.max(0,Math.min(100,Math.round((Number(value)||0)/5)*5));
export function* paintSteps(source,width,height,strength=55) {
  const amount=artisticStrength(strength)/100;
  const result=new Uint8ClampedArray(source);
  if(!amount){return result;}
  const stride=width+1,size=stride*(height+1),red=new Float64Array(size),green=new Float64Array(size),blue=new Float64Array(size),square=new Float64Array(size);
  for(let y=0;y<height;y++){
    let r=0,g=0,b=0,l2=0;
    for(let x=0;x<width;x++){
      const pixel=(y*width+x)*4,l=.2126*source[pixel]+.7152*source[pixel+1]+.0722*source[pixel+2],i=(y+1)*stride+x+1;
      r+=source[pixel];g+=source[pixel+1];b+=source[pixel+2];l2+=l*l;
      red[i]=red[i-stride]+r;green[i]=green[i-stride]+g;blue[i]=blue[i-stride]+b;square[i]=square[i-stride]+l2;
    }
    if(y%32===31)yield;
  }
  const radius=Math.max(2,Math.round(Math.min(width,height)/150*(.7+amount*.65)));
  const sum=(a,x0,y0,x1,y1)=>a[(y1+1)*stride+x1+1]-a[y0*stride+x1+1]-a[(y1+1)*stride+x0]+a[y0*stride+x0];
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const left=Math.max(0,x-radius),right=Math.min(width-1,x+radius),top=Math.max(0,y-radius),bottom=Math.min(height-1,y+radius),pixel=(y*width+x)*4;
      let rr=0,gg=0,bb=0,total=0;
      // Softly weight the four local regions instead of abruptly selecting one.
      // This avoids the block boundaries of a basic Kuwahara filter.
      for(let quadrant=0;quadrant<4;quadrant++){
        const x0=quadrant&1?x:left,x1=quadrant&1?right:x,y0=quadrant&2?y:top,y1=quadrant&2?bottom:y,n=(x1-x0+1)*(y1-y0+1);
        const r=sum(red,x0,y0,x1,y1)/n,g=sum(green,x0,y0,x1,y1)/n,b=sum(blue,x0,y0,x1,y1)/n,l=.2126*r+.7152*g+.0722*b;
        const variance=Math.max(0,sum(square,x0,y0,x1,y1)/n-l*l),weight=1/((1+variance/70)*(1+variance/70));
        rr+=r*weight;gg+=g*weight;bb+=b*weight;total+=weight;
      }
      const mix=amount*.94;
      let seed=Math.imul(x+1,374761393)^Math.imul(y+1,668265263);seed=Math.imul(seed^(seed>>>13),1274126177);seed^=seed>>>16;
      const grain=((seed>>>0)/4294967295-.5)*2.2*amount;
      result[pixel]=source[pixel]*(1-mix)+rr/total*mix+grain;
      result[pixel+1]=source[pixel+1]*(1-mix)+gg/total*mix+grain;
      result[pixel+2]=source[pixel+2]*(1-mix)+bb/total*mix+grain;
    }
    if(y%32===31)yield;
  }
  return result;
}
export function paintPixels(source,width,height,strength) {
  const steps=paintSteps(source,width,height,strength);let next;
  do{next=steps.next();}while(!next.done);return next.value;
}

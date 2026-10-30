// Analytic, camera-space two-bone IK using cosine law and an elbow pole hint.
// The return buffer is caller-owned to avoid allocating inside animation frames.
export function solveTwoBoneElbow(shoulder,wrist,pole,upper,lower,out=[0,0,0]){
  const dx=wrist[0]-shoulder[0],dy=wrist[1]-shoulder[1],dz=wrist[2]-shoulder[2];
  const dist=Math.max(1e-6,Math.hypot(dx,dy,dz));
  // Degenerate zero-length aim has no usable axis; retain a finite stable elbow.
  if(Math.hypot(dx,dy,dz)<1e-6){
    out[0]=shoulder[0]+upper;out[1]=shoulder[1];out[2]=shoulder[2];
    return out;
  }
  const reach=Math.min(dist,upper+lower-1e-5);
  const ux=dx/dist,uy=dy/dist,uz=dz/dist;
  let px=pole[0]-shoulder[0],py=pole[1]-shoulder[1],pz=pole[2]-shoulder[2];
  const dot=px*ux+py*uy+pz*uz;
  px-=dot*ux;py-=dot*uy;pz-=dot*uz;
  let length=Math.hypot(px,py,pz);
  if(length<1e-6){
    px=-uy;py=ux;pz=0;length=Math.hypot(px,py,pz);
    if(length<1e-6){px=0;py=-uz;pz=uy;length=Math.hypot(px,py,pz);}
  }
  const along=Math.max(-upper,Math.min(upper,(upper*upper-lower*lower+reach*reach)/(2*reach)));
  const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
  out[0]=shoulder[0]+ux*along+px/length*bend;
  out[1]=shoulder[1]+uy*along+py/length*bend;
  out[2]=shoulder[2]+uz*along+pz/length*bend;
  return out;
}

// Deterministic slide dynamics. Mutates ONLY the existing ParkourController
// fields: slideSpeed, slideX, slideZ. PlayerController stays sole position writer.
const DT_LIMIT=.033;
const DRAG=8.5;
const STEER_RATE=.85; // radians/s, prevents snap-turn and backwards exploit.
const finite=value=>Number.isFinite(value)?value:0;
export function advanceSlide(state,desiredX,desiredZ,dt,allowSteer=true){
  const step=Math.max(0,Math.min(DT_LIMIT,finite(dt)));
  const speed=Math.max(0,Math.min(10.1,finite(state.slideSpeed)-DRAG*step));
  state.slideSpeed=speed;
  let x=finite(state.slideX),z=finite(state.slideZ);
  const n=Math.hypot(x,z);
  if(n<1e-5){state.slideX=0;state.slideZ=0;state.slideSpeed=0;return 0;}
  x/=n;z/=n;
  const dx=finite(desiredX),dz=finite(desiredZ),dn=Math.hypot(dx,dz);
  if(step>0&&allowSteer&&dn>.001){
    const tx=dx/dn,tz=dz/dn;
    // atan2(cross,dot) shortest turn, bounded regardless of instant mouse yaw.
    const cross=x*tz-z*tx,dot=x*tx+z*tz;
    const desired=Math.atan2(cross,dot);
    const theta=Math.max(-STEER_RATE*step,Math.min(STEER_RATE*step,desired));
    const c=Math.cos(theta),sn=Math.sin(theta);
    const nextX=x*c-z*sn,nextZ=x*sn+z*c;
    x=nextX;z=nextZ;
  }
  state.slideX=x;state.slideZ=z;
  return speed;
}

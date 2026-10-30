// Camera-only feedback derived from authoritative parkour slide physics.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),safe=v=>Number.isFinite(v)?v:0;
export function slideCameraFeel({speed=0,elapsed=0,slideX=0,slideZ=-1,yaw=0,reducedMotion=false}={}){
 const intensity=clamp((safe(speed)-2.8)/7.3,0,1);
 const entry=1-Math.exp(-16*clamp(safe(elapsed),0,1.5));
 const x=safe(slideX),z=safe(slideZ),m=Math.hypot(x,z),angle=clamp(safe(yaw),-1e4,1e4);
 const lookX=-Math.sin(angle),lookZ=-Math.cos(angle);
 const turn=m>.001?clamp((x*lookZ-z*lookX)/m,-1,1):0;
 const effect=entry*(.55+.45*intensity);
 return {pitch:reducedMotion?0:-.09*effect,
  roll:reducedMotion?0:-.055*turn*entry*(.5+.5*intensity),
  eyeDip:reducedMotion?0:.115*effect,intensity,entry};
}

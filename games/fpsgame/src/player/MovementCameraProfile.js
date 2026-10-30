// S1: Physical-speed-responsive camera feel. This is a presentation target only.
// PlayerController is still the sole movement authority; ADSController writes FOV.
const BOOSTS=Object.freeze({SPRINT:5,WALL_RUN:4,SLIDE:4.5,AIRBORNE:1.5,SWINGING:5.5});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function motionFovTarget({
  speed=0,playerState='IDLE',traversalState=null,
  reducedMotion=false,mission=false,alive=false,interactive=false,contextLost=false
}={}){
  if(reducedMotion||!mission||!alive||!interactive||contextLost||!Number.isFinite(speed))return 0;
  const state=traversalState&&Object.hasOwn(BOOSTS,traversalState)?traversalState:playerState;
  const boost=BOOSTS[state]??0;
  if(!boost)return 0;
  // Avoid 'phantom speed' on collision, when standing still with sprint held.
  const normalized=clamp((speed-2)/4,0,1);
  return boost*normalized;
}

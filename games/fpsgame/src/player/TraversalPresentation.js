// Deterministic, frame-rate independent view feedback.
// Camera yaw and actual player collision height remain owned by other systems.
const LOOK_PITCH=Object.freeze({
  SLIDE:-.05, VAULT:.035, MANTLE:.065, LEDGE_HANG:-.026, WALL_RUN:-.008
});
const IMPULSE=Object.freeze({
  LANDING:-.033, WALL_KICK:.034, VAULT:.014, MANTLE:.021,
  SLIDE:-.018, LEDGE_HANG:-.012, DROP:-.018
});
export class TraversalPresentation {
  constructor(controls){this.controls=controls;this.pitch=0;this.impulse=0;this.travel=0;this.lastEvent=null;}
  onEvent(kind){
    if(kind in IMPULSE){this.impulse=Math.max(-.075,Math.min(.075,this.impulse+IMPULSE[kind]));this.lastEvent=kind;}
  }
  update(dt,state,progress=0){
    const bounded=Math.max(0,Math.min(.033,dt));
    const target=(LOOK_PITCH[state]||0)+(state==='VAULT'||state==='MANTLE'?
      Math.sin(Math.PI*Math.max(0,Math.min(1,progress)))*.016:0);
    this.pitch+=(target+this.impulse-this.pitch)*(1-Math.exp(-15*bounded));
    this.impulse*=Math.exp(-9*bounded);
    if(Math.abs(this.pitch)<.00001&&target===0&&Math.abs(this.impulse)<.00001)this.pitch=0;
    this.controls.setTraversalPitch(this.pitch);
  }
  reset(){this.pitch=0;this.impulse=0;this.lastEvent=null;this.controls.setTraversalPitch(0);}
  snapshot(){return {pitch:this.pitch,impulse:this.impulse,lastEvent:this.lastEvent};}
}

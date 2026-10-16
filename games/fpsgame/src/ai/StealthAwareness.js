// Phase30 opt-in earned sight/noise awareness. Supplies AI knowledge, never LOS,
// motor, damage, firing permission or an unverified player location.
export const AWARENESS_PHASES=Object.freeze({
 UNDETECTED:'UNDETECTED',SUSPICIOUS:'SUSPICIOUS',
 INVESTIGATING:'INVESTIGATING',ALERTED:'ALERTED',
 SEARCHING:'SEARCHING',CALM:'CALM'
});
const bounded=dt=>Number.isFinite(dt)?Math.max(0,Math.min(.033,dt)):0;
const position=point=>Number.isFinite(point?.x)&&Number.isFinite(point?.z)?
  {x:point.x,y:Number.isFinite(point.y)?point.y:0,z:point.z}:null;
export class StealthAwareness {
 constructor({detectSeconds=.68,searchSeconds=3.2,investigateSeconds=2.5,calmSeconds=1.2}={}){
  this.detectSeconds=detectSeconds;this.searchSeconds=searchSeconds;
  this.investigateSeconds=investigateSeconds;this.calmSeconds=calmSeconds;
  this.reset();
 }
 reset(){this.phase=AWARENESS_PHASES.UNDETECTED;this.exposure=0;
  this.searchRemaining=0;this.investigateRemaining=0;
  this.calmRemaining=0;this.lastKnown=null;this.transitions=0;}
 enter(phase){if(this.phase===phase)return;this.phase=phase;this.transitions++;}
 hear(point){
  const heard=position(point);if(!heard)return false;
  if(this.phase===AWARENESS_PHASES.ALERTED)return false;
  this.lastKnown=heard;this.investigateRemaining=this.investigateSeconds;
  this.searchRemaining=this.searchSeconds;
  if(this.phase!==AWARENESS_PHASES.SUSPICIOUS)this.enter(AWARENESS_PHASES.INVESTIGATING);
  return true;
 }
 confirmAttack(point){
  const place=position(point);if(place)this.lastKnown=place;
  this.exposure=this.detectSeconds;this.searchRemaining=this.searchSeconds;
  this.enter(AWARENESS_PHASES.ALERTED);
 }
 advance(dt,{visible=false,position:target=null}={}){
  const step=bounded(dt);
  if(visible){
   const place=position(target);if(!place)return this.phase;
   this.lastKnown=place;this.searchRemaining=this.searchSeconds;
   this.exposure=Math.min(this.detectSeconds,this.exposure+step);
   if(this.exposure>=this.detectSeconds)this.enter(AWARENESS_PHASES.ALERTED);
   else this.enter(AWARENESS_PHASES.SUSPICIOUS);
   return this.phase;
  }
  this.exposure=Math.max(0,this.exposure-step);
  if(this.phase===AWARENESS_PHASES.ALERTED||this.phase===AWARENESS_PHASES.SUSPICIOUS)
   this.enter(AWARENESS_PHASES.SEARCHING);
  if(this.phase===AWARENESS_PHASES.INVESTIGATING){
   this.investigateRemaining=Math.max(0,this.investigateRemaining-step);
   if(this.investigateRemaining===0)this.enter(AWARENESS_PHASES.SEARCHING);
  }else if(this.phase===AWARENESS_PHASES.SEARCHING){
   this.searchRemaining=Math.max(0,this.searchRemaining-step);
   if(this.searchRemaining===0){
    this.calmRemaining=this.calmSeconds;
    this.enter(AWARENESS_PHASES.CALM);
   }
  }else if(this.phase===AWARENESS_PHASES.CALM){
   this.calmRemaining=Math.max(0,this.calmRemaining-step);
   if(this.calmRemaining===0){this.lastKnown=null;this.enter(AWARENESS_PHASES.UNDETECTED);}
  }
  return this.phase;
 }
 snapshot(){return {phase:this.phase,exposure:this.exposure,
  searchRemaining:this.searchRemaining,investigateRemaining:this.investigateRemaining,
  calmRemaining:this.calmRemaining,lastKnown:this.lastKnown?{...this.lastKnown}:null,
  transitions:this.transitions};}
}

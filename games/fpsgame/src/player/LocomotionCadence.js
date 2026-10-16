// Emits bounded movement steps from simulated dt, not wall-clock time or render frames.
export class LocomotionCadence {
  constructor(){this.elapsed=0;this.steps=0;this.lastPeriod=0;}
  update(dt,speed,state,grounded){
    const valid=grounded&&(state==='WALK'||state==='SPRINT')&&speed>.22;
    if(!valid){this.elapsed=0;return false;}
    const period=state==='SPRINT'?.31:.45;
    this.lastPeriod=period;
    this.elapsed+=Math.min(.033,Math.max(0,dt));
    if(this.elapsed<period)return false;
    this.elapsed%=period;this.steps++;return true;
  }
  reset(){this.elapsed=0;}
  snapshot(){return {steps:this.steps,period:this.lastPeriod};}
}

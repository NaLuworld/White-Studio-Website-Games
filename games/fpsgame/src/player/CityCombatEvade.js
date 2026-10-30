// City-only tactical escape. Dodge input never bypasses swept motor geometry.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:0));
export class CityCombatEvade {
  constructor({duration=.42,cooldown=4.8,damageScale=.32}={}){
    this.duration=duration;this.cooldownDuration=cooldown;this.damageScale=damageScale;
    this.activeRemaining=0;this.cooldownRemaining=0;this.uses=0;
  }
  start({grounded=true,alive=true,blocked=false}={}){
    if(!grounded||!alive||blocked||this.cooldownRemaining>0)return false;
    this.activeRemaining=this.duration;this.cooldownRemaining=this.cooldownDuration;
    this.uses++;return true;
  }
  step(dt){
    const delta=clamp(dt,0,.033);
    this.activeRemaining=Math.max(0,this.activeRemaining-delta);
    this.cooldownRemaining=Math.max(0,this.cooldownRemaining-delta);
  }
  get active(){return this.activeRemaining>0;}
  get damageFactor(){return this.active?this.damageScale:1;}
  reset(){this.activeRemaining=0;this.cooldownRemaining=0;}
  snapshot(){return {active:this.active,time:Number(this.activeRemaining.toFixed(3)),
    cooldown:Number(this.cooldownRemaining.toFixed(3)),uses:this.uses};}
}

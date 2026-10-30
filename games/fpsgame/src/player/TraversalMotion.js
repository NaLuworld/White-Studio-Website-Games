const smooth=t=>t*t*(3-2*t);
export class TraversalMotion {
  constructor(){this.active=false;this.kind=null;this.progress=0;this.duration=0;this.start=null;this.target=null;this.peak=0;}
  begin(kind,start,target,peak,duration){
    this.kind=kind;this.active=true;this.progress=0;this.duration=duration;
    this.start={...start};this.target={...target};this.peak=peak+.13;
  }
  cancel(){this.active=false;this.kind=null;this.progress=0;}
  step(dt,player){
    if(!this.active)return 'inactive';
    const next=Math.min(1,this.progress+dt/this.duration);
    const travel=smooth(Math.max(0,(next-.29)/.71)),rise=smooth(Math.min(1,next/.29));
    // Vault: clear the obstacle's rear face with the full capsule before
    // lowering the feet. The earlier .81 descent clipped valid east vaults
    // near progress .855 despite a physically supported landing target.
    // Keep mantle descent unchanged to preserve upper-ledge behavior.
    const descentStart=this.kind==='VAULT'?.86:.81;
    const descend=smooth(Math.max(0,(next-descentStart)/(1-descentStart)));
    const x=this.start.x+(this.target.x-this.start.x)*travel;
    const z=this.start.z+(this.target.z-this.start.z)*travel;
    const y=next<.29?this.start.y+(this.peak-this.start.y)*rise:
      next<.81?this.peak:this.peak+(this.target.y-this.peak)*descend;
    if(!player.tryMoveTo(x,z,y,player.config.standing+.08))return 'blocked';
    this.progress=next;
    return next>=1?'done':'moving';
  }
}

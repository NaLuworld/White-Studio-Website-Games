// Preserve the outward component of a confirmed physical wall-kick briefly.
// PlayerController is the sole transform writer; this only shapes its velocity.
// No auto-jump, teleport, collision bypass, or extra camera authority.
export class WallKickCarry {
  constructor({duration=.22,normalSpeed=4.5}={}){
    this.duration=duration;
    this.normalSpeed=normalSpeed;
    this.reset();
  }
  reset(){
    this.remaining=0;
    this.normalX=0;
    this.normalZ=0;
  }
  begin(nx,nz){
    const size=Math.hypot(nx,nz);
    if(!Number.isFinite(size)||size<.9||size>1.1){this.reset();return false;}
    this.normalX=nx/size;
    this.normalZ=nz/size;
    this.remaining=this.duration;
    return true;
  }
  apply(velocity,dt,{airborne=false}={}){
    if(!airborne||this.remaining<=0){this.reset();return false;}
    const elapsed=Number.isFinite(dt)?Math.max(0,Math.min(.033,dt)):0;
    this.remaining=Math.max(0,this.remaining-elapsed);
    // The normal impulse tapers to zero; steering controls tangential direction.
    const minimumOutward=this.normalSpeed*(this.remaining/this.duration);
    const current=velocity.x*this.normalX+velocity.z*this.normalZ;
    if(current<minimumOutward){
      const add=minimumOutward-current;
      velocity.x+=this.normalX*add;
      velocity.z+=this.normalZ*add;
    }
    if(this.remaining===0)this.reset();
    return minimumOutward>0;
  }
  snapshot(){return {remaining:this.remaining,normal:[this.normalX,this.normalZ]};}
}

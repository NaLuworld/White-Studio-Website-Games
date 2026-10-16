// Local obstacle flanking for an alerted ground-bound enemy.
// Only compact tagged traversal cover is eligible; full station walls are not routed around.
export class EnemyTacticalResponse {
  constructor(id){
    this.id=id;this.blocker=null;this.route=null;this.stage=0;
    this.lastWaypoint=null;this.active=false;
  }
  reset(){
    this.blocker=null;this.route=null;this.stage=0;
    this.lastWaypoint=null;this.active=false;
  }
  plan(position,target,blocker){
    const margin=.85;
    const alongX=Math.abs(target.x-position.x)>=Math.abs(target.z-position.z);
    if(alongX){
      const entry=position.x<blocker.min.x?blocker.min.x-margin:blocker.max.x+margin;
      const exit=target.x<blocker.min.x?blocker.min.x-margin:blocker.max.x+margin;
      const low=blocker.min.z-margin,high=blocker.max.z+margin;
      const lowerCost=Math.abs(position.z-low)+Math.abs(target.z-low);
      const upperCost=Math.abs(position.z-high)+Math.abs(target.z-high);
      const side=lowerCost===upperCost?(this.id%2?low:high):lowerCost<upperCost?low:high;
      return [[entry,side],[exit,side]];
    }
    const entry=position.z<blocker.min.z?blocker.min.z-margin:blocker.max.z+margin;
    const exit=target.z<blocker.min.z?blocker.min.z-margin:blocker.max.z+margin;
    const low=blocker.min.x-margin,high=blocker.max.x+margin;
    const lowerCost=Math.abs(position.x-low)+Math.abs(target.x-low);
    const upperCost=Math.abs(position.x-high)+Math.abs(target.x-high);
    const side=lowerCost===upperCost?(this.id%2?low:high):lowerCost<upperCost?low:high;
    return [[side,entry],[side,exit]];
  }
  steer(position,target,blocker,out){
    this.active=false;this.lastWaypoint=null;
    if(!blocker?.userData?.traversal||!target){this.reset();return false;}
    const dx=blocker.max.x-blocker.min.x,dz=blocker.max.z-blocker.min.z;
    if(dx<=0||dz<=0||dx>4||dz>4||
       (position.x-target.x)**2+(position.z-target.z)**2>18*18){
      this.reset();return false;
    }
    if(this.blocker!==blocker){
      this.blocker=blocker;this.route=this.plan(position,target,blocker);this.stage=0;
    }
    let choice=this.route[this.stage];
    if(this.stage===0&&Math.hypot(choice[0]-position.x,choice[1]-position.z)<.38){
      this.stage=1;choice=this.route[1];
    }
    const vx=choice[0]-position.x,vz=choice[1]-position.z;
    const distance=Math.hypot(vx,vz);
    if(distance<.12)return false;
    out.set(vx/distance*1.9,0,vz/distance*1.9);
    this.lastWaypoint=choice;this.active=true;
    return true;
  }
  snapshot(){
    return {flanking:this.active,stage:this.stage,
      waypoint:this.lastWaypoint?[...this.lastWaypoint]:null};
  }
}

// Deliberately owns no transforms. All travel goes through PlayerController's
// continuous swept collider authority and cannot pass through walls or roofs.
const valid=(point,maxHeight)=>point&&Number.isFinite(point.x)&&Number.isFinite(point.z)&&
  Number.isFinite(point.feetY)&&point.feetY>=0&&point.feetY<=maxHeight;
export class GrappleMotion{
  constructor(player,{speed=11.5,maxRange=18,maxHeight=6,climbClearance=0,escapePoint=null}={}){this.player=player;this.speed=speed;this.maxRange=maxRange;this.maxHeight=maxHeight;this.climbClearance=climbClearance;this.escapePoint=escapePoint;this.active=false;this.target=null;this.waypoint=null;this.waypoints=[];this.lastResult='idle';this.completed=0;this.blocked=0;}
  start(target){
    if(this.active||!valid(target,this.maxHeight)||!Number.isFinite(this.speed)||this.speed<=0)return false;
    const p=this.player,dist=Math.hypot(target.x-p.camera.position.x,target.z-p.camera.position.z,target.feetY-p.feetY);
    if(dist<=.35||dist>this.maxRange||!Number.isFinite(dist))return false;
    this.target={x:target.x,z:target.z,feetY:target.feetY};
    // First clear any overhead balcony slab, THEN climb above the destination.
    // Both segments remain continuous, player-motor-authoritative sweeps.
    const origin={x:p.camera.position.x,z:p.camera.position.z,feetY:p.feetY};
    this.waypoints=[];
    const escape=this.climbClearance>0?this.escapePoint?.(origin):null;
    if(valid(escape,this.maxHeight)&&Math.hypot(escape.x-origin.x,escape.z-origin.z,escape.feetY-origin.feetY)>.04)
      this.waypoints.push({x:escape.x,z:escape.z,feetY:escape.feetY});
    const climbBase=this.waypoints.at(-1)||origin;
    if(this.climbClearance>0)this.waypoints.push({x:climbBase.x,z:climbBase.z,
      feetY:Math.max(origin.feetY,target.feetY)+this.climbClearance});
    this.waypoint=this.waypoints.shift()??null;
    this.active=true;
    this.player.resetFallTracking?.();
    this.lastResult='travel';p.cancelTraversal?.('grapple');
    p.horizontalVelocity?.set?.(0,0,0);p.velocity?.set?.(0,0,0);
    return true;
  }
  cancel(reason='cancel'){
    if(!this.active)return false;
    this.active=false;this.target=null;this.waypoint=null;this.waypoints=[];this.lastResult=reason;
    // Controlled hook travel never counts as freefall. If released in the air,
    // the subsequent physics descent starts at the actual release altitude.
    this.player.resetFallTracking?.();
    return true;
  }
  step(dt){
    if(!this.active)return this.lastResult;
    const step=Number.isFinite(dt)?Math.max(0,Math.min(.033,dt)):0,p=this.player,t=this.target;
    if(!step)return 'travel';
    const goal=this.waypoint||t;
    const dx=goal.x-p.camera.position.x,dz=goal.z-p.camera.position.z,dy=goal.feetY-p.feetY;
    const distance=Math.hypot(dx,dz,dy);
    if(!Number.isFinite(distance)){this.cancel('invalid');return 'invalid';}
    const fraction=Math.min(1,(this.speed*step)/Math.max(.0001,distance));
    const nx=p.camera.position.x+dx*fraction,nz=p.camera.position.z+dz*fraction,ny=p.feetY+dy*fraction;
    if(!p.tryGrappleStep(nx,nz,ny)){this.blocked++;this.cancel('blocked');return 'blocked';}
    if(fraction>=1||distance<.045){
      if(this.waypoint){this.waypoint=this.waypoints.shift()??null;return 'travel';}
      this.completed++;this.cancel('complete');
      const support=p.parkour?.sensor?.support(p.camera.position.x,p.camera.position.z,p.feetY);
      if(support){p.onGround=true;p.velocity.y=0;p.state='LANDING';}
      return 'complete';
    }
    return 'travel';
  }
  snapshot(){return {active:this.active,lastResult:this.lastResult,completed:this.completed,blocked:this.blocked,
    target:this.target?{...this.target}:null,waypoint:this.waypoint?{...this.waypoint}:null};}
}

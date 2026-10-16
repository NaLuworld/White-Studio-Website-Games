// Deliberately owns no transforms. All travel goes through PlayerController's
// continuous swept collider authority and cannot pass through walls or roofs.
const valid=point=>point&&Number.isFinite(point.x)&&Number.isFinite(point.z)&&
  Number.isFinite(point.feetY)&&point.feetY>=0&&point.feetY<=6;
export class GrappleMotion{
  constructor(player,{speed=11.5}={}){this.player=player;this.speed=speed;this.active=false;this.target=null;this.lastResult='idle';this.completed=0;this.blocked=0;}
  start(target){
    if(this.active||!valid(target)||!Number.isFinite(this.speed)||this.speed<=0)return false;
    const p=this.player,dist=Math.hypot(target.x-p.camera.position.x,target.z-p.camera.position.z,target.feetY-p.feetY);
    if(dist<=.35||dist>18||!Number.isFinite(dist))return false;
    this.target={x:target.x,z:target.z,feetY:target.feetY};this.active=true;
    this.lastResult='travel';p.cancelTraversal?.('grapple');
    p.horizontalVelocity?.set?.(0,0,0);p.velocity?.set?.(0,0,0);
    return true;
  }
  cancel(reason='cancel'){if(!this.active)return false;this.active=false;this.target=null;this.lastResult=reason;return true;}
  step(dt){
    if(!this.active)return this.lastResult;
    const step=Number.isFinite(dt)?Math.max(0,Math.min(.033,dt)):0,p=this.player,t=this.target;
    if(!step)return 'travel';
    const dx=t.x-p.camera.position.x,dz=t.z-p.camera.position.z,dy=t.feetY-p.feetY;
    const distance=Math.hypot(dx,dz,dy);
    if(!Number.isFinite(distance)){this.cancel('invalid');return 'invalid';}
    const fraction=Math.min(1,(this.speed*step)/Math.max(.0001,distance));
    const nx=p.camera.position.x+dx*fraction,nz=p.camera.position.z+dz*fraction,ny=p.feetY+dy*fraction;
    if(!p.tryGrappleStep(nx,nz,ny)){this.blocked++;this.cancel('blocked');return 'blocked';}
    if(fraction>=1||distance<.045){this.completed++;this.cancel('complete');return 'complete';}
    return 'travel';
  }
  snapshot(){return {active:this.active,lastResult:this.lastResult,completed:this.completed,blocked:this.blocked,
    target:this.target?{...this.target}:null};}
}

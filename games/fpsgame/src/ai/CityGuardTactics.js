// City-only cover recovery and ordered street flanks. Coordinates are X/Z in
// meters. All movement is requested through EnemyNavigation, never teleported.
const hypot=(a,b)=>Math.hypot(a,b);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const free=(x,z,boxes,r=.46)=>{
  for(const box of boxes){
    // Ignore floor slabs. Full-height walls and cover block standing guards.
    if(box.max.y<=.11||box.min.y>=2.28)continue;
    if(x+r>box.min.x&&x-r<box.max.x&&z+r>box.min.z&&z-r<box.max.z)return false;
  }
  return true;
};
const passage=(origin,goal,boxes)=>{
  const distance=hypot(goal.x-origin.x,goal.z-origin.z);
  if(distance>18)return false;
  for(let k=1,n=Math.ceil(distance/.42);k<=n;k++){
    const t=k/n;
    if(!free(origin.x+(goal.x-origin.x)*t,origin.z+(goal.z-origin.z)*t,boxes))return false;
  }
  return true;
};
export class CityGuardTactics {
  constructor(id){
    this.id=id;this.state='NONE';this.waypoint=null;this.coverId=null;
    this.recoverRemaining=0;this.cooldownRemaining=0;this.orderedRemaining=0;
    this.orderPoint=null;this.flankWaypoint=null;this.flankReplan=0;this.recoveryCount=0;this.flankCount=0;
  }
  reset(){
    this.state='NONE';this.waypoint=null;this.coverId=null;
    this.recoverRemaining=0;this.cooldownRemaining=0;this.orderedRemaining=0;this.orderPoint=null;this.flankWaypoint=null;this.flankReplan=0;
  }
  // Receive only a shooter-observed position. This is not a live wallhack.
  orderFlank(confirmedPosition,seconds=2.7){
    if(!finite(confirmedPosition))return false;
    this.orderedRemaining=clamp(seconds,.25,3.2);
    this.orderPoint={x:confirmedPosition.x,z:confirmedPosition.z};this.flankWaypoint=null;this.flankReplan=0;
    return true;
  }
  takeHit(position,attacker,coverBoxes,collisionBoxes){
    if(!finite(position)||!finite(attacker)||this.cooldownRemaining>0)return false;
    let best=null,score=Infinity;
    for(const box of coverBoxes){
      const cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2;
      const d=hypot(position.x-cx,position.z-cz);
      if(d<1.1||d>12.5)continue;
      const vx=cx-attacker.x,vz=cz-attacker.z,len=hypot(vx,vz);
      if(len<.3)continue;
      const ux=vx/len,uz=vz/len;
      const halfX=(box.max.x-box.min.x)/2,halfZ=(box.max.z-box.min.z)/2;
      const offset=Math.max(Math.abs(ux)*halfX,Math.abs(uz)*halfZ)+.85;
      const goal={x:cx+ux*offset,z:cz+uz*offset};
      if(!free(goal.x,goal.z,collisionBoxes)||!passage(position,goal,collisionBoxes))continue;
      const cost=d+(.8*Math.abs(goal.x-position.x)+.8*Math.abs(goal.z-position.z));
      if(cost<score){best={goal,id:box.userData?.label??null};score=cost;}
    }
    if(!best)return false;
    this.waypoint=best.goal;this.coverId=best.id;
    this.recoverRemaining=2.15;this.cooldownRemaining=6.0;
    this.state='SEEK_COVER';this.recoveryCount++;
    return true;
  }
  step(dt,position,target,desired,collisionBoxes){
    const h=clamp(dt,0,.033);
    this.cooldownRemaining=Math.max(0,this.cooldownRemaining-h);
    this.orderedRemaining=Math.max(0,this.orderedRemaining-h);
    this.flankReplan=Math.max(0,this.flankReplan-h);
    if(this.recoverRemaining>0){
      this.recoverRemaining=Math.max(0,this.recoverRemaining-h);
      const p=this.waypoint,dist=hypot(p.x-position.x,p.z-position.z);
      if(dist>.55&&this.recoverRemaining>.01){
        this.state='SEEK_COVER';
        desired.set((p.x-position.x)/dist*2.35,0,(p.z-position.z)/dist*2.35);
      }else{
        this.state='HOLD_COVER';desired.set(0,0,0);
      }
      if(this.recoverRemaining===0){this.state='NONE';this.waypoint=null;}
      return true;
    }
    // A teammate's actual confirmed firing contact issues a bounded flanking
    // order. Find a locally free sidestep, never cross a wall or jump floors.
    if(this.orderedRemaining>0&&this.orderPoint){
      const p=this.orderPoint,dx=p.x-position.x,dz=p.z-position.z;
      const len=hypot(dx,dz);
      if(len>5&&len<30){
        const sign=this.id%2?1:-1;
        const offset=clamp(len*.38,3.5,7.5);
        if(!this.flankWaypoint||this.flankReplan<=0){
          const lateral={x:position.x+sign*(-dz/len)*offset,
            z:position.z+sign*(dx/len)*offset};
          this.flankWaypoint=free(lateral.x,lateral.z,collisionBoxes)&&
            passage(position,lateral,collisionBoxes)?lateral:null;
          // O(coverBoxes * line-steps) check at most a few times/second,
          // not for each of 16 enemies on every rendering frame.
          this.flankReplan=.48;
        }
        const lateral=this.flankWaypoint;
        if(lateral){
          const dist=hypot(lateral.x-position.x,lateral.z-position.z);
          if(dist>.33){
            desired.set((lateral.x-position.x)/dist*2.0,0,
              (lateral.z-position.z)/dist*2.0);
            this.state='FLANK_ORDER';this.flankCount++;return true;
          }
        }
      }
    }
    this.state='NONE';return false;
  }
  get holding(){return this.state==='HOLD_COVER';}
  snapshot(){return {state:this.state,coverId:this.coverId,waypoint:this.waypoint,
    recovery:Number(this.recoverRemaining.toFixed(2)),cooldown:Number(this.cooldownRemaining.toFixed(2)),
    ordered:Number(this.orderedRemaining.toFixed(2)),recoveries:this.recoveryCount,flanks:this.flankCount};}
}
export const cityTacticalCoverBoxes=boxes=>boxes.filter(b=>
  b.userData?.traversal?.vaultable&&b.max.y<=1.9&&b.min.y>=-.06);

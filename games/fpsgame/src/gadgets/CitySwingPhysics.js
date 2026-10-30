import * as THREE from 'three';

// A taut cable constrains the player to a sphere while gravity and input keep
// tangential velocity. The existing swept player motor rejects all penetrations.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class CitySwingPhysics {
  constructor(player,{gravity=20,maxSpeed=48,airControl=17,reelSpeed=17,pullAcceleration=92,pullSpeed=34,collisionRecovery=false}={}){
    this.player=player;this.gravity=gravity;this.maxSpeed=maxSpeed;this.airControl=airControl;this.reelSpeed=reelSpeed;
    this.pullAcceleration=pullAcceleration;this.pullSpeed=pullSpeed;this.collisionRecovery=collisionRecovery;
    this.anchor=new THREE.Vector3();this.velocity=new THREE.Vector3();this.position=new THREE.Vector3();
    this.tether=new THREE.Vector3();this.next=new THREE.Vector3();this.active=false;this.length=0;this.targetLength=0;
    this.lastResult='idle';this.swings=0;this.releases=0;this.blocked=0;this.maxObservedSpeed=0;
  }
  attach(point){
    const p=this.player;if(this.active||!point?.isVector3)return false;
    this.position.set(p.camera.position.x,p.feetY+p.eyeHeight,p.camera.position.z);
    const distance=this.position.distanceTo(point);
    if(!Number.isFinite(distance)||distance<2||distance>74)return false;
    this.anchor.copy(point);this.length=distance;this.targetLength=Math.max(3.5,distance*.42);
    this.velocity.copy(p.velocity);
    const toward=this.tether.copy(point).sub(this.position).normalize();
    this.velocity.addScaledVector(toward,22);
    this.velocity.y+=8;
    if(this.velocity.length()>this.maxSpeed)this.velocity.setLength(this.maxSpeed);
    this.active=true;this.lastResult='swinging';this.swings++;
    p.cancelTraversal?.('grapple-swing');p.resetFallTracking?.();
    p.onGround=false;p.state='GRAPPLE';p.grappleWeaponReady=true;
    return true;
  }
  step(dt,keys,yaw){
    if(!this.active)return this.lastResult;
    dt=clamp(Number.isFinite(dt)?dt:0,0,.033);if(!dt)return 'swinging';
    const reeling=keys.has('ShiftLeft')||keys.has('ShiftRight');
    this.length=Math.max(this.targetLength,this.length-(reeling?this.reelSpeed*1.5:this.reelSpeed)*dt);
    const p=this.player;
    this.position.set(p.camera.position.x,p.feetY+p.eyeHeight,p.camera.position.z);
    const forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
    const right=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
    const tangent=this.tether.copy(this.anchor).sub(this.position);
    const dist=tangent.length();if(dist<.01)return this.release('invalid');
    tangent.multiplyScalar(1/dist);
    let ax=(-Math.sin(yaw)*forward+Math.cos(yaw)*right);
    let az=(-Math.cos(yaw)*forward-Math.sin(yaw)*right);
    const magnitude=Math.hypot(ax,az);if(magnitude>1){ax/=magnitude;az/=magnitude;}
    // Project user input into the plane tangent to the rope.
    const dot=ax*tangent.x+az*tangent.z;
    this.velocity.x+=(ax-dot*tangent.x)*this.airControl*dt;
    this.velocity.y+=(-this.gravity-dot*tangent.y*this.airControl)*dt;
    this.velocity.z+=(az-dot*tangent.z)*this.airControl*dt;
    // Powered pull towards the physical anchor, while tangential inertia is
    // retained for a Spider-Man arc. Ramp closes long spans rapidly; near the
    // wall, radial acceleration fades so the swept motor cannot tunnel.
    const radialSpeed=this.velocity.dot(tangent);
    const distanceGain=clamp((dist-3.2)/7,0,1);
    if(radialSpeed<this.pullSpeed&&distanceGain>0)
      this.velocity.addScaledVector(tangent,Math.min(this.pullSpeed-radialSpeed,this.pullAcceleration*dt*distanceGain));
    this.velocity.multiplyScalar(Math.exp(-.17*dt));
    if(this.velocity.length()>this.maxSpeed)this.velocity.setLength(this.maxSpeed);
    this.next.copy(this.position).addScaledVector(this.velocity,dt);
    let radial=this.next.clone().sub(this.anchor),radius=radial.length();
    if(radius>this.length){
      radial.multiplyScalar(1/radius);this.next.copy(this.anchor).addScaledVector(radial,this.length);
      const outward=this.velocity.dot(radial);
      if(outward>0)this.velocity.addScaledVector(radial,-outward);
    }
    const landing=p.parkour?.sensor?.groundAt(p.camera.position.x,p.camera.position.z,p.feetY,
      this.next.y-p.eyeHeight);
    if(landing&&this.velocity.y<0&&this.next.y-p.eyeHeight<=landing.y+.06){
      // Ground contact is resolved by the same motor; momentum does not slip
      // through floors even when a hooked cable cuts across a roof slab.
      this.release('landed');
      if(p.trySwingStep?.(p.camera.position.x,p.camera.position.z,landing.y)){
        p.landAt(landing.y,this.velocity.y);p.state='LANDING';
      }
      return 'landed';
    }
    const feet=this.next.y-p.eyeHeight;
    if(!p.trySwingStep(this.next.x,this.next.z,feet)){
      this.blocked++;this.release('blocked');return 'blocked';
    }
    this.maxObservedSpeed=Math.max(this.maxObservedSpeed,this.velocity.length());
    return 'swinging';
  }
  release(reason='manual-release',jump=false){
    if(!this.active)return false;
    this.active=false;this.lastResult=reason;this.releases++;
    const p=this.player;p.grappleWeaponReady=false;
    if(reason!=='blocked'&&reason!=='landed'){
      // Release momentum passes into the ordinary player controller and is
      // preserved with bounded air-carriage until drag naturally dissipates it.
      p.horizontalVelocity.copy(this.velocity);p.velocity.copy(this.velocity);
      if(jump)p.velocity.y=Math.max(p.velocity.y,5.8);
      p.onGround=false;p.airCarryTimer=.95;p.state='AIRBORNE';
    }else if(reason==='blocked'){
      if(this.collisionRecovery){
        // A high-speed collision should be a recoverable glancing bump,
        // not a full horizontal movement lock. Rebound away from the
        // attempted motion; the normal swept motor still owns all collisions.
        p.horizontalVelocity.set(-this.velocity.x*.26,0,-this.velocity.z*.26);
        if(p.horizontalVelocity.length()>11)p.horizontalVelocity.setLength(11);
        p.velocity.copy(p.horizontalVelocity);
        p.velocity.y=Math.max(4,Math.min(8,Math.abs(this.velocity.y)*.27));
        p.airCarryTimer=.58;
      }else{
        p.horizontalVelocity.set(0,0,0);
        p.velocity.set(0,Math.min(0,this.velocity.y),0);
        p.airCarryTimer=0;
      }
      p.onGround=false;p.state='AIRBORNE';
    }
    p.resetFallTracking?.();
    return true;
  }
  reset(reason='reset'){
    // Death/damage/focus loss must NOT inherit a release impulse or phantom
    // airborne velocity. Only an intentional release transfers momentum.
    if(this.active){
      this.active=false;this.releases++;
      this.player.grappleWeaponReady=false;
      this.player.horizontalVelocity?.set?.(0,0,0);
      this.player.velocity?.set?.(0,0,0);
      this.player.resetFallTracking?.();
    }
    this.lastResult=reason;this.velocity.set(0,0,0);this.player.airCarryTimer=0;
  }
  snapshot(){return {active:this.active,state:this.lastResult,length:Number(this.length.toFixed(2)),
    anchor:this.active?this.anchor.toArray():null,velocity:this.velocity.toArray(),
    speed:Number(this.velocity.length().toFixed(2)),swings:this.swings,releases:this.releases,
    blocked:this.blocked,maxSpeed:Number(this.maxObservedSpeed.toFixed(2))};}
}

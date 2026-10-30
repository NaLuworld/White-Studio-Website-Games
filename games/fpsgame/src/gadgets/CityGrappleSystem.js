import * as THREE from 'three';
import {CityGrappleProjectile} from './CityGrappleProjectile.js?v=infinite-city-v5-1';
import {CitySwingPhysics} from './CitySwingPhysics.js?v=skyline-horizon-v2';
import {CityGrappleVisual} from './CityGrappleVisual.js';

// City-only integrated hook: physical muzzle -> swept projectile -> first
// shootable contact -> fixed world tether -> player-motor-authoritative swing.
export class CityGrappleSystem {
  constructor({scene,camera,player,look=null,shootables,keys,freeflight=false,onImpact=()=>{},onEvent=()=>{}}){
    this.scene=scene;this.camera=camera;this.player=player;this.look=look;this.keys=keys;
    this.sway=0;this.swayPeak=0;
    this.onImpact=onImpact;this.onEvent=onEvent;
    this.freeflight=freeflight;this.range=freeflight?72:56;
    this.projectile=new CityGrappleProjectile(shootables,{
      range:this.range,speed:freeflight?136:105});
    this.physics=new CitySwingPhysics(player,freeflight?
      {gravity:20,maxSpeed:48,airControl:17,reelSpeed:17,pullAcceleration:92,pullSpeed:34,collisionRecovery:true}:
      {gravity:20,maxSpeed:42,airControl:16,reelSpeed:15,pullAcceleration:82,pullSpeed:30});
    this.visual=new CityGrappleVisual(scene,camera);
    this.ray=new THREE.Raycaster();this.aimDir=new THREE.Vector3();
    this.origin=new THREE.Vector3();this.target=new THREE.Vector3();
    this.state='IDLE';this.lastResult='idle';this.fired=0;this.hits=0;this.misses=0;
  }
  findTarget(){
    this.camera.updateMatrixWorld(true);
    const direction=this.camera.getWorldDirection(this.aimDir);
    this.ray.set(this.camera.position,direction);this.ray.near=0;this.ray.far=this.range;
    const hit=this.ray.intersectObjects(this.projectile.objects,false)[0];
    return hit?{ok:hit.object.userData.grappleSurface===true||hit.object.userData.grappleAnchor===true,
      point:hit.point.clone(),surface:hit.object.name,range:hit.distance}:null;
  }
  fire(){
    if(this.state==='FLYING'||this.physics.active)return false;
    const aim=this.findTarget(),origin=this.visual.muzzleWorld();
    const far=this.target.copy(this.aimDir).multiplyScalar(this.range).add(this.camera.position);
    const point=aim?.point??far;
    const direction=this.aimDir.copy(point).sub(origin).normalize();
    if(!this.projectile.fire(origin,direction))return false;
    this.state='FLYING';this.lastResult='fired';this.fired++;this.visual.fire();
    this.onEvent('LAUNCHED');return true;
  }
  release(reason='manual-release',jump=false){
    if(this.physics.active){
      this.physics.release(reason,jump);this.state='IDLE';this.projectile.cancel();
      this.lastResult=reason;this.visual.hide();this.onEvent('RELEASED');return true;
    }
    if(this.state==='FLYING'){
      this.projectile.cancel();this.state='IDLE';this.visual.hide();
      this.lastResult=reason;this.onEvent('CANCELLED');return true;
    }
    return false;
  }
  reset(reason='reset'){
    if(this.physics.active)this.physics.reset(reason);
    this.projectile.cancel();this.state='IDLE';this.lastResult=reason;this.visual.hide();
    this.sway=0;this.look?.setTraversalRoll?.(0);
  }
  step(dt,{selected=true,yaw=0,reducedMotion=false}={}){
    if(this.state==='FLYING'){
      const result=this.projectile.step(dt);
      if(result?.kind==='hit'){
        this.hits++;this.lastResult='hit';
        this.onImpact(result.hit.point,result.hit.surface);
        if(this.physics.attach(result.hit.point)){this.state='SWINGING';this.onEvent('HOOKED');}
        else {this.state='IDLE';this.lastResult='too-close';this.misses++;this.onEvent('NO_TENSION');}
      }else if(result?.kind==='miss'){
        this.misses++;this.state='IDLE';this.lastResult=result.reason;this.onEvent('MISSED');
      }
    }else if(this.physics.active){
      const state=this.physics.step(dt,this.keys,yaw);
      if(!this.physics.active){
        this.state='IDLE';this.lastResult=state;this.onEvent('RELEASED');
      }
    }
    // Look authority is still FirstPersonLook. This bounded speed-dependent
    // tilt never changes yaw/pitch, avoids random camera rotation, and respects
    // the global reduced-motion setting. Aerial movement remains motor-owned.
    const lateral=this.physics.active?
      this.physics.velocity.x*Math.cos(yaw)-this.physics.velocity.z*Math.sin(yaw):0;
    const targetSway=this.physics.active&&!reducedMotion?
      Math.max(-.06,Math.min(.06,-lateral*.0032)):0;
    this.sway+=(targetSway-this.sway)*(1-Math.exp(-10*Math.max(0,Math.min(dt,.033))));
    if(reducedMotion)this.sway=0;
    this.swayPeak=Math.max(this.swayPeak,Math.abs(this.sway));
    if(this.look&&(!this.player.parkour?.state||this.physics.active))
      this.look.setTraversalRoll(this.sway);
    const end=this.physics.active?this.physics.anchor:this.state==='FLYING'?this.projectile.position:null;
    this.visual.step(dt,{state:this.state,point:end,selected,
      airSpeed:this.physics.active?this.physics.velocity.length():this.player.velocity?.length?.()??0,
      lateralSpeed:lateral,reducedMotion});
  }
  snapshot(){
    return {freeflight:this.freeflight,range:this.range,state:this.state,lastResult:this.lastResult,fired:this.fired,hits:this.hits,misses:this.misses,
      projectile:this.projectile.snapshot(),swing:this.physics.snapshot(),ropeVisible:this.visual.rope.visible,
      hookVisible:this.visual.hook.visible,gunVisible:this.visual.gun.visible,
      cameraSway:Number(this.sway.toFixed(4)),cameraSwayPeak:Number(this.swayPeak.toFixed(4)),
      gunParts:this.visual.gun.children.length};
  }
}

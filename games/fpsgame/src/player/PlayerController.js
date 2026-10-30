import * as THREE from 'three';
import {ParkourController} from './ParkourController.js?v=slide-tap-1';
import {TraversalPresentation} from './TraversalPresentation.js?v=slide-cam-1';
import {slideCameraFeel} from './SlideCameraFeel.js?v=slide-cam-1';
import {LocomotionCadence} from './LocomotionCadence.js';
import {CityCombatEvade} from './CityCombatEvade.js';
const moveToward=(v,t,m)=>v<t?Math.min(v+m,t):v>t?Math.max(v-m,t):t;

// Single authoritative transform writer for both the motor and parkour.
export class PlayerController {
  constructor(camera,controls,{keys,config,collisionBoxes,onMotion,onTraversal=null}){
    this.camera=camera;this.controls=controls;this.keys=keys;this.config=config;
    this.collisionBoxes=collisionBoxes;this.onMotion=onMotion;this.onTraversal=onTraversal;
    this.id='player';this.velocity=new THREE.Vector3();this.horizontalVelocity=new THREE.Vector3();
    this.onGround=true;this.crouch=false;this.hp=100;this.state='IDLE';this.damageHandler=null;
    this.eyeHeight=config.standing;this.feetY=0;this.verticalOffset=0;this.landingTimer=0;
    this.fallApex=0;this.pendingFallImpact=null;this.airCarryTimer=0;this.grappleWeaponReady=false;
    this._input=new THREE.Vector3();this._worldInput=new THREE.Vector3();
    this.cityEvade=config.city?new CityCombatEvade():null;this.cityEvadeDir=new THREE.Vector3();
    this._motion={landed:false,state:'IDLE'};
    this._parkourInput={sprint:false,crouch:false,forward:false,backward:false};
    this.presentation=new TraversalPresentation(controls);this.cadence=new LocomotionCadence();
    this.parkour=new ParkourController(this,collisionBoxes,event=>this.onTraversal?.(event));
  }
  resetInputMotion(){
    this.horizontalVelocity.set(0,0,0);this.velocity.x=0;this.velocity.z=0;
    this.parkour.cancel('input-reset');this.presentation.reset();this.cadence.reset();
    this.controls.setTraversalRoll(0);this.controls.resetInteraction();
    this.cityEvade?.reset();
  }
  setDamageHandler(fn){this.damageHandler=fn;}
  queueSlideTap(){this.parkour.queueSlideTap();}
  tryCityEvade(){
    const dodge=this.cityEvade;
    if(!dodge?.start({grounded:this.onGround,alive:this.hp>0,
      blocked:!!this.parkour.state||this.crouch}))return false;
    // Capture a reliable direction once; the existing swept motor performs the
    // movement. Releasing keys during the brief dodge cannot turn it into a teleport.
    const fw=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0);
    const rt=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0);
    const c=Math.cos(this.controls.yaw),s=Math.sin(this.controls.yaw);
    this.cityEvadeDir.set(rt*c-fw*s,0,-rt*s-fw*c);
    if(this.cityEvadeDir.lengthSq()<.01)this.cityEvadeDir.set(-s,0,-c);
    this.cityEvadeDir.normalize();
    return true;
  }
  receiveDamage(event){return this.damageHandler?.(event)??false;}
  cancelTraversal(reason='interrupted'){this.parkour.cancel(reason);}
  canFire(){
    return !['DEAD','SPRINT','VAULT','MANTLE','LEDGE_HANG'].includes(this.state) &&
      (this.state!=='GRAPPLE'||this.grappleWeaponReady) &&
      !['VAULT','MANTLE','LEDGE_HANG'].includes(this.parkour.state);
  }
  resetForRespawn(position){
    this.parkour.reset('respawn');this.resetInputMotion();this.presentation.reset();
    this.velocity.set(0,0,0);this.horizontalVelocity.set(0,0,0);
    this.feetY=0;this.verticalOffset=0;this.onGround=true;this.crouch=false;this.landingTimer=0;this.airCarryTimer=0;this.grappleWeaponReady=false;
    this.resetFallTracking();this.cityEvade?.reset();
    this.eyeHeight=this.config.standing;this.camera.position.copy(position);
    this.camera.position.y=this.config.standing;this.state='IDLE';
  }
  resetFallTracking(){this.fallApex=this.feetY;this.pendingFallImpact=null;}
  consumeFallImpact(){const impact=this.pendingFallImpact;this.pendingFallImpact=null;return impact;}
  landAt(feet,fallSpeed){
    const drop=Math.max(0,Math.max(this.fallApex??this.feetY,this.feetY)-feet);
    this.feetY=feet;this.velocity.y=0;this.onGround=true;
    this.landingTimer=this.config.landingDuration;
    // Two contact probes can resolve in the same motor tick near y=0.
    // Never let a zero-height secondary contact erase the real high fall.
    const strongest=!this.pendingFallImpact||drop>this.pendingFallImpact.drop+.01;
    if(strongest)this.pendingFallImpact={drop,speed:Math.abs(fallSpeed)};
    this.fallApex=feet;
    if(strongest)this.onTraversal?.({from:'AIRBORNE',to:'LANDING',reason:'ground-contact',fallDistance:drop});
  }
  tryMoveTo(x,z,feet,height=this.config.standing+.08){
    const px=this.camera.position.x,pz=this.camera.position.z,py=this.feetY;
    const count=Math.max(1,Math.ceil(Math.hypot(x-px,z-pz,feet-py)/.075));
    for(let n=1;n<=count;n++){
      const t=n/count;
      if(!this.parkour.sensor.isFree(px+(x-px)*t,pz+(z-pz)*t,py+(feet-py)*t,height))return false;
    }
    this.camera.position.x=x;this.camera.position.z=z;
    this.feetY=feet;this.verticalOffset=feet;return true;
  }
  // Gadgets request a swept move through this same player motor; never own transforms.
  tryGrappleStep(x,z,feet){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(feet)||feet<0||feet>(this.config.grappleMaxHeight??6))return false;
    if(!this.tryMoveTo(x,z,feet,this.config.standing+.08))return false;
    this.camera.position.y=this.feetY+this.eyeHeight;
    this.velocity.set(0,0,0);this.horizontalVelocity.set(0,0,0);
    this.onGround=false;this.state='GRAPPLE';return true;
  }
  // Swing tether requests continuous collision-authoritative travel without
  // clearing inertia. Only this motor writes the camera and feet transforms.
  trySwingStep(x,z,feet){
    if(![x,z,feet].every(Number.isFinite)||feet<0||feet>(this.config.grappleMaxHeight??6))return false;
    if(!this.tryMoveTo(x,z,feet,this.config.standing+.08))return false;
    this.camera.position.y=this.feetY+this.eyeHeight;
    this.onGround=false;this.state='GRAPPLE';return true;
  }
  // Narrow tagged city stair risers may be stepped up without repeatedly
  // jumping. Other geometry keeps the existing collision behavior unchanged.
  tryStairStep(x,z,height){
    if(!this.onGround)return false;
    const sensor=this.parkour.sensor,feet=this.feetY,r=this.config.radius;
    let target=null;
    for(const box of this.collisionBoxes){
      if(!box.userData?.traversal?.stair)continue;
      if(x+r<=box.min.x||x-r>=box.max.x||z+r<=box.min.z||z-r>=box.max.z)continue;
      const rise=box.max.y-feet;
      if(rise>.02&&rise<=.46&&(target===null||box.max.y<target))target=box.max.y;
    }
    if(target===null)return false;
    for(let y=feet+.06;y<target+.06;y+=.06){
      if(!sensor.isFree(this.camera.position.x,this.camera.position.z,Math.min(target,y),height))return false;
    }
    if(!sensor.isFree(x,z,target,height))return false;
    this.feetY=target;this.verticalOffset=target;
    return true;
  }
  moveAxis(axis,delta){
    if(Math.abs(delta)<1e-6)return true;
    const px=this.camera.position.x,pz=this.camera.position.z;
    const nx=px+(axis==='x'?delta:0),nz=pz+(axis==='z'?delta:0);
    const count=Math.max(1,Math.ceil(Math.abs(delta)/.075));
    const height=(this.crouch?this.config.crouch:this.config.standing)+.08;
    for(let n=1;n<=count;n++){
      const t=n/count;
      const sx=px+(nx-px)*t,sz=pz+(nz-pz)*t;
      const previous=(n-1)/count,fromX=px+(nx-px)*previous,fromZ=pz+(nz-pz)*previous;
      if(!this.parkour.sensor.isFree(sx,sz,this.feetY,height)&&
         !this.parkour.sensor.canExitShallowOverlap(fromX,fromZ,sx,sz,this.feetY,height)&&
         !this.tryStairStep(sx,sz,height)){
        this.horizontalVelocity[axis]=0;return false;
      }
    }
    this.camera.position.x=nx;this.camera.position.z=nz;return true;
  }
  moveVertical(dt,gravityScale=1){
    if(this.onGround)return;
    const start=this.feetY;this.fallApex=Math.max(this.fallApex??start,start);
    this.velocity.y-=this.config.gravity*gravityScale*dt;
    const next=start+this.velocity.y*dt,sensor=this.parkour.sensor;
    if(this.velocity.y>0){
      if(sensor.isFree(this.camera.position.x,this.camera.position.z,next,
        (this.crouch?this.config.crouch:this.config.standing)+.08))this.feetY=next;
      else this.velocity.y=0;
    }else{
      const landing=sensor.groundAt(this.camera.position.x,this.camera.position.z,start,next);
      if(landing)this.landAt(landing.y,this.velocity.y);
      else this.feetY=next;
    }
    if(this.feetY<0)this.landAt(0,this.velocity.y);
    this.verticalOffset=this.feetY;
  }
  update(dt){
    dt=Math.min(.033,Math.max(0,dt));
    const forward=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0);
    const right=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0);
    const sprint=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight');
    const crouch=this.keys.has('ControlLeft')||this.keys.has('ControlRight');
    const input=this._parkourInput;input.sprint=sprint;input.crouch=crouch;input.forward=forward>0;input.backward=forward<0;
    const wasGrounded=this.onGround;
    if(wasGrounded)this.fallApex=this.feetY;
    // Short Ctrl taps still hold the crouched collider throughout the slide.
    this.crouch=crouch||this.parkour.state==='SLIDE';
    const handled=this.parkour.update(dt,input);
    this.crouch=crouch||this.parkour.state==='SLIDE';
    let rawLength=0;
    if(!handled){
      this._input.set(right,0,-forward);rawLength=this._input.length();
      if(rawLength>1)this._input.multiplyScalar(1/rawLength);
      const c=Math.cos(this.controls.yaw),s=Math.sin(this.controls.yaw);
      this._worldInput.set(this._input.x*c+this._input.z*s,0,-this._input.x*s+this._input.z*c);
      const evading=!!this.cityEvade?.active&&this.onGround;
      if(evading)this._worldInput.copy(this.cityEvadeDir);
      const speed=evading?15.5:(sprint?this.config.sprint:this.config.walk)*(this.crouch?.55:1);
      // A released swinging player retains trajectory before regular air drag
      // resumes. This is opt-in via airCarryTimer; ordinary movement is unchanged.
      const carrying=!this.onGround&&this.airCarryTimer>0;
      this.airCarryTimer=Math.max(0,this.airCarryTimer-dt);
      const accel=(evading?76:rawLength>0?this.config.acceleration*(carrying?.25:1):this.config.deceleration*(carrying?.07:1))*dt;
      this.horizontalVelocity.x=moveToward(this.horizontalVelocity.x,this._worldInput.x*speed,accel);
      this.horizontalVelocity.z=moveToward(this.horizontalVelocity.z,this._worldInput.z*speed,accel);
      // Restore just enough kick-off-wall velocity to survive initial air steering.
      // The normal component fades quickly; the same swept motor still owns collision.
      this.parkour.wallKickCarry.apply(this.horizontalVelocity,dt,{airborne:!this.onGround});
      this.moveAxis('x',this.horizontalVelocity.x*dt);
      this.moveAxis('z',this.horizontalVelocity.z*dt);
      if(this.onGround&&!this.parkour.sensor.support(this.camera.position.x,this.camera.position.z,this.feetY))this.onGround=false;
      if(!this.onGround)this.moveVertical(dt);
      this.parkour.afterMotor(dt,input.forward);
    }
    if(this.onGround)this.parkour.wallKickCarry.reset();
    if(this.landingTimer>0)this.landingTimer=Math.max(0,this.landingTimer-dt);
    const traversal=this.parkour.state;
    if(traversal)this.state=traversal;
    else if(this.landingTimer>0&&this.onGround)this.state='LANDING';
    else if(!this.onGround)this.state='AIRBORNE';
    else if(this.crouch)this.state='CROUCH';
    else if(rawLength>.01||Math.hypot(this.horizontalVelocity.x,this.horizontalVelocity.z)>.25)this.state=sprint?'SPRINT':'WALK';
    else this.state='IDLE';
    const slideFeel=this.state==='SLIDE'?slideCameraFeel({
      speed:this.parkour.slideSpeed,elapsed:this.parkour.timer,
      slideX:this.parkour.slideX,slideZ:this.parkour.slideZ,
      yaw:this.controls.yaw,reducedMotion:this.controls.reducedMotion
    }):null;
    this._motion.slideFeel=slideFeel;
    // Physical motor retains the sole camera position writer. A small slide
    // dip follows crouch collision height; no camera teleport or floating HUD.
    const eyeTarget=(this.crouch||this.state==='SLIDE'?this.config.crouch:this.config.standing)
      -(slideFeel?.eyeDip??0);
    this.eyeHeight=THREE.MathUtils.lerp(this.eyeHeight,eyeTarget,
      1-Math.exp(-(this.state==='SLIDE'?25:this.config.eyeTransition)*dt));
    this.camera.position.y=this.eyeHeight+this.feetY;
    this.verticalOffset=this.feetY;
    this.velocity.x=this.horizontalVelocity.x;this.velocity.z=this.horizontalVelocity.z;
    this._motion.landed=!wasGrounded&&this.onGround;this._motion.state=this.state;
    this._motion.traversalProgress=this.parkour.motion.active?this.parkour.motion.progress:0;
    this.presentation.update(dt,this.state,this._motion.traversalProgress,slideFeel);
    if(this.cadence.update(dt,Math.hypot(this.horizontalVelocity.x,this.horizontalVelocity.z),this.state,this.onGround))
      this.onTraversal?.({from:this.state,to:'STEP',reason:'grounded-movement'});
    this.onMotion?.(dt,Math.min(1,rawLength||Math.hypot(this.horizontalVelocity.x,this.horizontalVelocity.z)/this.config.walk),
      this.state==='SPRINT',this._motion);
  }
  jump(){
    const result=this.parkour.jump();
    if(result!==null)return result;
    if(!this.onGround||this.crouch)return false;
    this.velocity.y=this.config.jump;this.onGround=false;this.landingTimer=0;this.state='AIRBORNE';
    return true;
  }
}

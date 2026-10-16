import * as THREE from 'three';
import {ParkourController} from './ParkourController.js';
import {TraversalPresentation} from './TraversalPresentation.js';
import {LocomotionCadence} from './LocomotionCadence.js';
const moveToward=(v,t,m)=>v<t?Math.min(v+m,t):v>t?Math.max(v-m,t):t;

// Single authoritative transform writer for both the motor and parkour.
export class PlayerController {
  constructor(camera,controls,{keys,config,collisionBoxes,onMotion,onTraversal=null}){
    this.camera=camera;this.controls=controls;this.keys=keys;this.config=config;
    this.collisionBoxes=collisionBoxes;this.onMotion=onMotion;this.onTraversal=onTraversal;
    this.id='player';this.velocity=new THREE.Vector3();this.horizontalVelocity=new THREE.Vector3();
    this.onGround=true;this.crouch=false;this.hp=100;this.state='IDLE';this.damageHandler=null;
    this.eyeHeight=config.standing;this.feetY=0;this.verticalOffset=0;this.landingTimer=0;
    this._input=new THREE.Vector3();this._worldInput=new THREE.Vector3();
    this._motion={landed:false,state:'IDLE'};
    this._parkourInput={sprint:false,crouch:false,forward:false,backward:false};
    this.presentation=new TraversalPresentation(controls);this.cadence=new LocomotionCadence();
    this.parkour=new ParkourController(this,collisionBoxes,event=>this.onTraversal?.(event));
  }
  resetInputMotion(){
    this.horizontalVelocity.set(0,0,0);this.velocity.x=0;this.velocity.z=0;
    this.parkour.cancel('input-reset');this.presentation.reset();this.cadence.reset();
    this.controls.setTraversalRoll(0);this.controls.resetInteraction();
  }
  setDamageHandler(fn){this.damageHandler=fn;}
  receiveDamage(event){return this.damageHandler?.(event)??false;}
  cancelTraversal(reason='interrupted'){this.parkour.cancel(reason);}
  canFire(){
    return !['DEAD','SPRINT','VAULT','MANTLE','LEDGE_HANG'].includes(this.state) &&
      !['VAULT','MANTLE','LEDGE_HANG'].includes(this.parkour.state);
  }
  resetForRespawn(position){
    this.parkour.reset('respawn');this.resetInputMotion();this.presentation.reset();
    this.velocity.set(0,0,0);this.horizontalVelocity.set(0,0,0);
    this.feetY=0;this.verticalOffset=0;this.onGround=true;this.crouch=false;this.landingTimer=0;
    this.eyeHeight=this.config.standing;this.camera.position.copy(position);
    this.camera.position.y=this.config.standing;this.state='IDLE';
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
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(feet)||feet<0||feet>6)return false;
    if(!this.tryMoveTo(x,z,feet,this.config.standing+.08))return false;
    this.camera.position.y=this.feetY+this.eyeHeight;
    this.velocity.set(0,0,0);this.horizontalVelocity.set(0,0,0);
    this.onGround=false;this.state='AIRBORNE';return true;
  }
  moveAxis(axis,delta){
    if(Math.abs(delta)<1e-6)return true;
    const px=this.camera.position.x,pz=this.camera.position.z;
    const nx=px+(axis==='x'?delta:0),nz=pz+(axis==='z'?delta:0);
    const count=Math.max(1,Math.ceil(Math.abs(delta)/.075));
    const height=(this.crouch?this.config.crouch:this.config.standing)+.08;
    for(let n=1;n<=count;n++){
      const t=n/count;
      if(!this.parkour.sensor.isFree(px+(nx-px)*t,pz+(nz-pz)*t,this.feetY,height)){
        this.horizontalVelocity[axis]=0;return false;
      }
    }
    this.camera.position.x=nx;this.camera.position.z=nz;return true;
  }
  moveVertical(dt,gravityScale=1){
    if(this.onGround)return;
    const start=this.feetY;this.velocity.y-=this.config.gravity*gravityScale*dt;
    const next=start+this.velocity.y*dt,sensor=this.parkour.sensor;
    if(this.velocity.y>0){
      if(sensor.isFree(this.camera.position.x,this.camera.position.z,next,
        (this.crouch?this.config.crouch:this.config.standing)+.08))this.feetY=next;
      else this.velocity.y=0;
    }else{
      const landing=sensor.groundAt(this.camera.position.x,this.camera.position.z,start,next);
      if(landing){
        this.feetY=landing.y;this.velocity.y=0;this.onGround=true;
        this.landingTimer=this.config.landingDuration;
        this.onTraversal?.({from:'AIRBORNE',to:'LANDING',reason:'ground-contact'});
      }else this.feetY=next;
    }
    if(this.feetY<0){this.feetY=0;this.velocity.y=0;this.onGround=true;}
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
    this.crouch=crouch; // Slide and motor share the same crouched collider height.
    const handled=this.parkour.update(dt,input);
    let rawLength=0;
    if(!handled){
      this._input.set(right,0,-forward);rawLength=this._input.length();
      if(rawLength>1)this._input.multiplyScalar(1/rawLength);
      const c=Math.cos(this.controls.yaw),s=Math.sin(this.controls.yaw);
      this._worldInput.set(this._input.x*c+this._input.z*s,0,-this._input.x*s+this._input.z*c);
      const speed=(sprint?this.config.sprint:this.config.walk)*(this.crouch?.55:1);
      const accel=(rawLength>0?this.config.acceleration:this.config.deceleration)*dt;
      this.horizontalVelocity.x=moveToward(this.horizontalVelocity.x,this._worldInput.x*speed,accel);
      this.horizontalVelocity.z=moveToward(this.horizontalVelocity.z,this._worldInput.z*speed,accel);
      this.moveAxis('x',this.horizontalVelocity.x*dt);
      this.moveAxis('z',this.horizontalVelocity.z*dt);
      if(this.onGround&&!this.parkour.sensor.support(this.camera.position.x,this.camera.position.z,this.feetY))this.onGround=false;
      if(!this.onGround)this.moveVertical(dt);
      this.parkour.afterMotor(dt,input.forward);
    }
    if(this.landingTimer>0)this.landingTimer=Math.max(0,this.landingTimer-dt);
    const traversal=this.parkour.state;
    if(traversal)this.state=traversal;
    else if(this.landingTimer>0&&this.onGround)this.state='LANDING';
    else if(!this.onGround)this.state='AIRBORNE';
    else if(this.crouch)this.state='CROUCH';
    else if(rawLength>.01||Math.hypot(this.horizontalVelocity.x,this.horizontalVelocity.z)>.25)this.state=sprint?'SPRINT':'WALK';
    else this.state='IDLE';
    this.eyeHeight=THREE.MathUtils.lerp(this.eyeHeight,
      (this.crouch||this.state==='SLIDE'?this.config.crouch:this.config.standing),
      1-Math.exp(-this.config.eyeTransition*dt));
    this.camera.position.y=this.eyeHeight+this.feetY;
    this.verticalOffset=this.feetY;
    this.velocity.x=this.horizontalVelocity.x;this.velocity.z=this.horizontalVelocity.z;
    this._motion.landed=!wasGrounded&&this.onGround;this._motion.state=this.state;
    this._motion.traversalProgress=this.parkour.motion.active?this.parkour.motion.progress:0;
    this.presentation.update(dt,this.state,this._motion.traversalProgress);
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

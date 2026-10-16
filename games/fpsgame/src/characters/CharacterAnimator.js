import * as THREE from 'three';
import {sampleHitPose} from './HitReactionCurves.js';

const damp=(current,target,speed,dt)=>THREE.MathUtils.lerp(current,target,1-Math.exp(-speed*dt));

export class CharacterAnimator {
  constructor(rig) {
    this.rig=rig;
    this.state='IDLE';
    this.time=0;
    this.fireTimer=0;
    this.hitTimer=0;
    this.hitDuration=.22;this.hitPart='torso';
    this.hitStrength=0;
    this.hitSide=0;
    this.deathProgress=0;
  }

  setState(state) {
    if (this.state === 'DEATH'||this.hitTimer>0) return;
    this.state=state;
  }

  fire() {
    if(this.state!=='DEATH')this.fireTimer=.12;
  }

  hit(part,directionLocalX=0,severity=1) {
    if(this.state==='DEATH')return;
    this.hitPart=part;
    this.hitDuration=part==='head'?.34:.22;
    this.hitTimer=this.hitDuration;
    const safeSeverity=Number.isFinite(severity)?Math.max(0,severity):1;
    this.hitStrength=Math.min(1.5,safeSeverity*(part==='head'?1.25:1));
    this.hitSide=Math.sign(directionLocalX)||1;
    this.state=this.hitStrength>1?'HIT_HEAVY':'HIT_LIGHT';
  }

  die(directionLocalX=1) {
    this.state='DEATH';
    this.deathProgress=0;
    this.hitSide=Math.sign(directionLocalX)||1;
  }

  update(dt, speed=0, strafe=0) {
    this.time+=dt;
    const n=this.rig.nodes;
    if(this.state==='DEATH'){
      this.deathProgress=Math.min(1,this.deathProgress+dt*1.8);
      const eased=1-Math.pow(1-this.deathProgress,3);
      this.rig.root.rotation.z=damp(this.rig.root.rotation.z,this.hitSide*1.28,eased?8:4,dt);
      this.rig.root.rotation.x=damp(this.rig.root.rotation.x,.12,5,dt);
      n.leftUpperArm.rotation.x=damp(n.leftUpperArm.rotation.x,-.7,5,dt);
      n.rightUpperArm.rotation.x=damp(n.rightUpperArm.rotation.x,-.45,5,dt);
      return;
    }

    const locomotion=Math.min(1,speed/2.4);
    const cadence=this.state==='RUN'?9:6.4;
    const swing=Math.sin(this.time*cadence)*.62*locomotion;
    n.leftThigh.rotation.x=damp(n.leftThigh.rotation.x,swing,11,dt);
    n.rightThigh.rotation.x=damp(n.rightThigh.rotation.x,-swing,11,dt);
    n.leftShin.rotation.x=damp(n.leftShin.rotation.x,Math.max(0,-swing)*.65,12,dt);
    n.rightShin.rotation.x=damp(n.rightShin.rotation.x,Math.max(0,swing)*.65,12,dt);

    const aiming=this.state==='AIM'||this.state==='FIRE'||this.state==='ENGAGE';
    const armBase=aiming?-1.15:-swing*.55;
    n.rightUpperArm.rotation.x=damp(n.rightUpperArm.rotation.x,armBase,13,dt);
    n.leftUpperArm.rotation.x=damp(n.leftUpperArm.rotation.x,aiming?-1.02:swing*.55,13,dt);
    n.rightForearm.rotation.x=damp(n.rightForearm.rotation.x,aiming?-.38:0,13,dt);
    n.leftForearm.rotation.x=damp(n.leftForearm.rotation.x,aiming?-.48:0,13,dt);
    n.torso.rotation.z=damp(n.torso.rotation.z,-strafe*.12,9,dt);
    n.pelvis.position.y=damp(n.pelvis.position.y,.92+Math.abs(Math.sin(this.time*cadence))*locomotion*.035,10,dt);

    if(this.fireTimer>0){
      this.fireTimer=Math.max(0,this.fireTimer-dt);
      const kick=this.fireTimer/.12;
      n.torso.rotation.x=damp(n.torso.rotation.x,-.08*kick,18,dt);
      n.weaponAnchor.position.z=damp(n.weaponAnchor.position.z,-.28+.08*kick,18,dt);
    }else{
      n.torso.rotation.x=damp(n.torso.rotation.x,0,10,dt);
      n.weaponAnchor.position.z=damp(n.weaponAnchor.position.z,-.28,10,dt);
    }

    if(this.hitTimer>0){
      this.hitTimer=Math.max(0,this.hitTimer-dt);
      const pose=sampleHitPose({part:this.hitPart,remaining:this.hitTimer,
        duration:this.hitDuration,strength:this.hitStrength,side:this.hitSide});
      n.torso.rotation.z=damp(n.torso.rotation.z,-strafe*.12+pose.torsoZ,18,dt);
      n.head.rotation.z=damp(n.head.rotation.z,pose.headZ,20,dt);
      n.torso.rotation.x=damp(n.torso.rotation.x,pose.torsoX,18,dt);
      n.rightUpperArm.rotation.x+=pose.armX*(1-Math.exp(-12*dt));
    }else{
      n.head.rotation.z=damp(n.head.rotation.z,0,12,dt);
      if(this.state==='HIT_LIGHT'||this.state==='HIT_HEAVY')this.state=speed>.2?'WALK':'IDLE';
    }
  }
}

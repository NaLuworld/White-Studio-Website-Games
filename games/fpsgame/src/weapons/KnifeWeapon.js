import * as THREE from 'three';
import {WEAPON_DEFINITIONS} from './WeaponDefinitions.js';
export class KnifeWeapon {
  constructor(camera,{canUse,resolve,onHit}){
    this.definition=WEAPON_DEFINITIONS[3];
    this.group=new THREE.Group();
    camera.add(this.group);
    this.base=new THREE.Vector3(.36,-.37,-.58);
    this.group.position.copy(this.base);
    this.canUse=canUse;this.resolve=resolve;this.onHit=onHit;
    this.state='READY';this.phase='IDLE';this.timer=0;this.triggerDown=false;this.swingSide=-1;this.swing=0;
    this.shots=0;this.hits=0;this.lastHit=null;this.lastShot=null;
    const steel=new THREE.MeshStandardMaterial({color:0xcad0d2,metalness:.86,roughness:.2});
    const grip=new THREE.MeshStandardMaterial({color:0x171d23,roughness:.74});
    const accent=new THREE.MeshStandardMaterial({color:0x697077,metalness:.67,roughness:.37});
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.047,.035,.42),steel);
    blade.position.set(0,.045,-.28);blade.rotation.x=-.12;blade.name='knife-blade';
    const point=new THREE.Mesh(new THREE.ConeGeometry(.032,.16,5),steel);
    point.position.set(0,.068,-.56);point.rotation.x=-Math.PI/2;
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(.045,.05,.23,8),grip);
    handle.rotation.x=Math.PI/2;handle.position.z=.038;
    this.group.add(blade,point,handle);
    const guard=new THREE.Mesh(new THREE.BoxGeometry(.17,.033,.055),accent);
    guard.position.set(0,.02,-.09);
    const rivet=new THREE.Mesh(new THREE.BoxGeometry(.064,.03,.03),accent);
    rivet.position.set(0,-.015,.07);
    this.group.add(guard,rivet);
  }
  setVisible(v){this.group.visible=!!v;}
  stow(){this.resetTransientState('stow');}
  draw(){this.resetTransientState('draw');this.state='EQUIPPING';this.timer=this.definition.equip;}
  fire(){
    if(!this.canUse()||this.phase!=='IDLE'||this.state!=='READY')return false;
    this.phase='WINDUP';this.state='FIRING';this.timer=this.definition.windup;this.shots++;
    this.swingSide*=-1;
    return true;
  }
  setTrigger(pressed){
    const down=!!pressed;
    if(down&&!this.triggerDown)this.fire();
    this.triggerDown=down;
  }
  reload(){return false;}
  setAmmo(){return false;}
  resetTransientState(){
    this.phase='IDLE';this.state='READY';this.timer=0;this.triggerDown=false;this.swing=0;
    this.group.position.copy(this.base);this.group.rotation.set(0,0,0);
  }
  update(dt,moving,sprint,motion={}){
    const step=Number.isFinite(dt)?Math.max(0,Math.min(.033,dt)):0;
    if(this.state==='EQUIPPING'){
      this.timer=Math.max(0,this.timer-step);
      if(this.timer===0)this.state='READY';
      return;
    }
    if(!this.canUse()){this.resetTransientState();return;}
    if(this.phase==='WINDUP'){
      this.timer=Math.max(0,this.timer-step);
      if(this.timer===0){
        const result=this.resolve();
        this.lastHit=result;
        if(result.kind==='enemy')this.hits++;
        this.onHit(result);
        this.phase='RECOVERY';this.timer=this.definition.recovery;this.state='COOLDOWN';
      }
    }else if(this.phase==='RECOVERY'){
      this.timer=Math.max(0,this.timer-step);
      if(this.timer===0){this.phase='IDLE';this.state='READY';}
    }
    const attack=this.phase==='WINDUP'?.78:this.phase==='RECOVERY'?-.23:0;
    const blend=1-Math.exp(-18*step);
    this.swing+=(attack-this.swing)*blend;
    this.group.rotation.z+=(this.swing*this.swingSide-this.group.rotation.z)*blend;
    this.group.rotation.x+=(-this.swing*.46-this.group.rotation.x)*blend;
    this.group.position.x+=(this.base.x-this.swing*.18-this.group.position.x)*blend;
    this.group.position.y+=(this.base.y+Math.abs(this.swing)*.05-this.group.position.y)*blend;
  }
}

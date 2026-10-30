import * as THREE from 'three';
import {rearKnifeOpportunity} from './RearKnifeOpportunity.js';
// Real source camera forward ray, physical wall/character ordering, never direct HP changes.
export class MeleeResolver {
  constructor({damageSystem,shootables,raycaster=new THREE.Raycaster(),allowCircuitTakedown=()=>false}={}){
    this.damageSystem=damageSystem;
    this.shootables=shootables;
    this.raycaster=raycaster;
    this.allowCircuitTakedown=allowCircuitTakedown;
    this.direction=new THREE.Vector3();
    this.origin=new THREE.Vector3();
  }
  resolve(camera,source,{reach=2.2,damage=55}={}){
    if(!Number.isFinite(reach)||reach<=0||reach>2.2)return {kind:'miss'};
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(this.direction).normalize();
    camera.getWorldPosition(this.origin);
    this.raycaster.set(this.origin,this.direction);
    this.raycaster.near=0;
    this.raycaster.far=reach;
    const hits=this.raycaster.intersectObjects(this.shootables,false);
    const first=hits[0];
    if(!first)return {kind:'miss'};
    const enemy=first.object.userData.enemy;
    if(!enemy||enemy.dead)return {kind:'blocked',surface:first.object.userData.surface||'solid'};
    const point=first.point.clone();
    const silentTakedown=enemy.id===1&&this.allowCircuitTakedown()&&rearKnifeOpportunity({
      enabled:true,enemyPosition:enemy.group.position,attackerPosition:this.origin,
      enemyYaw:enemy.group.rotation.y,phase:enemy.awareness?.phase,
      perceptionVisible:!!enemy.perception?.visible,reach
    });
    const event=this.damageSystem.apply({
      source,target:enemy,amount:silentTakedown?Math.max(damage,110):damage,
      silentTakedown,bodyPart:'torso',hitPoint:point,
      direction:this.direction,hitNormal:first.face?.normal?.clone()?.transformDirection(first.object.matrixWorld),
      weaponId:'station-knife',applyBodyMultiplier:false
    });
    return event?{kind:'enemy',targetId:enemy.id,amount:event.amount,
      silentTakedown,point:point.toArray()}:{kind:'miss'};
  }
}

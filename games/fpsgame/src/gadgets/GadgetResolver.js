import * as THREE from 'three';
// Real ballistic segment sweep and camera-ray collider ordering. No fake
// instant noise-at-player or grapple through occluding environment.
export class GadgetResolver{
  constructor({world,emitNoise,onImpact}){
    this.world=world;this.emitNoise=emitNoise;this.onImpact=onImpact;
    this.ray=new THREE.Raycaster();this.origin=new THREE.Vector3();this.dir=new THREE.Vector3();
    this.pos=new THREE.Vector3();this.next=new THREE.Vector3();this.vel=new THREE.Vector3();
    this.delta=new THREE.Vector3();
  }
  throwDistraction(camera,{range=15}={}){
    camera.updateMatrixWorld(true);camera.getWorldPosition(this.origin);camera.getWorldDirection(this.dir).normalize();
    this.pos.copy(this.origin);this.vel.copy(this.dir).multiplyScalar(12.5).addScaledVector(THREE.Object3D.DEFAULT_UP,3.7);
    let traveled=0,point=null,material='concrete';
    const objects=this.world.shootables;
    for(let i=0;i<38;i++){
      this.next.copy(this.pos).addScaledVector(this.vel,.038);
      this.vel.y-=9.8*.038;
      const segment=this.delta.copy(this.next).sub(this.pos),length=segment.length();
      if(!Number.isFinite(length)||length<=0)return {ok:false,reason:'invalid-trajectory'};
      traveled+=length;
      if(traveled>range+3)return {ok:false,reason:'out-of-range'};
      this.ray.set(this.pos,segment.multiplyScalar(1/length));this.ray.far=length;this.ray.near=0;
      const hits=this.ray.intersectObjects(objects,false);
      if(hits.length){point=hits[0].point.clone();material=hits[0].object.userData.surface||'concrete';break;}
      if(this.next.y<=0){point=this.next.clone();point.y=0;break;}
      if(this.next.x<this.world.xMin||this.next.x>this.world.xMax||
        this.next.z<this.world.zMin||this.next.z>this.world.zMax)return {ok:false,reason:'world-bounds'};
      this.pos.copy(this.next);
    }
    if(!point)return {ok:false,reason:'no-impact'};
    this.emitNoise(point);this.onImpact?.(point,material);
    return {ok:true,kind:'distraction',surface:material,point:point.toArray()};
  }
  findAnchor(camera,{range=18}={}){
    camera.updateMatrixWorld(true);camera.getWorldPosition(this.origin);camera.getWorldDirection(this.dir).normalize();
    this.ray.set(this.origin,this.dir);this.ray.near=0;this.ray.far=range;
    const hits=this.ray.intersectObjects(this.world.shootables,false),first=hits[0];
    if(!first?.object?.userData?.grappleAnchor)return {ok:false,reason:first?'blocked':'no-anchor'};
    const p=first.object.position;
    return {ok:true,kind:'grapple',point:p.toArray(),target:{
      x:p.x,z:p.z,feetY:Math.max(.4,p.y-1.45)}};
  }
}

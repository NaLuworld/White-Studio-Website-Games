import * as THREE from 'three';

// A visible, finite-speed projectile. Every movement step sweeps the actual
// physical ray from the previous hook location to the next, first-contact wins.
export class CityGrappleProjectile {
  constructor(objects,{speed=136,range=72}={}){
    this.objects=objects;this.speed=speed;this.range=range;
    this.ray=new THREE.Raycaster();this.position=new THREE.Vector3();
    this.direction=new THREE.Vector3();this.stepVector=new THREE.Vector3();
    this.traveled=0;this.state='IDLE';this.hit=null;this.reason='idle';
  }
  fire(origin,direction){
    if(this.state==='FLYING'||!origin?.isVector3||!direction?.isVector3||direction.lengthSq()<.5)return false;
    this.position.copy(origin);this.direction.copy(direction).normalize();
    this.traveled=0;this.hit=null;this.reason='flying';this.state='FLYING';return true;
  }
  step(dt){
    if(this.state!=='FLYING')return null;
    const distance=Math.min(this.speed*Math.max(0,Math.min(dt,.033)),this.range-this.traveled);
    if(distance<=0){this.state='MISSED';this.reason='out-of-range';return {kind:'miss',reason:this.reason};}
    this.ray.set(this.position,this.direction);this.ray.near=.001;this.ray.far=distance+.001;
    const hit=this.ray.intersectObjects(this.objects,false)[0];
    if(hit){
      this.position.copy(hit.point);this.traveled+=hit.distance;
      if(hit.object.userData?.grappleSurface===true||hit.object.userData?.grappleAnchor===true){
        this.state='HOOKED';this.reason='hit';this.hit={
          point:hit.point.clone(),normal:hit.face?.normal?.clone()?.transformDirection(hit.object.matrixWorld)??new THREE.Vector3(0,1,0),
          surface:hit.object.name,anchor:!!hit.object.userData.grappleAnchor
        };
        return {kind:'hit',hit:this.hit};
      }
      this.state='MISSED';this.reason='blocked';return {kind:'miss',reason:this.reason};
    }
    this.position.addScaledVector(this.direction,distance);this.traveled+=distance;
    if(this.traveled>=this.range-.001){this.state='MISSED';this.reason='out-of-range';return {kind:'miss',reason:this.reason};}
    return {kind:'flying'};
  }
  cancel(){this.state='IDLE';this.hit=null;this.reason='cancel';}
  snapshot(){return {state:this.state,traveled:Number(this.traveled.toFixed(2)),position:this.position.toArray(),
    hit:this.hit?{position:this.hit.point.toArray(),surface:this.hit.surface,anchor:this.hit.anchor}:null,reason:this.reason};}
}

import * as THREE from 'three';

export class EnemyPerception {
  constructor({ sightRadius=24, fovDegrees=118, memorySeconds=2.4, nearAwarenessRadius=5.5 }={}) {
    this.sightRadius=sightRadius;
    this.fovCos=Math.cos(THREE.MathUtils.degToRad(fovDegrees*.5));
    this.memorySeconds=memorySeconds;
    this.nearAwarenessRadius=nearAwarenessRadius;
    this.visible=false;
    this.memoryRemaining=0;
    this.lastKnownPosition=new THREE.Vector3();
    this.hasLastKnown=false;
    this.distance=Infinity;
    this.blocked=false;
    this._toTarget=new THREE.Vector3();
    this._direction=new THREE.Vector3();
    this._result={visible:false,remembered:false,memoryRemaining:0,lastKnownPosition:null,distance:Infinity,blocked:false};
  }

  forceRemember(position) {
    this.lastKnownPosition.copy(position);
    this.hasLastKnown=true;
    this.memoryRemaining=this.memorySeconds;
  }

  update(dt, origin, forward, targetPosition, hasLineOfSight) {
    const toTarget=this._toTarget.copy(targetPosition).sub(origin);
    toTarget.y=0;
    const distance=toTarget.length();
    this.distance=distance;
    const direction=this._direction;
    if(distance>1e-5)direction.copy(toTarget).multiplyScalar(1/distance);
    else direction.copy(forward);
    const insideRadius=distance<=this.sightRadius;
    const insideFov=distance<=this.nearAwarenessRadius || forward.dot(direction)>=this.fovCos;
    const los=insideRadius && insideFov && hasLineOfSight(origin,targetPosition);
    this.visible=!!los;
    this.blocked=insideRadius && insideFov && !los;

    if(this.visible){
      this.forceRemember(targetPosition);
    }else{
      this.memoryRemaining=Math.max(0,this.memoryRemaining-dt);
      if(this.memoryRemaining<=0)this.hasLastKnown=false;
    }

    const result=this._result;
    result.visible=this.visible;
    result.remembered=this.hasLastKnown;
    result.memoryRemaining=this.memoryRemaining;
    result.lastKnownPosition=this.hasLastKnown?this.lastKnownPosition:null;
    result.distance=this.distance;
    result.blocked=this.blocked;
    return result;
  }
}

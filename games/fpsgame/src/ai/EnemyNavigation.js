import * as THREE from 'three';

const tmpBox=new THREE.Box3();
const tmpMin=new THREE.Vector3();
const tmpMax=new THREE.Vector3();

export class EnemyNavigation {
  constructor({ radius=.34, maxSpeed=2.35, acceleration=5.2, separationRadius=1.6 }={}) {
    this.radius=radius;
    this.maxSpeed=maxSpeed;
    this.acceleration=acceleration;
    this.separationRadius=separationRadius;
    this._separation=new THREE.Vector3();
    this._delta=new THREE.Vector3();
    this._steer=new THREE.Vector3();
  }

  separation(self, others) {
    const result=this._separation.set(0,0,0);
    for(const other of others){
      if(!other || other===self || other.dead)continue;
      const delta=this._delta.copy(self.group.position).sub(other.group.position);
      delta.y=0;
      const d=delta.length();
      if(d>1e-4 && d<this.separationRadius){
        result.addScaledVector(delta.multiplyScalar(1/d),(this.separationRadius-d)/this.separationRadius);
      }
    }
    return result;
  }

  steer(self, desired, others) {
    const out=this._steer.copy(desired);
    out.addScaledVector(this.separation(self,others),1.25);
    if(out.length()>this.maxSpeed)out.setLength(this.maxSpeed);
    return out;
  }

  move(self, desired, dt, collisionBoxes, bounds) {
    const blend=1-Math.exp(-this.acceleration*dt);
    self.vel.lerp(desired,blend);
    if(desired.lengthSq()<.01)self.vel.multiplyScalar(Math.exp(-6*dt));

    this.moveAxis(self,'x',self.vel.x*dt,collisionBoxes,bounds);
    this.moveAxis(self,'z',self.vel.z*dt,collisionBoxes,bounds);
  }

  moveAxis(self, axis, delta, collisionBoxes, bounds) {
    if(Math.abs(delta)<1e-6)return;
    const before=self.group.position[axis];
    self.group.position[axis]+=delta;
    self.group.position.x=THREE.MathUtils.clamp(self.group.position.x,bounds.xMin,bounds.xMax);
    self.group.position.z=THREE.MathUtils.clamp(self.group.position.z,bounds.zMin,bounds.zMax);
    // V4: an elevated guard can only walk on its verified grapple-supported
    // terrace. Ground navigation keeps its existing authority unchanged.
    const elevated=self.sentry?.zone;
    if(elevated){
      const p=self.group.position;
      if(p.x<elevated.xMin||p.x>elevated.xMax||
         p.z<elevated.zMin||p.z>elevated.zMax){
        p[axis]=before;self.vel[axis]=0;return;
      }
    }
    const p=self.group.position,r=this.radius;
    const feet=elevated?p.y+.07:0;
    tmpMin.set(p.x-r,feet,p.z-r);
    tmpMax.set(p.x+r,(elevated?p.y:0)+2.35,p.z+r);
    tmpBox.set(tmpMin,tmpMax);
    if(collisionBoxes.some(box=>box.intersectsBox(tmpBox))){
      self.group.position[axis]=before;
      self.vel[axis]=0;
    }
  }
}

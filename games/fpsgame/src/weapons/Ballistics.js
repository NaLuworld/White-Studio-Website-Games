import * as THREE from 'three';

const hash01 = seed => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
};

export class Ballistics {
  constructor(config) {
    this.config = config;
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._result = { direction:this._direction, spread:0, offsetX:0, offsetY:0 };
  }

  spreadForState(state) {
    if (state === 'CROUCH') return this.config.spreadCrouch;
    if (state === 'LANDING') return this.config.spreadMoving * 1.1;
    if (state === 'AIRBORNE' || state === 'WALL_RUN' || state === 'SLIDE') return this.config.spreadMoving * 1.6;
    if (state === 'WALK' || state === 'SPRINT') return this.config.spreadMoving;
    return this.config.spreadStanding;
  }

  sample(camera, shotIndex, state, spreadScale=1) {
    // Gameplay flow improves handling, never cancels airborne/moving penalties.
    const scale=Number.isFinite(spreadScale)?Math.max(.7,Math.min(1,spreadScale)):1;
    const spread = this.spreadForState(state)*scale;
    const angle = hash01(shotIndex * 2 + 1) * Math.PI * 2;
    const radius = Math.sqrt(hash01(shotIndex * 2 + 2)) * spread;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    camera.getWorldDirection(this._forward);
    this._right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this._up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const direction=this._direction.copy(this._forward)
      .addScaledVector(this._right,x)
      .addScaledVector(this._up,y)
      .normalize();
    this._result.spread=spread;this._result.offsetX=x;this._result.offsetY=y;
    return this._result;
  }
}

import * as THREE from 'three';

const pattern = [
  [0.00, 1.00], [0.18, 1.08], [-0.12, 1.13], [0.24, 1.18],
  [-0.20, 1.20], [0.14, 1.23], [-0.08, 1.25], [0.20, 1.27]
];

const boundedNoise = seed => {
  const x = Math.sin(seed * 91.731 + 17.17) * 19423.331;
  return (x - Math.floor(x)) * 2 - 1;
};

export class RecoilModel {
  constructor(config) {
    this.config = config;
    this.cameraOffset = new THREE.Vector2();
    this.cameraVelocity = new THREE.Vector2();
    this.weaponKick = 0;
    this.weaponVelocity = 0;
  }

  impulse(shotIndex) {
    const [horizontal, vertical] = pattern[shotIndex % pattern.length];
    const random = boundedNoise(shotIndex + 1) * this.config.randomness;
    this.cameraVelocity.x += (horizontal + random) * this.config.cameraKickHorizontal;
    this.cameraVelocity.y += vertical * this.config.cameraKickVertical;
    this.weaponVelocity += this.config.weaponKick;
  }

  reset() {
    this.cameraOffset.set(0, 0);
    this.cameraVelocity.set(0, 0);
    this.weaponKick = 0;
    this.weaponVelocity = 0;
  }

  update(dt) {
    const spring = this.config.recoverySpring;
    const damping = Math.exp(-this.config.recoveryDamping * dt);

    this.cameraVelocity.x += -this.cameraOffset.x * spring * dt;
    this.cameraVelocity.y += -this.cameraOffset.y * spring * dt;
    this.cameraVelocity.multiplyScalar(damping);
    this.cameraOffset.addScaledVector(this.cameraVelocity, dt);

    this.weaponVelocity += -this.weaponKick * this.config.weaponSpring * dt;
    this.weaponVelocity *= Math.exp(-this.config.weaponDamping * dt);
    this.weaponKick += this.weaponVelocity * dt;

    if (this.cameraOffset.lengthSq() < 1e-10 && this.cameraVelocity.lengthSq() < 1e-8) {
      this.cameraOffset.set(0, 0);
      this.cameraVelocity.set(0, 0);
    }
    if (Math.abs(this.weaponKick) < 1e-5 && Math.abs(this.weaponVelocity) < 1e-4) {
      this.weaponKick = 0;
      this.weaponVelocity = 0;
    }
  }
}

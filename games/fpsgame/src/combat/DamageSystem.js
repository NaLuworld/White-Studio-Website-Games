import * as THREE from 'three';

const BODY_MULTIPLIERS=Object.freeze({
  head:2.5,
  torso:1,
  pelvis:.9,
  arm:.65,
  leg:.75
});

export class DamageSystem {
  constructor() {
    this.sequence=0;
    this.recent=[];
  }

  multiplier(bodyPart) {
    return BODY_MULTIPLIERS[bodyPart] ?? 1;
  }

  apply({source=null,target,amount=0,hitPoint=null,hitNormal=null,bodyPart='torso',direction=null,weaponId=null,timestamp=performance.now(),applyBodyMultiplier=true,silentTakedown=false}={}) {
    if(!target) return null;
    const baseAmount=Math.max(0,Number(amount)||0);
    const finalAmount=baseAmount*(applyBodyMultiplier?this.multiplier(bodyPart):1);
    const event={
      id:++this.sequence,
      source,
      target,
      amount:finalAmount,
      baseAmount,
      hitPoint:hitPoint?.clone?.() ?? null,
      hitNormal:hitNormal?.clone?.() ?? null,
      bodyPart,
      direction:direction?.clone?.() ?? new THREE.Vector3(),
      weaponId,
      silentTakedown:!!silentTakedown,
      timestamp
    };
    this.recent.push({
      id:event.id,
      source:source?.id ?? source?.constructor?.name ?? String(source ?? 'world'),
      target:target?.id ?? target?.constructor?.name ?? 'unknown',
      amount:event.amount,
      baseAmount:event.baseAmount,
      bodyPart:event.bodyPart,
      weaponId:event.weaponId,
      silentTakedown:event.silentTakedown,
      hitPoint:event.hitPoint?.toArray?.() ?? null,
      hitNormal:event.hitNormal?.toArray?.() ?? null,
      direction:event.direction?.toArray?.() ?? null,
      timestamp:event.timestamp
    });
    if(this.recent.length>24)this.recent.shift();
    target.receiveDamage?.(event);
    return event;
  }
}

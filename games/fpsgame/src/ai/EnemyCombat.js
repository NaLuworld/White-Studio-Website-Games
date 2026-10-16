export class EnemyCombat {
  constructor({ id=0, aimDelay=.62, burstMin=2, burstMax=3, shotInterval=.19, cooldown=.95, damage=4 }={}) {
    this.id=id;
    this.aimDelay=aimDelay;
    this.burstMin=burstMin;
    this.burstMax=burstMax;
    this.shotInterval=shotInterval;
    this.cooldownDuration=cooldown;
    this.damage=damage;

    this.phase='IDLE';
    this.aimRemaining=0;
    this.burstRemaining=0;
    this.shotTimer=0;
    this.cooldownRemaining=0;
    this.shotsFired=0;
    this.sequence=0;
  }

  reset() {
    this.phase='IDLE';
    this.aimRemaining=0;
    this.burstRemaining=0;
    this.shotTimer=0;
  }

  update(dt, { canFire, onFire }) {
    if(!canFire){
      this.reset();
      this.cooldownRemaining=Math.max(0,this.cooldownRemaining-dt);
      return;
    }

    if(this.cooldownRemaining>0){
      this.phase='COOLDOWN';
      this.cooldownRemaining=Math.max(0,this.cooldownRemaining-dt);
      return;
    }

    if(this.phase==='IDLE' || this.phase==='COOLDOWN'){
      this.phase='AIMING';
      this.aimRemaining=this.aimDelay + (this.id%3)*.06;
    }

    if(this.phase==='AIMING'){
      this.aimRemaining=Math.max(0,this.aimRemaining-dt);
      if(this.aimRemaining>0)return;
      this.phase='BURST';
      this.burstRemaining=this.burstMin + ((this.id+this.sequence)%Math.max(1,this.burstMax-this.burstMin+1));
      this.sequence++;
      this.shotTimer=0;
    }

    if(this.phase==='BURST'){
      this.shotTimer-=dt;
      if(this.shotTimer<=0 && this.burstRemaining>0){
        this.shotTimer=this.shotInterval;
        this.burstRemaining--;
        this.shotsFired++;
        onFire(this.damage);
      }
      if(this.burstRemaining<=0){
        this.phase='COOLDOWN';
        this.cooldownRemaining=this.cooldownDuration + (this.id%2)*.18;
      }
    }
  }
}

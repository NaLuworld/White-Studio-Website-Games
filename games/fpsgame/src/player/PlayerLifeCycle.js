export const PLAYER_LIFE_STATES=Object.freeze({
  ALIVE:'ALIVE',
  DYING:'DYING',
  RESPAWN_WAIT:'RESPAWN_WAIT',
  RESPAWN:'RESPAWN'
});

export class PlayerLifeCycle {
  constructor({player,onDamage,onDying,onRespawn,onAlive,dyingSeconds=.35,respawnWaitSeconds=.85}) {
    this.player=player;
    this.onDamage=onDamage;
    this.onDying=onDying;
    this.onRespawn=onRespawn;
    this.onAlive=onAlive;
    this.dyingSeconds=dyingSeconds;
    this.respawnWaitSeconds=respawnWaitSeconds;
    this.state=PLAYER_LIFE_STATES.ALIVE;
    this.timer=0;
    this.lastDamageEvent=null;
    this.deaths=0;
  }

  receiveDamage(event) {
    if(this.state!==PLAYER_LIFE_STATES.ALIVE)return false;
    this.lastDamageEvent=event;
    this.player.hp=Math.max(0,this.player.hp-event.amount);
    this.onDamage?.(event,this.player.hp);
    if(this.player.hp<=0){
      this.state=PLAYER_LIFE_STATES.DYING;
      this.timer=this.dyingSeconds;
      this.deaths++;
      this.onDying?.(event);
    }
    return true;
  }

  update(dt) {
    if(this.state===PLAYER_LIFE_STATES.ALIVE)return;
    this.timer=Math.max(0,this.timer-dt);
    if(this.timer>0)return;

    if(this.state===PLAYER_LIFE_STATES.DYING){
      this.state=PLAYER_LIFE_STATES.RESPAWN_WAIT;
      this.timer=this.respawnWaitSeconds;
      return;
    }
    if(this.state===PLAYER_LIFE_STATES.RESPAWN_WAIT){
      this.state=PLAYER_LIFE_STATES.RESPAWN;
      this.onRespawn?.();
      this.timer=.05;
      return;
    }
    if(this.state===PLAYER_LIFE_STATES.RESPAWN){
      this.player.hp=100;
      this.state=PLAYER_LIFE_STATES.ALIVE;
      this.onAlive?.();
    }
  }

  reset() {
    this.player.hp=100;
    this.state=PLAYER_LIFE_STATES.ALIVE;
    this.timer=0;
    this.lastDamageEvent=null;
  }
}

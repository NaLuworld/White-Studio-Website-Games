export const WEAPON_STATES = Object.freeze({
  EQUIPPING: 'EQUIPPING',
  READY: 'READY',
  FIRING: 'FIRING',
  COOLDOWN: 'COOLDOWN',
  RELOADING: 'RELOADING',
  EMPTY: 'EMPTY'
});

export class WeaponStateMachine {
  constructor({ roundsPerMinute, reloadSeconds, equipSeconds = 0.2, onShot, onReloadComplete, hasAmmo, canReload }) {
    this.shotInterval = 60 / roundsPerMinute;
    this.reloadSeconds = reloadSeconds;
    this.equipRemaining = equipSeconds;
    this.cooldownRemaining = 0;
    this.reloadRemaining = 0;
    this.triggerHeld = false;
    this.onShot = onShot;
    this.onReloadComplete = onReloadComplete;
    this.hasAmmo = hasAmmo;
    this.canReload = canReload;
    this.state = WEAPON_STATES.EQUIPPING;
    this.transitions = [{ from: null, to: this.state, reason: 'spawn' }];
  }

  transition(next, reason) {
    if (next === this.state) return;
    this.transitions.push({ from: this.state, to: next, reason });
    if (this.transitions.length > 16) this.transitions.shift();
    this.state = next;
  }

  setTrigger(held) {
    this.triggerHeld = !!held;
    if (this.triggerHeld && this.state === WEAPON_STATES.READY) this.tryShot();
  }

  triggerOnce() {
    if (this.state !== WEAPON_STATES.READY) return false;
    return this.tryShot();
  }

  tryShot() {
    if (!this.hasAmmo()) {
      this.transition(WEAPON_STATES.EMPTY, 'trigger-empty');
      return false;
    }
    const fired = this.onShot();
    if (!fired) return false;
    this.cooldownRemaining = this.shotInterval;
    this.transition(WEAPON_STATES.FIRING, 'shot');
    return true;
  }

  requestReload() {
    if (this.state === WEAPON_STATES.RELOADING || !this.canReload()) return false;
    this.triggerHeld = false;
    this.reloadRemaining = this.reloadSeconds;
    this.transition(WEAPON_STATES.RELOADING, 'reload-start');
    return true;
  }

  syncAmmoState() {
    if (this.state === WEAPON_STATES.RELOADING || this.state === WEAPON_STATES.EQUIPPING) return;
    if (!this.hasAmmo()) this.transition(WEAPON_STATES.EMPTY, 'ammo-empty');
    else if (this.state === WEAPON_STATES.EMPTY) this.transition(WEAPON_STATES.READY, 'ammo-available');
  }

  reset(reason='reset') {
    this.triggerHeld=false;
    this.cooldownRemaining=0;
    this.reloadRemaining=0;
    this.equipRemaining=0;
    this.transition(this.hasAmmo()?WEAPON_STATES.READY:WEAPON_STATES.EMPTY,reason);
  }

  update(dt) {
    dt = Math.max(0, dt);

    if (this.state === WEAPON_STATES.EQUIPPING) {
      this.equipRemaining = Math.max(0, this.equipRemaining - dt);
      if (this.equipRemaining <= 0) this.transition(this.hasAmmo() ? WEAPON_STATES.READY : WEAPON_STATES.EMPTY, 'equip-complete');
      return;
    }

    if (this.state === WEAPON_STATES.RELOADING) {
      this.reloadRemaining = Math.max(0, this.reloadRemaining - dt);
      if (this.reloadRemaining <= 0) {
        this.onReloadComplete();
        this.transition(this.hasAmmo() ? WEAPON_STATES.READY : WEAPON_STATES.EMPTY, 'reload-complete');
      }
      return;
    }

    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
      if (this.state === WEAPON_STATES.FIRING) this.transition(WEAPON_STATES.COOLDOWN, 'shot-frame-complete');
      if (this.cooldownRemaining > 0) return;
    }

    this.syncAmmoState();
    if (this.state === WEAPON_STATES.EMPTY) return;
    this.transition(WEAPON_STATES.READY, 'cooldown-complete');
    if (this.triggerHeld) this.tryShot();
  }
}

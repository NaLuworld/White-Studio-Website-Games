// Phase28: bounded single-edge pistol/knife action continuity.
// Never owns movement, weapon ammo/damage, or animation authority.
const ELIGIBLE_SLOTS=new Set([2,3]);
const BLOCKING_MOVES=new Set(['SPRINT','VAULT','MANTLE','LEDGE_HANG','WALL_RUN']);
export class CombatActionQueue {
  constructor({graceSeconds=.28}={}){
    if(!Number.isFinite(graceSeconds)||graceSeconds<=0||graceSeconds>.5)
      throw Error('Invalid action grace');
    this.grace=graceSeconds;this.pending=null;this.completed=0;this.expired=0;
  }
  arm({slot,state,mission,alive,contextLost=false,weaponState='READY'}={}){
    if(!ELIGIBLE_SLOTS.has(slot)||!BLOCKING_MOVES.has(state)||!mission||!alive||
      contextLost||weaponState==='RELOADING')return false;
    // Only one physical edge can be buffered at a time; repeated press does not
    // create extra ammo/attacks or extend the expiry timer.
    if(this.pending)return false;
    this.pending={slot,remaining:this.grace};return true;
  }
  clear(){this.pending=null;}
  advance(dt,{slot,valid=false,canFire=false,execute}={}){
    if(!this.pending)return false;
    if(!valid||slot!==this.pending.slot){this.clear();return false;}
    const step=Number.isFinite(dt)?Math.max(0,Math.min(.033,dt)):0;
    this.pending.remaining=Math.max(0,this.pending.remaining-step);
    if(this.pending.remaining===0){this.expired++;this.clear();return false;}
    if(canFire&&typeof execute==='function'&&execute()===true){
      this.completed++;this.clear();return true;
    }
    return false;
  }
  snapshot(){return {pending:this.pending?{...this.pending}:null,
    completed:this.completed,expired:this.expired,grace:this.grace};}
}

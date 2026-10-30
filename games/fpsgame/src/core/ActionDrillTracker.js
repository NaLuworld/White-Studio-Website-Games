// S0 experimental Action Sandbox Drill.
// An observer only: no position, damage, AI, objective, weapon or camera authority.
const REAL_TRAVERSAL=new Set(['SLIDE','VAULT','MANTLE','WALL_RUN','WALL_KICK']);
const REAL_WEAPONS=new Set(['station-rifle','station-pistol','station-knife']);
const VALID_INVESTIGATION=new Set(['INVESTIGATING','SEARCHING']);
const isPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z);
const clampStep=dt=>Number.isFinite(dt)?Math.max(0,Math.min(dt,.05)):0;

export class ActionDrillTracker {
  constructor(){this.reset();}
  reset(){
    this.distance=0;this.lastPosition=null;this.traversal=new Set();
    this.hitCount=0;this.meleeHits=0;this.gadgetUses=0;
    this.investigations=0;this.enemyHearings=0;this.pendingDistraction=0;
    this.completed={mobility:false,combat:false,tactics:false};
    this.chain={movementToCombat:false,combatToGadget:false};
    this.recentMovement=0;this.recentCombat=0;
  }
  recordTraversal(kind,{active=false}={}){
    if(active&&REAL_TRAVERSAL.has(kind)){
      this.traversal.add(kind);
      this.recentMovement=8;
      this._refresh();
      return true;
    }
    return false;
  }
  recordHit(event,{active=false}={}){
    if(!active||!event||!REAL_WEAPONS.has(event.weaponId)||
       !Number.isFinite(event.amount)||event.amount<=0)return false;
    this.hitCount++;
    if(event.weaponId==='station-knife')this.meleeHits++;
    if(this.recentMovement>0)this.chain.movementToCombat=true;
    this.recentCombat=8;
    this._refresh();
    return true;
  }
  recordGadget({active=false,slot=0,kind='',noise='',enemyHearings=0}={}){
    if(!active||slot!==1||kind!=='distraction'||noise!=='DISTRACTION')return false;
    this.gadgetUses++;
    // TraversalCombatDirector increments alerts ONLY after calling real Enemy.onNoise
    // on enemies within the physically validated decoy impact radius.
    if(Number.isFinite(enemyHearings)&&enemyHearings>0)this.enemyHearings+=Math.floor(enemyHearings);
    this.pendingDistraction=2.5;
    if(this.recentCombat>0)this.chain.combatToGadget=true;
    this._refresh();
    return true;
  }
  observe({active=false,position=null,enemies=[],dt=0}={}){
    if(!active){
      this.lastPosition=null;
      return this.snapshot();
    }
    const step=clampStep(dt);
    if(isPoint(position)){
      if(this.lastPosition){
        const delta=Math.hypot(position.x-this.lastPosition.x,position.z-this.lastPosition.z);
        // Ignore discontinuities such as debug reposition, respawn and frame hitch.
        if(step>0&&delta<=Math.max(.22,15*step))this.distance+=delta;
      }
      this.lastPosition={x:position.x,z:position.z};
    }
    if(step>0){
      if(this.pendingDistraction>0 &&
         Array.isArray(enemies) &&
         enemies.some(e=>!e.dead&&VALID_INVESTIGATION.has(e?.awareness?.phase??e?.phase))){
        this.investigations++;
        this.pendingDistraction=0;
      }else{
        this.pendingDistraction=Math.max(0,this.pendingDistraction-step);
      }
      this.recentMovement=Math.max(0,this.recentMovement-step);
      this.recentCombat=Math.max(0,this.recentCombat-step);
    }
    this._refresh();
    return this.snapshot();
  }
  _refresh(){
    if(this.distance>=6&&this.traversal.size>0)this.completed.mobility=true;
    if(this.hitCount>0)this.completed.combat=true;
    if(this.gadgetUses>0&&(this.investigations>0||this.enemyHearings>0))this.completed.tactics=true;
  }
  snapshot(){
    const completed={...this.completed};
    return {
      enabled:true,
      completed,
      count:Object.values(completed).filter(Boolean).length,
      done:Object.values(completed).every(Boolean),
      distance:+this.distance.toFixed(2),
      traversal:[...this.traversal],
      hitCount:this.hitCount,meleeHits:this.meleeHits,
      gadgetUses:this.gadgetUses,investigations:this.investigations,enemyHearings:this.enemyHearings,
      chain:{...this.chain}
    };
  }
}

// Phase 15: traversal risk/reward and audible awareness, never damage or vision authority.
// All timing uses simulated dt. AI still needs visible line of sight to fire.
export const NOISE_RADIUS=Object.freeze({
  STEP:2.8, RUN_STEP:6.5, SLIDE:8, VAULT:9, MANTLE:10,
  LEDGE_HANG:5, WALL_RUN:9, WALL_KICK:11,
  LANDING:7.5, DROP:6, SHOT:21, DISTRACTION:10.5, ALARM:18
});
const COMPLETIONS=new Set(['VAULT','MANTLE']);
const ACTIVE_FIRING_STATES=new Set(['IDLE','WALK','CROUCH','LANDING']);
const SAFE_CANCEL=new Set(['damage','death','player-dying','respawn','input-reset','reset','test-teleport']);
const MAX_WINDOW=.85;
export class TraversalCombatDirector {
  constructor(){
    this.flowRemaining=0;this.pendingLanding=0;
    this.rewards=0;this.noises=0;this.alerts=0;this.lastNoise=null;
  }
  clear(){
    this.flowRemaining=0;this.pendingLanding=0;
  }
  advance(dt){
    const bounded=Math.min(.033,Math.max(0,Number.isFinite(dt)?dt:0));
    this.flowRemaining=Math.max(0,this.flowRemaining-bounded);
    this.pendingLanding=Math.max(0,this.pendingLanding-bounded);
  }
  reward(){
    this.flowRemaining=MAX_WINDOW;
    this.pendingLanding=0;this.rewards++;
  }
  onTransition(event,origin,enemies=[]){
    if(!event)return;
    if(SAFE_CANCEL.has(event.reason)){this.clear();return;}
    const kind=event.to || (event.reason==='wall-kick'?'WALL_KICK':
      event.reason==='slide-jump'?'SLIDE_JUMP':
      event.reason==='ledge-drop'?'DROP':null);
    if(COMPLETIONS.has(event.from)&&event.reason==='motion-complete')this.reward();
    else if(event.reason==='wall-kick'||event.reason==='slide-jump')this.pendingLanding=1.65;
    else if(event.to==='LANDING'&&this.pendingLanding>0)this.reward();
    // Do not broadcast cancel/blocked/end transitions as phantom footsteps.
    if(event.to || ['wall-kick','ledge-drop','slide-jump'].includes(event.reason))
      this.emitNoise(kind==='SLIDE_JUMP'?'LANDING':kind,origin,enemies);
  }
  emitNoise(kind,origin,enemies=[]){
    const radius=NOISE_RADIUS[kind];
    if(!radius||!origin)return 0;
    this.noises++;this.lastNoise=kind;
    let alerts=0;
    for(const enemy of enemies){
      if(!enemy||enemy.dead||!enemy.perception||!enemy.group?.position)continue;
      const pos=enemy.group.position,dx=pos.x-origin.x,dz=pos.z-origin.z;
      if(dx*dx+dz*dz>radius*radius)continue;
      // Hearing gives approximate last-known position, not visibility or firing permission.
      if(typeof enemy.onNoise==='function')enemy.onNoise(origin,kind);
      else enemy.perception.forceRemember(origin);
      alerts++;
    }
    this.alerts+=alerts;
    return alerts;
  }
  spreadScale(state,grounded){
    return this.flowRemaining>0&&grounded&&ACTIVE_FIRING_STATES.has(state)?.72:1;
  }
  snapshot(){
    return {flowRemaining:this.flowRemaining,pendingLanding:this.pendingLanding,
      spreadScaleStanding:this.spreadScale('IDLE',true),rewards:this.rewards,
      noiseEvents:this.noises,alerts:this.alerts,lastNoise:this.lastNoise};
  }
}

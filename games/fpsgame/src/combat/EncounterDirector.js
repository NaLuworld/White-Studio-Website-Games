// Deterministic tactical encounter pacing over existing enemy objects and parkour routes.
// No spawns, no health/damage overrides and no authority over line of sight.
export const ENCOUNTER_SECTORS=Object.freeze([
  Object.freeze({
    id:'ENTRY',label:'ENTRY GATES',enemyIds:Object.freeze([0,4]),threshold:-12,
    slots:1,route:'VAULT AT ENTRY / MANTLE LEFT'
  }),
  Object.freeze({
    id:'CONCOURSE',label:'CONCOURSE FLANK',enemyIds:Object.freeze([1,2]),threshold:-35,
    slots:2,route:'WALL-RUN LEFT / MANTLE COVER'
  }),
  Object.freeze({
    id:'PLATFORM',label:'PLATFORM END',enemyIds:Object.freeze([3]),threshold:-Infinity,
    slots:2,route:'LOW VAULT AT PLATFORM EXIT'
  })
]);
const clampDt=dt=>Number.isFinite(dt)?Math.max(0,Math.min(.033,dt)):0;
const distance2=(a,b)=>{
  const dx=a.x-b.x,dz=a.z-b.z;
  return dx*dx+dz*dz;
};
export class EncounterDirector {
  constructor(sectors=ENCOUNTER_SECTORS){
    this.sectors=sectors;this.stage=0;this.turn=0;this.turnTimer=0;
    this.fireGrace=1.05;this.fireIds=new Set();
    this.activeIds=new Set(sectors[0].enemyIds);
    this.candidates=[];this.transitions=[];
    this.threatCount=0;this.engaged=0;this.hasWon=false;
    this.lastSignal='ENTRY GATES';this.signals=0;
    this.routeUses=[0,0,0];this.lastManeuver=null;
    this.routeBreaks=0;this.breakCooldown=0;this.breakRemaining=0;this.lowHealth=false;this.pressureSlots=1;
  }
  reset(){
    this.stage=0;this.turn=0;this.turnTimer=0;this.fireGrace=1.05;
    this.fireIds.clear();this.activeIds=new Set(this.sectors[0].enemyIds);
    this.candidates.length=0;this.transitions.length=0;
    this.threatCount=0;this.engaged=0;this.hasWon=false;
    this.lastSignal='ENTRY GATES';this.signals=0;
    this.routeUses=[0,0,0];this.lastManeuver=null;
    this.routeBreaks=0;this.breakCooldown=0;this.breakRemaining=0;this.lowHealth=false;this.pressureSlots=1;
  }
  clearStage(enemies,stage){
    return this.sectors[stage].enemyIds.every(id=>{
      const enemy=enemies.find(e=>e.id===id);
      return !enemy||enemy.dead;
    });
  }
  beginStage(next,reason){
    if(next<=this.stage||next>=this.sectors.length)return false;
    const previous=this.stage;
    this.stage=next;this.fireGrace=Math.max(this.fireGrace,.6);
    this.fireIds.clear();
    for(let i=previous+1;i<=next;i++)
      for(const id of this.sectors[i].enemyIds)this.activeIds.add(id);
    this.lastSignal=this.sectors[next].label;
    this.signals++;
    this.transitions.push({from:previous,to:next,reason});
    if(this.transitions.length>8)this.transitions.shift();
    return true;
  }
  noteContact(id,reason='contact'){
    const index=this.sectors.findIndex(sector=>sector.enemyIds.includes(id));
    if(index>this.stage)return this.beginStage(index,reason);
    return false;
  }
  noteTraversal(event){
    if(!event)return false;
    const completed=(event.reason==='motion-complete'&&
      (event.from==='VAULT'||event.from==='MANTLE'))||
      event.reason==='wall-kick'||event.reason==='slide-jump';
    if(!completed)return false;
    this.routeUses[this.stage]++;
    this.lastManeuver=event.reason==='motion-complete'?event.from:event.reason;
    // Only completed vault/mantle breaks contact, never an unlanded kick.
    // The cooldown prevents repeatedly farming firing immunity.
    if(event.reason==='motion-complete'&&this.breakCooldown<=0){
      this.respite(.38);this.breakRemaining=.38;
      this.breakCooldown=3.5;this.routeBreaks++;
    }
    return true;
  }
  respite(seconds=1.15){
    this.fireGrace=Math.max(this.fireGrace,Math.max(0,seconds));
    this.fireIds.clear();
  }
  interruptBreak(){
    if(this.breakRemaining>0){
      if(this.fireGrace<=this.breakRemaining+0.001)this.fireGrace=0;
      this.breakRemaining=0;
    }
  }
  update(dt,player,enemies,enabled=true,health=100){
    dt=clampDt(dt);
    this.breakCooldown=Math.max(0,this.breakCooldown-dt);
    this.breakRemaining=Math.max(0,this.breakRemaining-dt);
    // Low-HP assistance changes coordinated pressure, not individual damage.
    const wasLow=this.lowHealth;
    this.lowHealth=Number.isFinite(health)&&health>0&&health<=35;
    if(this.lowHealth&&!wasLow)this.respite(.5);
    // Opening later sectors on either exploration or prior clear prevents objective softlocks.
    for(let i=this.stage;i<this.sectors.length-1;i++){
      const current=this.sectors[this.stage];
      const threshold=current.threshold;
      const cleared=this.clearStage(enemies,this.stage);
      if(!(player.z<=threshold||cleared))break;
      this.beginStage(this.stage+1,cleared?'cleared':'crossed');
    }
    const alive=enemies.filter(e=>!e.dead);
    this.hasWon=alive.length===0;
    this.fireGrace=Math.max(0,this.fireGrace-dt);
    this.turnTimer+=dt;
    if(this.turnTimer>=2.8){this.turnTimer%=2.8;this.turn++;}
    this.candidates.length=0;
    let observed=0;
    for(const e of alive){
      if(!this.activeIds.has(e.id))continue;
      if(e.perception?.visible){
        observed++;
        const d=distance2(e.group.position,player)+
          (e.sentry?(e.group.position.y-player.y)**2:0);
        const range=e.fireRange??this.fireRange??15;
        if(d>=4.2*4.2&&d<=range*range)
          this.candidates.push(e);
      }
    }
    this.candidates.sort((a,b)=>{
      const da=distance2(a.group.position,player);
      const db=distance2(b.group.position,player);
      return da-db||a.id-b.id;
    });
    this.threatCount=observed;
    this.fireIds.clear();
    this.pressureSlots=this.lowHealth?1:this.sectors[this.stage].slots;
    if(enabled&&this.fireGrace<=0&&!this.hasWon&&this.candidates.length){
      const cap=Math.min(this.pressureSlots,this.candidates.length);
      for(let i=0;i<cap;i++)
        this.fireIds.add(this.candidates[(this.turn+i)%this.candidates.length].id);
    }
    this.engaged=this.fireIds.size;
    return this.stage;
  }
  role(id,visible=false){
    if(!this.isActive(id))return 'DORMANT';
    if(this.mayFire(id))return 'ANCHOR';
    return visible?'FLANK':'INVESTIGATE';
  }
  isActive(id){return this.activeIds.has(id);}
  mayFire(id){return this.fireGrace<=0&&this.fireIds.has(id);}
  snapshot(){
    const sector=this.sectors[this.stage];
    return {
      stage:this.stage,sector:sector.id,label:sector.label,route:sector.route,
      activeIds:[...this.activeIds].sort((a,b)=>a-b),
      shooters:[...this.fireIds].sort((a,b)=>a-b),
      slots:sector.slots,pressureSlots:this.pressureSlots,lowHealth:this.lowHealth,visibleThreats:this.threatCount,engaged:this.engaged,
      grace:this.fireGrace,turn:this.turn,routeUses:[...this.routeUses],lastManeuver:this.lastManeuver,
      breakCooldown:this.breakCooldown,breakRemaining:this.breakRemaining,routeBreaks:this.routeBreaks,
      transitions:[...this.transitions],
      victories:this.hasWon?1:0
    };
  }
}

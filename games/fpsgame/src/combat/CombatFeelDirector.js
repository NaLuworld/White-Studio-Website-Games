// Phase 18: presentation-only combat confirmation, damage direction and encounter telemetry.
// This module never changes hitscan, damage, enemy visibility or weapon permissions.
const LIMITS=Object.freeze({hit:.2,head:.3,kill:.5,impact:.17,hurt:.5,history:18});
const clock=dt=>Number.isFinite(dt)?Math.max(0,Math.min(.033,dt)):0;
export function incomingDirection(playerPosition,sourcePosition,yaw=0){
  if(!sourcePosition||!playerPosition||
    !Number.isFinite(sourcePosition.x)||!Number.isFinite(sourcePosition.z)||
    !Number.isFinite(playerPosition.x)||!Number.isFinite(playerPosition.z)||
    !Number.isFinite(yaw))return 'ENVIRONMENT';
  const dx=sourcePosition.x-playerPosition.x,dz=sourcePosition.z-playerPosition.z;
  if(dx*dx+dz*dz<.0001)return 'NEAR';
  const front=-dx*Math.sin(yaw)-dz*Math.cos(yaw);
  const right=dx*Math.cos(yaw)-dz*Math.sin(yaw);
  if(Math.abs(front)>=Math.abs(right))return front>=0?'FRONT':'BEHIND';
  return right>=0?'RIGHT':'LEFT';
}
export class CombatFeelDirector {
  constructor(){this.reset();}
  reset(){
    this.hitTime=0;this.hurtTime=0;this.impactTime=0;
    this.hitKind=null;this.hitText='';this.impactText='';this.hurtDirection=null;
    this.shots=0;this.confirmedHits=0;this.headHits=0;this.eliminations=0;
    this.surfaceImpacts=0;this.misses=0;this.damageTaken=0;this.damageEvents=0;
    this.history=[];
    this.simulatedSeconds=0;this.timeUnderPressure=0;this.timeQuiet=0;
    this.peakFiringLanes=0;this.stageSeconds=[0,0,0];
    this.totalShooterSeconds=0;
  }
  push(entry){
    this.history.push(entry);
    if(this.history.length>LIMITS.history)this.history.shift();
  }
  recordShot(result){
    if(!result||!['enemy','surface','miss'].includes(result.kind))return false;
    this.shots++;
    if(result.kind==='miss')this.misses++;
    if(result.kind==='surface'){
      this.surfaceImpacts++;
      this.impactTime=LIMITS.impact;
      const surface=typeof result.surface==='string'?result.surface:'solid';
      this.impactText='COVER / '+surface.toUpperCase().slice(0,12);
    }
    return true;
  }
  recordEnemyHit(event,{id=null,eliminated=false}={}){
    if(!event||!Number.isFinite(event.amount)||event.amount<=0)return false;
    this.confirmedHits++;
    const head=event.bodyPart==='head';
    if(head)this.headHits++;
    if(eliminated)this.eliminations++;
    this.hitKind=eliminated?'KILL':head?'HEAD':'HIT';
    this.hitTime=eliminated?LIMITS.kill:head?LIMITS.head:LIMITS.hit;
    this.hitText=(eliminated?'ELIMINATED':head?'HEADSHOT':'HIT CONFIRMED')+
      '  '+Math.round(event.amount);
    this.push({type:'confirmed-hit',targetId:id,kind:this.hitKind,
      bodyPart:event.bodyPart||'torso',amount:event.amount});
    return true;
  }
  recordPlayerDamage(event,playerPosition,yaw=0){
    if(!event||!Number.isFinite(event.amount)||event.amount<=0)return false;
    this.damageEvents++;this.damageTaken+=event.amount;
    this.hurtDirection=incomingDirection(playerPosition,event.source?.group?.position,yaw);
    this.hurtTime=LIMITS.hurt;
    this.push({type:'damage-taken',direction:this.hurtDirection,amount:event.amount});
    return true;
  }
  advance(dt,{stage=0,engaged=0}={}){
    const step=clock(dt);
    this.hitTime=Math.max(0,this.hitTime-step);
    this.hurtTime=Math.max(0,this.hurtTime-step);
    this.impactTime=Math.max(0,this.impactTime-step);
    this.simulatedSeconds+=step;
    if(Number.isInteger(stage)&&stage>=0&&stage<this.stageSeconds.length)
      this.stageSeconds[stage]+=step;
    const shooters=Number.isFinite(engaged)?Math.max(0,Math.min(5,Math.floor(engaged))):0;
    if(shooters){this.timeUnderPressure+=step;this.totalShooterSeconds+=shooters*step;}
    else this.timeQuiet+=step;
    this.peakFiringLanes=Math.max(this.peakFiringLanes,shooters);
  }
  clearTransient(){
    this.hitTime=0;this.hurtTime=0;this.impactTime=0;
    this.hitKind=null;this.hitText='';this.impactText='';this.hurtDirection=null;
  }
  snapshot(){
    return {
      hitTime:this.hitTime,hitKind:this.hitTime>0?this.hitKind:null,
      hitText:this.hitTime>0?this.hitText:'',
      impactTime:this.impactTime,impactText:this.impactTime>0?this.impactText:'',
      hurtTime:this.hurtTime,hurtDirection:this.hurtTime>0?this.hurtDirection:null,
      shots:this.shots,confirmedHits:this.confirmedHits,headHits:this.headHits,
      eliminations:this.eliminations,surfaceImpacts:this.surfaceImpacts,misses:this.misses,
      damageEvents:this.damageEvents,damageTaken:this.damageTaken,
      history:[...this.history],simulatedSeconds:this.simulatedSeconds,
      timeUnderPressure:this.timeUnderPressure,timeQuiet:this.timeQuiet,
      totalShooterSeconds:this.totalShooterSeconds,peakFiringLanes:this.peakFiringLanes,
      stageSeconds:[...this.stageSeconds]
    };
  }
}

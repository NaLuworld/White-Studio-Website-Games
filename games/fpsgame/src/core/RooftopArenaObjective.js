// The rooftop ENTRY DRILL is a bounded playable slice, not a full Z1-Z5 level.
// Use the existing EncounterDirector with rooftop-owned pacing. Both guards
// are alive and perceptive from normal START; no Station sector gates apply.
export const ROOFTOP_ENTRY_SECTORS=Object.freeze([
  Object.freeze({id:'ROOFTOP_ENTRY',label:'ROOFTOP / SERVICE APPROACH',
    enemyIds:Object.freeze([0,1]),threshold:-Infinity,slots:1,
    route:'CENTRAL COVER / WEST STEALTH / EAST PARKOUR'})
]);
export const ROOFTOP_ENTRY=Object.freeze({
  spawn:Object.freeze({x:0,z:44}), targetId:1,
  exit:Object.freeze({x:-6,z:-18,radius:2.2}),
  quietExit:Object.freeze({x:-12.5,z:-16.5,radius:1.2})
});
const LEGAL_WEAPONS=new Set(['station-rifle','station-pistol','station-knife']);
export class RooftopArenaObjective {
  constructor(){this.reset();}
  reset(){this.targetDown=false;this.silentFinish=false;this.meleeFinish=false;
    this.westEntered=false;this.westPassed=false;this.bypassFinish=false;
    this.eastVaults=0;this.eastFlankFinish=false;
    this.quietIntact=true;this.done=false;}
  // Actual PlayerController VAULT completion, NOT a position-only waypoint.
  // Each collider-backed east gate must be cleared in order at its south landing.
  vault(event,{active=false,alive=false,grounded=false,position=null}={}){
    if(!active||!alive||!grounded||this.done||this.targetDown||
      event?.from!=='VAULT'||event?.to!==null||event?.reason!=='motion-complete'||
      !Number.isFinite(position?.x)||!Number.isFinite(position?.z))return false;
    const gate=this.eastVaults===0?24.5:this.eastVaults===1?9:null;
    if(gate===null||position.x<7||position.x>11||
       position.z>gate-.6||position.z<gate-2.5)return false;
    this.eastVaults++;
    return true;
  }
  hit(event,id,eliminated,{active=false}={}){
    if(!active||this.done||this.targetDown||id!==ROOFTOP_ENTRY.targetId||!eliminated||
       !LEGAL_WEAPONS.has(event?.weaponId)||!Number.isFinite(event?.amount)||event.amount<=0)return false;
    this.targetDown=true;
    this.meleeFinish=event.weaponId==='station-knife';
    this.silentFinish=this.meleeFinish&&event.silentTakedown===true;
    return true;
  }
  observe({active=false,alive=false,grounded=false,position=null,stealthClear=false,noFirearms=false,noKills=false}={}){
    if(!active||!alive||this.done)return false;
    if(!Number.isFinite(position?.x)||!Number.isFinite(position?.z))return false;
    // Quiet approach must stay clear for the ENTIRE run, not only at the exit.
    if(!stealthClear||!noFirearms||!noKills)this.quietIntact=false;
    if(grounded&&this.quietIntact){
      if(position.x<=-12&&position.z<=7&&position.z>=0)this.westEntered=true;
      if(this.westEntered&&position.x<=-12&&position.z<=-15&&position.z>=-19)this.westPassed=true;
    }
    if(!grounded)return false;
    if(!this.targetDown){
      // Genuine separate west-side extraction: the main combat exit is NOT a
      // silent shortcut and players never have to cross into the guard's LOS.
      if(!this.westPassed||!this.quietIntact)return false;
      if(Math.hypot(position.x-ROOFTOP_ENTRY.quietExit.x,
        position.z-ROOFTOP_ENTRY.quietExit.z)>ROOFTOP_ENTRY.quietExit.radius)return false;
      this.bypassFinish=true;
    }else if(Math.hypot(position.x-ROOFTOP_ENTRY.exit.x,
       position.z-ROOFTOP_ENTRY.exit.z)>ROOFTOP_ENTRY.exit.radius)return false;
    this.eastFlankFinish=this.targetDown&&this.eastVaults===2;
    this.done=true;return true;
  }
  snapshot(){return {enabled:true,targetDown:this.targetDown,silentFinish:this.silentFinish,
    meleeFinish:this.meleeFinish,eastVaults:this.eastVaults,
    eastFlankFinish:this.eastFlankFinish,westEntered:this.westEntered,westPassed:this.westPassed,
    bypassFinish:this.bypassFinish,quietIntact:this.quietIntact,done:this.done,spawn:{...ROOFTOP_ENTRY.spawn},
    exit:{...ROOFTOP_ENTRY.exit},quietExit:{...ROOFTOP_ENTRY.quietExit},targetId:ROOFTOP_ENTRY.targetId};}
}

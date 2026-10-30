// An original opt-in physical mini-mission. No motor, damage, AI or camera authority.
const SPAWN=Object.freeze({x:-7.4,z:-25.4});
const EXIT=Object.freeze({x:-3.2,z:-33.1,radius:2.1});
const VALID_WEAPONS=new Set(['station-rifle','station-pistol','station-knife']);
export const ACTION_CIRCUIT=Object.freeze({spawn:SPAWN,exit:EXIT,targetId:1});

export class ActionCircuitObjective {
 constructor(){this.reset();}
 reset(){
  this.wallRan=false;this.wallKicked=false;this.targetDown=false;
  this.meleeFinish=false;this.silentFinish=false;this.done=false;
 }
 traversal(event,{active=false}={}){
  if(!active||!event)return false;
  if(event.to==='WALL_RUN'){this.wallRan=true;return true;}
  if(event.reason==='wall-kick'&&event.from==='WALL_RUN'&&this.wallRan){
   this.wallKicked=true;return true;
  }
  return false;
 }
 hit(event,id,eliminated,{active=false}={}){
  if(!active||this.done||!this.wallKicked||id!==ACTION_CIRCUIT.targetId||!eliminated||
     !VALID_WEAPONS.has(event?.weaponId)||!Number.isFinite(event?.amount)||event.amount<=0)return false;
  this.targetDown=true;
  this.meleeFinish=event.weaponId==='station-knife';
  this.silentFinish=this.meleeFinish&&event.silentTakedown===true;
  return true;
 }
 observe({active=false,alive=false,grounded=false,position=null}={}){
  if(!active||!alive||!grounded||!this.wallKicked||!this.targetDown||this.done)return false;
  const x=position?.x,z=position?.z;
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  if(Math.hypot(x-EXIT.x,z-EXIT.z)>EXIT.radius)return false;
  this.done=true;
  return true;
 }
 snapshot(){
  return {enabled:true,wallRan:this.wallRan,wallKicked:this.wallKicked,
   targetDown:this.targetDown,meleeFinish:this.meleeFinish,
   silentFinish:this.silentFinish,done:this.done,
   spawn:{...SPAWN},exit:{...EXIT},targetId:ACTION_CIRCUIT.targetId};
 }
}

// Phase24 ADS plus S1 physical-speed presentation; sole camera FOV writer.
import {motionFovTarget} from '../player/MovementCameraProfile.js?v=merged-city-1';
const BLOCKED=new Set(['SPRINT','SLIDE','VAULT','MANTLE','LEDGE_HANG','WALL_RUN','DEAD']);
export class ADSController {
 constructor(camera,{hipFov=72,rifleFov=55,pistolFov=59}={}){
  this.camera=camera;this.hipFov=hipFov;this.rifleFov=rifleFov;this.pistolFov=pistolFov;
  this.qHeld=false;this.rmbHeld=false;this.aiming=false;this.progress=0;
  this.motionFov=0;this.reducedMotion=false;this.pistolAiming=false;
  this.state='HIP';
 }
 setHold(source,down){
  if(source==='q'){this.qHeld=!!down;return true;}
  if(source==='rmb'){this.rmbHeld=!!down;return true;}
  return false;
 }
 setReducedMotion(enabled){
  this.reducedMotion=!!enabled;
  if(this.reducedMotion){
   this.motionFov=0;
   this.setFov(this.hipFov+((this.pistolAiming?this.pistolFov:this.rifleFov)-this.hipFov)*this.progress);
  }
 }
 reset(){
  this.qHeld=false;this.rmbHeld=false;this.aiming=false;this.progress=0;this.motionFov=0;this.state='HIP';
  this.setFov(this.hipFov);
 }
 setFov(value){
  if(!this.camera||!Number.isFinite(value)||value<=0)return;
  if(Math.abs(this.camera.fov-value)<.000001)return;
  this.camera.fov=value;this.camera.updateProjectionMatrix?.();
 }
 step(dt,{slot=1,weaponState='READY',playerState='IDLE',traversalState=null,
   mission=false,alive=false,locked=false,fallback=false,testActive=false,contextLost=false,
   speed=0}={}){
  const interactive=(locked||fallback||testActive);
  const requested=this.qHeld||(this.rmbHeld&&locked);
  const firearm=slot===1||slot===2;
  const ready=weaponState!=='RELOADING'&&weaponState!=='EQUIPPING';
  const allowed=mission&&alive&&!contextLost&&interactive&&firearm&&ready&&
    !BLOCKED.has(playerState)&&!BLOCKED.has(traversalState);
  this.aiming=!!(requested&&allowed);
  const time=Number.isFinite(dt)?Math.max(0,Math.min(.033,dt)):0;
  const alpha=1-Math.exp(-18*time);
  this.progress+=((this.aiming?1:0)-this.progress)*alpha;
  if(this.progress<.0001&&!this.aiming)this.progress=0;
  if(this.progress>.9999&&this.aiming)this.progress=1;
  this.state=this.progress===0?'HIP':this.progress===1?'AIMED':
    this.aiming?'RAISING':'LOWERING';
  const aimFov=slot===2?this.pistolFov:this.rifleFov;
  this.pistolAiming=slot===2;
  const target=motionFovTarget({speed,playerState,traversalState,reducedMotion:this.reducedMotion,
   mission,alive,interactive,contextLost});
  this.motionFov+=((this.aiming?0:target)-this.motionFov)*(1-Math.exp(-12*time));
  if(this.motionFov<.0001&&target===0)this.motionFov=0;
  this.setFov(this.hipFov+(aimFov-this.hipFov)*this.progress+this.motionFov*(1-this.progress));
  return this.progress;
 }
 spreadScale(){return this.aiming&&this.progress>.5?.7:1;}
 snapshot(){return {state:this.state,active:this.aiming,progress:this.progress,
    fov:this.camera?.fov??this.hipFov,motionFov:this.motionFov,reducedMotion:this.reducedMotion,
    qHeld:this.qHeld,rmbHeld:this.rmbHeld};}
}

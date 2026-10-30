import {ParkourSensor} from './ParkourSensor.js';
import {TraversalStateMachine,TRAVERSAL_STATES as STATES} from './TraversalStateMachine.js';
import {TraversalMotion} from './TraversalMotion.js';
import {advanceSlide} from './SlideDynamics.js';
import {slideCameraFeel} from './SlideCameraFeel.js?v=slide-cam-1';
import {SprintSlideIntent} from './SprintSlideIntent.js';
import {WallKickCarry} from './WallKickCarry.js';

// Traversal decides intent. The PlayerController remains the only writer of player position.
export class ParkourController {
  constructor(player,boxes,onTransition=null){
    this.player=player;this.sensor=new ParkourSensor(boxes,player.config);
    this.machine=new TraversalStateMachine(onTransition);this.motion=new TraversalMotion();
    this.wallKickCarry=new WallKickCarry();
    this.timer=0;this.cooldown=0;this.slideSpeed=0;this.slideX=0;this.slideZ=0;
    this.wallSide=null;this.wallNormalX=0;this.wallNormalZ=0;this.lastResult='idle';this._direction={x:0,z:-1};
    this.wallKickBuffer=0;
    this.slideIntent=new SprintSlideIntent();
  }
  get state(){return this.machine.state;}
  queueSlideTap(){this.slideIntent.queueTap();}
  direction(){const yaw=this.player.controls.yaw;this._direction.x=-Math.sin(yaw);this._direction.z=-Math.cos(yaw);return this._direction;}
  reset(reason='reset'){
    this.machine.cancel(reason);this.motion.cancel();this.timer=0;this.cooldown=0;
    this.slideSpeed=0;this.wallSide=null;this.lastResult='idle';this.wallKickCarry.reset();
    this.wallKickBuffer=0;this.slideIntent.reset();this.player.controls.setTraversalRoll(0);
  }
  cancel(reason='interrupt'){
    if(reason!=='wall-kick')this.wallKickCarry.reset();
    this.wallKickBuffer=0;
    if(['input-reset','respawn','player-death','reset'].includes(reason))this.slideIntent.reset();
    if(!this.state)return;
    this.machine.cancel(reason);this.motion.cancel();this.timer=0;
    this.wallSide=null;this.cooldown=Math.max(this.cooldown,.23);
  }
  beginMotion(kind,obstacle,fromLedge=false){
    const player=this.player;
    const target=kind===STATES.VAULT?obstacle.vaultTarget:obstacle.mantleTarget;
    if(!target||!this.sensor.isFree(target.x,target.z,target.y))return false;
    this.motion.begin(kind,{x:player.camera.position.x,z:player.camera.position.z,y:player.feetY},
      target,obstacle.top,kind===STATES.VAULT?.58:fromLedge?.82:.74);
    this.machine.enter(kind,fromLedge?'ledge-climb':'obstacle-clear');
    player.horizontalVelocity.set(0,0,0);player.velocity.y=0;player.onGround=false;
    this.timer=0;return true;
  }
  // A slightly early air-space press can connect to an imminent PHYSICAL wall run.
  // Never queue on the ground, away from tagged geometry, or without forward motion.
  bufferWallKick(){
    const p=this.player;
    if(p.onGround||this.state||this.cooldown>0||p.crouch||!p.keys?.has('KeyW'))return false;
    if(Math.hypot(p.horizontalVelocity.x,p.horizontalVelocity.z)<3.2)return false;
    const d=this.direction();
    if(!this.sensor.wall(p.camera.position.x,p.camera.position.z,p.feetY,d.x,d.z,-1)&&
       !this.sensor.wall(p.camera.position.x,p.camera.position.z,p.feetY,d.x,d.z,1))return false;
    this.wallKickBuffer=.14;
    return true;
  }
  jump(){
    const p=this.player;
    if(this.state===STATES.LEDGE_HANG){
      const d=this.direction(),o=this.sensor.forward(p.camera.position.x,p.camera.position.z,p.feetY,d.x,d.z);
      if(o?.canMantle)return this.beginMotion(STATES.MANTLE,o,true);
      this.cancel('ledge-climb-blocked');return false;
    }
    if(this.state===STATES.WALL_RUN){
      const d=this.direction();
      p.horizontalVelocity.set(d.x*5.8+this.wallNormalX*4.5,0,d.z*5.8+this.wallNormalZ*4.5);
      this.wallKickCarry.begin(this.wallNormalX,this.wallNormalZ);
      p.velocity.y=6.4;p.onGround=false;this.cancel('wall-kick');this.cooldown=.7;
      return true;
    }
    if(this.state===STATES.SLIDE){this.cancel('slide-jump');p.crouch=false;return null;}
    if(this.state)return false;
    if(!p.onGround)return this.bufferWallKick();
    const d=this.direction(),hit=this.sensor.forward(p.camera.position.x,p.camera.position.z,p.feetY,d.x,d.z);
    const approach=p.horizontalVelocity.x*d.x+p.horizontalVelocity.z*d.z;
    if(hit&&approach>1.8){
      if(hit.canVault)return this.beginMotion(STATES.VAULT,hit);
      if(hit.canMantle)return this.beginMotion(STATES.MANTLE,hit);
    }
    return null;
  }
  afterMotor(dt,forwardHeld){
    const p=this.player;
    if(this.state||this.cooldown>0||p.onGround||!forwardHeld)return;
    const d=this.direction(),speed=Math.hypot(p.horizontalVelocity.x,p.horizontalVelocity.z);
    if(speed>4.2){
      const side=this.sensor.wall(p.camera.position.x,p.camera.position.z,p.feetY,d.x,d.z,-1)||
                 this.sensor.wall(p.camera.position.x,p.camera.position.z,p.feetY,d.x,d.z,1);
      if(side){
        this.wallSide=side.side<0?'LEFT':'RIGHT';this.wallNormalX=side.normalX;this.wallNormalZ=side.normalZ;
        this.machine.enter(STATES.WALL_RUN,'side-wall');this.timer=0;p.velocity.y=Math.max(p.velocity.y,-.7);
        if(this.wallKickBuffer>0)this.jump();
        return;
      }
    }
    if(p.velocity.y>0.25||speed<1.2)return;
    const hit=this.sensor.forward(p.camera.position.x,p.camera.position.z,p.feetY,d.x,d.z);
    if(hit?.ledge&&hit.canMantle&&hit.top-p.feetY>.50&&hit.top-p.feetY<1.75){
      this.machine.enter(STATES.LEDGE_HANG,'descending-ledge');this.timer=0;
      p.velocity.y=0;p.horizontalVelocity.set(0,0,0);p.onGround=false;
    }
  }
  update(dt,input){
    const p=this.player,s=this.sensor,d=this.direction();
    this.cooldown=Math.max(0,this.cooldown-dt);
    this.wallKickBuffer=Math.max(0,this.wallKickBuffer-dt);
    if(p.onGround)this.wallKickBuffer=0;
    this.timer+=dt;
    const slideTap=this.slideIntent.update(dt,{
      ctrl:input.crouch,sprint:input.sprint,forward:input.forward,grounded:p.onGround,
      speed:Math.hypot(p.horizontalVelocity.x,p.horizontalVelocity.z),eligible:!this.state
    });
    const state=this.state;
    if(state===STATES.VAULT||state===STATES.MANTLE){
      this.lastResult=this.motion.step(dt,p);
      if(this.lastResult==='blocked')this.cancel('sweep-blocked');
      else if(this.lastResult==='done'){
        p.feetY=this.motion.target.y;p.verticalOffset=p.feetY;p.velocity.y=0;p.onGround=true;
        this.cancel('motion-complete');this.cooldown=.24;
      }
      return true;
    }
    if(state===STATES.LEDGE_HANG){
      if(input.crouch||input.backward){this.cancel('ledge-drop');p.velocity.y=-1;return true;}
      if(input.forward&&this.timer>.20){this.jump();return true;}
      p.velocity.y=0;p.onGround=false;return true;
    }
    if(state===STATES.WALL_RUN){
      const wall=s.wall(p.camera.position.x,p.camera.position.z,p.feetY,d.x,d.z,this.wallSide==='LEFT'?-1:1);
      const speed=Math.hypot(p.horizontalVelocity.x,p.horizontalVelocity.z);
      if(!wall||speed<3.0||this.timer>1.35||p.onGround){this.cancel('wall-end');return false;}
      this.wallNormalX=wall.normalX;this.wallNormalZ=wall.normalZ;
      p.horizontalVelocity.x=d.x*Math.min(8.6,speed);
      p.horizontalVelocity.z=d.z*Math.min(8.6,speed);
      p.moveAxis('x',p.horizontalVelocity.x*dt);p.moveAxis('z',p.horizontalVelocity.z*dt);
      p.velocity.y=Math.max(-2.2,p.velocity.y);
      p.moveVertical(dt,.32);
      p.velocity.y=Math.max(-2.2,p.velocity.y);
      if(p.onGround){this.cancel('wall-landed');return true;}
      const desiredRoll=(this.wallSide==='LEFT'?-1:1)*.105;
      p.controls.setTraversalRoll(p.controls.traversalRoll+(desiredRoll-p.controls.traversalRoll)*(1-Math.exp(-12*dt)));
      return true;
    }
    if(state===STATES.SLIDE){
      if(!p.onGround){this.cancel('slide-airborne');return false;}
      advanceSlide(this,d.x,d.z,dt,input.forward);
      const feel=slideCameraFeel({speed:this.slideSpeed,elapsed:this.timer,slideX:this.slideX,slideZ:this.slideZ,
        yaw:p.controls.yaw,reducedMotion:p.controls.reducedMotion});
      // Bank follows real slide steering; never mutate look yaw.
      p.controls.setTraversalRoll(p.controls.traversalRoll+(feel.roll-p.controls.traversalRoll)*
        (1-Math.exp(-13*dt)));
      p.horizontalVelocity.set(this.slideX*this.slideSpeed,0,this.slideZ*this.slideSpeed);
      const ox=p.camera.position.x,oz=p.camera.position.z;
      p.moveAxis('x',p.horizontalVelocity.x*dt);p.moveAxis('z',p.horizontalVelocity.z*dt);
      if((Math.abs(p.camera.position.x-ox)+Math.abs(p.camera.position.z-oz))<.0001||this.slideSpeed<2.8||
        this.timer>1.15)this.cancel('slide-exit');
      return true;
    }
    if(slideTap&&p.onGround&&!this.cooldown){
      const speed=Math.hypot(p.horizontalVelocity.x,p.horizontalVelocity.z);
      if(speed>3.7){
        this.slideIntent.consume();
        this.machine.enter(STATES.SLIDE,'sprint-ctrl-tap');this.timer=0;
        this.slideX=p.horizontalVelocity.x/speed;this.slideZ=p.horizontalVelocity.z/speed;
        this.slideSpeed=Math.min(10.1,speed+1.15);
        return true; // Start the physical slide on the next positive-time update.
      }
    }
    p.controls.setTraversalRoll(p.controls.traversalRoll*Math.exp(-10*dt));
    return false;
  }
  snapshot(){
    const p=this.player,d=this.direction();
    return {state:this.state||p.state,transitions:[...this.machine.transitions],
      ...this.sensor.snapshot(p.camera.position.x,p.camera.position.z,p.feetY,d.x,d.z),
      traversalProgress:this.motion.active?this.motion.progress:0,slideSpeed:this.slideSpeed,
      slideDirection:[this.slideX,this.slideZ],
      wallSide:this.wallSide,cooldown:this.cooldown,wallKick:this.wallKickCarry.snapshot(),
      wallKickBuffer:this.wallKickBuffer,slideIntent:this.slideIntent.snapshot(),
      feetY:p.feetY,lastResult:this.lastResult};
  }
}

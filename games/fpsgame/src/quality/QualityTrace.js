// Phase27: passive, debug/autotest-only action trace for the Golden Route.
// Browser event-to-observed-action timing is NOT hardware/USB input latency.
const MAX_EVENTS=96;
const CODES=new Set(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyQ','KeyR','Digit1','Digit2','Digit3']);
const safeMs=value=>Number.isFinite(value)?Math.max(0,Math.round(value*100)/100):0;
export class QualityTrace {
  constructor({now=()=>performance.now()}={}){
    this.now=now;this.reset();
  }
  reset(){
    this.events=[];this.eventCount=0;this.frameSamples=0;this.slowFrames=0;this.lastFrame=null;
    this.lastState=null;this.lastSlot=null;this.lastShots=null;this.lastKills=null;
    this.maxFrameGapMs=0;this.frameIntervals=[];
  }
  push(type,detail={}){
    this.events.push({type,tMs:safeMs(this.now()),...detail});
    this.eventCount++;
    if(this.events.length>MAX_EVENTS)this.events.shift();
  }
  input(event,down){
    if(!event)return;
    const code=event.code;
    if(event.type?.startsWith('key')&&!CODES.has(code))return;
    if(event.repeat)return;
    this.push('INPUT',{source:event.type?.startsWith('key')?'keyboard':'mouse',
      key:event.type?.startsWith('key')?code:event.button,down:!!down});
  }
  mark(type,detail={}){this.push(type,detail);}
  frame(now,{state,slot,shots,kills}={}){
    if(!Number.isFinite(now))return;
    if(this.lastFrame!==null){
      const ms=Math.max(0,now-this.lastFrame);
      if(ms>0){
        this.frameSamples++;if(ms>16.667)this.slowFrames++;
        this.maxFrameGapMs=Math.max(this.maxFrameGapMs,ms);
        this.frameIntervals.push(safeMs(ms));
        if(this.frameIntervals.length>180)this.frameIntervals.shift();
      }
    }
    this.lastFrame=now;
    if(state!==undefined&&this.lastState!==state){this.push('MOVEMENT_STATE',{state});this.lastState=state;}
    if(slot!==undefined&&this.lastSlot!==slot){this.push('SLOT',{slot});this.lastSlot=slot;}
    if(Number.isFinite(shots)&&this.lastShots!==shots){if(this.lastShots!==null&&shots>this.lastShots)this.push('FIRE',{shotCount:shots});this.lastShots=shots;}
    if(Number.isFinite(kills)&&this.lastKills!==kills){if(this.lastKills!==null&&kills>this.lastKills)this.push('KILL',{kills});this.lastKills=kills;}
  }
  snapshot(){
    const sorted=[...this.frameIntervals].sort((a,b)=>a-b);
    return {events:this.events.map(e=>({...e})),eventCount:this.eventCount,
      frameSamples:this.frameSamples,slowFrames:this.slowFrames,
      maxFrameGapMs:safeMs(this.maxFrameGapMs),
      rollingP95Ms:sorted.length?sorted[Math.ceil(sorted.length*.95)-1]:null,
      limitations:'Browser callback and rAF observation only, NOT hardware input latency'};
  }
}

// Input-side slide buffer. A real grounded sprint arms a short grace window;
// only a NEW Ctrl press can spend it. No wall-clock or per-frame key-repeat.
const finite=x=>Number.isFinite(x)?x:0;
export const SLIDE_GRACE_SECONDS=1;
export const SLIDE_MIN_SPEED=3.7;
export class SprintSlideIntent {
  constructor(){this.reset();}
  reset(){this.grace=0;this.ctrlDown=false;this.pendingTap=false;}
  queueTap(){this.pendingTap=true;} // browser keydown can be shorter than a render frame
  update(dt,{ctrl=false,sprint=false,forward=false,grounded=false,speed=0,eligible=true}={}){
    const step=Math.max(0,Math.min(.033,finite(dt)));
    const moving=Number.isFinite(speed)&&speed>SLIDE_MIN_SPEED;
    const validSprint=!!grounded&&!!forward&&!!sprint&&moving&&!!eligible;
    // Keydown precedes the next simulation step: a tap in the final frame of
    // grace must count, not expire one frame early due to frame quantization.
    const inWindow=this.grace>0||validSprint;
    // Losing W ends this sprint chain. Pressing W again cannot reuse
    // the grace from a previous run, even if it was under one second ago.
    this.grace=!forward?0:validSprint?SLIDE_GRACE_SECONDS:Math.max(0,this.grace-step);
    const down=!!ctrl;
    const pressed=this.pendingTap||(down&&!this.ctrlDown);
    this.ctrlDown=down;
    this.pendingTap=false;
    // Ctrl is ordinary crouch unless W remains held from an actual sprint.
    return pressed&&!!forward&&grounded&&eligible&&moving&&inWindow;
  }
  consume(){this.grace=0;} // new sprint activity required for another slide
  snapshot(){return {grace:this.grace,ctrlDown:this.ctrlDown};}
}

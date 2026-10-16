export const TRAVERSAL_STATES = Object.freeze({
  SLIDE:'SLIDE', VAULT:'VAULT', MANTLE:'MANTLE', LEDGE_HANG:'LEDGE_HANG', WALL_RUN:'WALL_RUN'
});
export class TraversalStateMachine {
  constructor(onTransition=null){this.state=null;this.transitions=[];this.onTransition=onTransition;}
  enter(next,reason='input'){
    if(this.state===next)return;
    const event={from:this.state,to:next,reason};
    this.transitions.push(event);
    if(this.transitions.length>20)this.transitions.shift();
    this.state=next;
    this.onTransition?.(event);
  }
  cancel(reason='cancel'){this.enter(null,reason);}
}

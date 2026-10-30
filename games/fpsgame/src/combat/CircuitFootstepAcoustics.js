// Sound intensity for opt-in Action Circuit, never grants enemy sight or damage.
// Only actual grounded locomotion/cadence emits an event. Physical speed is required.
export function circuitFootstepKind({
  active=false,alive=false,grounded=false,state='',speed=0
}={}){
  if(!active||!alive||!grounded||!Number.isFinite(speed)||speed<=.22)return null;
  if(state==='SPRINT'&&speed>=4.5)return 'RUN_STEP';
  if(state==='WALK')return 'STEP';
  return null; // CROUCH, AIRBORNE, SLIDE, and stationary are not audible steps.
}

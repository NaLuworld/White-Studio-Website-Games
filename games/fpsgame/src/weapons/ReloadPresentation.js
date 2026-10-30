// Deterministic first-person visual reload. Does not modify ammo or weapon state.
const ease=(a,b,t)=>{
  const x=Math.max(0,Math.min(1,(t-a)/(b-a)));
  return x*x*(3-2*x);
};
const IDLE=Object.freeze({progress:0,magTravel:0,magSide:0,magForward:0,handReach:0,
  dip:0,shift:0,roll:0,pitch:0,rack:0,phase:'idle'});

// WeaponStateMachine supplies normalized remaining-time progress.
export function sampleReloadPose(slot,progress,reloading=true){
  if(!reloading||(slot!==1&&slot!==2)||!Number.isFinite(progress))return IDLE;
  const t=Math.max(0,Math.min(1,progress));
  const out=Math.max(0,ease(.09,.32,t)-ease(.52,.76,t));
  const present=ease(0,.13,t)*(1-ease(.84,1,t));
  const handReach=ease(.03,.20,t)*(1-ease(.77,.96,t));
  const rack=ease(.75,.83,t)*(1-ease(.86,.94,t));
  const size=slot===1?1:.73;
  return {
    progress:t,magTravel:out*(slot===1?.32:.18),magSide:-.065*out*size,
    magForward:.08*out,handReach,dip:-.15*present,shift:-.08*present,
    roll:-.16*present*size,pitch:.055*present,rack:.095*rack,
    phase:t<.10?'reach':t<.34?'extract':t<.53?'exchange':t<.76?'insert':t<.94?'rack':'settle'
  };
}

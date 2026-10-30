// Presentation-only pose. Sprint is a visibly canted chest carry rather than
// a firing/ADS pose; no camera transform or shooting authority is changed.
export function sampleSprintCarryPose(slot, phase=0, reducedMotion=false){
  const t=Number.isFinite(phase)?phase:0;
  const rifle=slot===1;
  const sway=reducedMotion?.22:1;
  const cross=Math.sin(t),back=Math.cos(t*.5+.3);
  return {
    x:(rifle?-.115:-.095)+cross*(rifle?.032:.026)*sway,
    y:(rifle?-.092:-.085)+back*.005*sway,
    z:rifle?.055:.05,
    pitch:(rifle?-.075:-.065)+back*.010*sway,
    yaw:(rifle?.16:.13)+cross*.024*sway,
    roll:(rifle?-.40:-.33)+cross*.036*sway
  };
}

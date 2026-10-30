// Predictable fairness model for CITY ONLY. Shooting still requires actual LOS,
// range, encounter fire slots, wind-up and cooldown from existing AI authority.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:a));
export function cityRifleHitChance({range=10,playerSpeed=0,grappling=false,crouched=false}={}){
  const distance=clamp(range,0,22);
  const speed=clamp(playerSpeed,0,50);
  const base=.80-(distance/22)*.22;
  const motion=1/(1+speed*.065);
  return clamp(base*motion*(grappling?.62:1)*(crouched?1.04:1),.08,.9);
}
export function cityRifleShot({enemyId=0,shotIndex=1,...state}={}){
  const chance=cityRifleHitChance(state);
  // Low discrepancy sequence instead of Math.random: testable, reproducible.
  const sample=((enemyId*37+shotIndex*53+Math.floor(shotIndex/5)*13)%101)/101;
  return {hit:sample<chance,chance,sample};
}

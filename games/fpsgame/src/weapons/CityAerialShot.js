// City-only: fast grapple combat is readable without a random camera kick.
// ADS remains a skillful way to steady shots mid-flight, while rushing hipfire
// modestly widens aim rather than becoming pixel-accurate at 48 m/s.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
export function cityAerialSpreadScale({speed=0,grappling=false,ads=false}={}){
  if(!grappling)return 1;
  const motion=clamp(speed,0,55);
  return ads?clamp(.76+motion*.0018,.76,.86):clamp(.98+motion*.007,.98,1.31);
}
export const CITY_GUN_MAX_DISTANCE=125;

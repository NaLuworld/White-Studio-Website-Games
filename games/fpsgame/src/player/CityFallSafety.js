// City-only impact rules. Height lost during uncontrolled freefall, not hook travel,
// determines damage; never infer a fall from camera elevation alone.
export const CITY_SAFE_FALL_METRES=7;
export function cityFallDamage(metres){
  if(!Number.isFinite(metres)||metres<=CITY_SAFE_FALL_METRES)return 0;
  return Math.min(200,Math.ceil((metres-CITY_SAFE_FALL_METRES)*8));
}

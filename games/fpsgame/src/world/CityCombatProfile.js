// City-only combat layout. No station/rooftop spawns or timings are changed.
import {CITY_ELEVATED_GUARDS,CITY_ELEVATED_COUNT} from './CityElevatedGuards.js';
export {CITY_ELEVATED_GUARDS,CITY_ELEVATED_COUNT};
// Street-accessible positions prevent enemies being buried in new towers.
export const CITY_GUARD_SPAWNS=Object.freeze([
  [0,-27],[20,0],[-19,11],[0,45],[47,-5],[-12,-44],[12,38],[-46,0],
  [45,58],[-45,58],[-77,-38],[77,-38],[78,42],[-78,42],[14,-72],[-14,72]
].map(([x,z])=>Object.freeze({x,z})));
export const CITY_GUARD_COUNT=CITY_GUARD_SPAWNS.length;
export const CITY_TOTAL_ENEMIES=CITY_GUARD_COUNT+CITY_ELEVATED_COUNT;
export const CITY_ENCOUNTER_SECTORS=Object.freeze([
  Object.freeze({id:'CITY-PATROL',label:'STREET PATROLS + ELEVATED OVERWATCH',
    enemyIds:Object.freeze(Array.from({length:CITY_TOTAL_ENEMIES},(_,i)=>i)),
    threshold:-Infinity,slots:2,route:'ROOFTOP OVERWATCH / FIND COVER / RETURN FIRE / F DODGE / G GRAPPLE'})
]);
export const CITY_GUN_RANGE=22;

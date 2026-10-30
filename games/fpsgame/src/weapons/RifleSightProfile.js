// Pure rifle sightline contract shared by viewmodel and ballistic solver.
export const RIFLE_SIGHT_POINTS=Object.freeze({
  IRON:Object.freeze({x:0,y:.326,z:-.82}),
  RED_DOT:Object.freeze({x:0,y:.38,z:-.14})
});
export function sightSpread(state,spread,stationaryPrecision=false){
  return stationaryPrecision&&(state==='IDLE'||state==='CROUCH')?0:spread;
}

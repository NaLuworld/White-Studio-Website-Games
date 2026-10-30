import {CITY_BLUEPRINT} from './VerticalCityBlueprint.js';

// Four anchored, physically supported lanes. Each point is a real grapple
// landing, not an arbitrary roof X/Y with a decorative floating soldier.
const OVERWATCH=[
  ['KITE',2],['NEXUS',3],['ATLAS',5],['HARBOR',7]
];
export const CITY_ELEVATED_GUARDS=Object.freeze(OVERWATCH.map(([tower,level])=>{
  const anchor=CITY_BLUEPRINT.geometry.find(g=>g.id===`anchor-${tower}-${level}`);
  if(!anchor?.landing)throw new Error('Missing real elevated guard landing: '+tower+'-'+level);
  const {x,z,feetY:y}=anchor.landing;
  // Transfer deck width=9.2, depth=4.7. Keep a radius-wide safe margin
  // and avoid an unprotected ledge or the facade behind it.
  const zone=Object.freeze({xMin:x-2.8,xMax:x+2.8,zMin:z-.65,zMax:z+.65});
  return Object.freeze({id:tower+'-'+level,label:tower+' OVERWATCH',x,y,z,
    feetY:y,tower,level,zone,anchorId:anchor.id,range:42});
}));
export const CITY_ELEVATED_COUNT=CITY_ELEVATED_GUARDS.length;

// Patrol corridor orders cannot move off supported decking or change floors.
// Exactly the same policy is used in unit tests and EnemyNavigation.moveAxis.
export function elevatedGuardDesired(sentry,position,elapsed,out){
  const x=sentry.x+Math.sin(elapsed*.64+sentry.level)*2.15;
  const z=sentry.z+Math.cos(elapsed*.43+sentry.level)*.3;
  const dx=x-position.x,dz=z-position.z;
  return out.set(Math.max(-1.45,Math.min(1.45,dx*2)),0,
                 Math.max(-.45,Math.min(.45,dz*2)));
}

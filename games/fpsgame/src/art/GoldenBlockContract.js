import {STREAM_SEED_DEFAULT,chunkId,nearCenter} from '../world/InfiniteCityChunks.js';

// Preview-only Golden Block: three original city towers at the nearest edge
// of the authored 3x3 centre. Seed selection never changes the world generator.
export const GOLDEN_BLOCK=Object.freeze({cx:2,cz:0,seed:STREAM_SEED_DEFAULT});
export const GOLDEN_BLOCK_ID=chunkId(GOLDEN_BLOCK.cx,GOLDEN_BLOCK.cz);
// Art-only variant assignment; original chunk geometry, Seed and collision untouched.
export const GOLDEN_ART_FAMILIES=Object.freeze([
  'commercial_tower_a','residential_tower_a','industrial_tower_a'
]);
export function goldenArtFamily(towerIndex){
  if(!Number.isSafeInteger(towerIndex)||towerIndex<0)throw new Error('Invalid tower index');
  return GOLDEN_ART_FAMILIES[towerIndex%GOLDEN_ART_FAMILIES.length];
}
export const GOLDEN_LOD_NEAR=90;
export const GOLDEN_LOD_FAR=115;

export function isGoldenBlockCell(cx,cz,seed=STREAM_SEED_DEFAULT){
  return cx===GOLDEN_BLOCK.cx&&cz===GOLDEN_BLOCK.cz&&
    seed===GOLDEN_BLOCK.seed&&!nearCenter(cx,cz);
}
export function goldenBlockTransform(tower,kit){
  if(!tower||!kit||!(kit.footprint?.x>0&&kit.footprint?.z>0)||
      !(kit.walkable_roof_y>0))throw new Error('Invalid Golden Block geometry contract');
  return {
    position:{x:tower.x,y:0,z:tower.z},
    scale:{
      x:tower.width/kit.footprint.x,
      y:tower.height/kit.walkable_roof_y,
      z:tower.depth/kit.footprint.z
    },
    physicalRoofY:tower.height,
    visualRoofY:kit.walkable_roof_y*(tower.height/kit.walkable_roof_y)
  };
}
export function desiredGoldenLOD(distance,currentLOD=null){
  if(!Number.isFinite(distance)||distance<0)throw new Error('Invalid camera distance');
  // Hysteresis prevents per-frame GLB replacements at exactly 90 metres.
  if(currentLOD===0)return distance>GOLDEN_LOD_FAR?1:0;
  if(currentLOD===1)return distance<GOLDEN_LOD_NEAR?0:1;
  return distance<GOLDEN_LOD_NEAR?0:1;
}

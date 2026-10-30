import {MUTED_URBAN} from '../art/MutedUrbanPalette.js';
// Pure, order-independent generation. Render, physics and grapple all consume
// the SAME descriptors. Arbitrary signed integer chunk coords. No global PRNG.
export const STREAM_CHUNK_SIZE=88;
export const STREAM_LOAD_RADIUS=2;
export const STREAM_SEED_DEFAULT=42026;
// Shared palette ensures physical towers and distant proxies use the same hue.
export const CITY_FACADE_COLORS=Object.freeze([...MUTED_URBAN.facades]);
const int=n=>Number.isInteger(n)&&Math.abs(n)<1e8;
const seedMix=(seed,cx,cz)=>{
  let x=(seed|0)^Math.imul(cx,0x9e3779b1)^Math.imul(cz,0x85ebca6b);
  x=Math.imul(x^(x>>>16),0x7feb352d);
  x=Math.imul(x^(x>>>15),0x846ca68b);
  return (x^(x>>>16))>>>0;
};
const generator=(seed)=>{
  let x=seed>>>0;
  return ()=>{x+=0x6d2b79f5;let t=x;t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
};
export const chunkId=(cx,cz)=>cx+':'+cz;
export const chunkCoords=(x,z)=>({cx:Math.floor(x/STREAM_CHUNK_SIZE+.5),
  cz:Math.floor(z/STREAM_CHUNK_SIZE+.5)});
export const nearCenter=(cx,cz)=>Math.abs(cx)<=1&&Math.abs(cz)<=1;
// Exact same compact building layout drives both physical nearby chunks and
// cheap, non-collidable distant silhouettes. Never render a different skyline
// from the one the player eventually flies into.
export function cityChunkTowers(cx,cz,seed=STREAM_SEED_DEFAULT){
  if(!int(cx)||!int(cz)||!Number.isFinite(seed))throw Error('Invalid city chunk key');
  if(nearCenter(cx,cz))return [];
  const id=chunkId(cx,cz),mx=cx*STREAM_CHUNK_SIZE,mz=cz*STREAM_CHUNK_SIZE;
  const roll=generator(seedMix(seed,cx,cz));
  const quarterTurns=Math.floor(roll()*4),mirror=roll()<.5;
  const sites=[[-23,-22],[23,-22],[0,22]].map(([x,z])=>{
    if(mirror)x=-x;
    for(let i=0;i<quarterTurns;i++)[x,z]=[-z,x];
    return [x,z];
  });
  return sites.map(([sx,sz],i)=>{
    const bx=mx+sx+(roll()-.5)*8,bz=mz+sz+(roll()-.5)*8;
    const w=13+Math.floor(roll()*4)*2,d=13+Math.floor(roll()*4)*2;
    const levels=8+Math.floor(roll()*9);
    // Separate decorative RNG must not consume the original placement stream.
    // Existing seeded coordinates, widths, levels and grapple routes stay fixed.
    const styleRoll=generator(seedMix(seed^0x4b71fbed,cx*4+i,cz));
    const facadeStyle=Math.floor(styleRoll()*CITY_FACADE_COLORS.length);
    const roofStyle=Math.floor(styleRoll()*3);
    return {id:id+'/tower-'+i,x:bx,z:bz,height:levels*5,width:w,depth:d,
      levels,facadeStyle,roofStyle};
  });
}
export function generateCityChunk(cx,cz,seed=STREAM_SEED_DEFAULT){
  if(!int(cx)||!int(cz)||!Number.isFinite(seed))throw Error('Invalid city chunk key');
  const id=chunkId(cx,cz),mx=cx*STREAM_CHUNK_SIZE,mz=cz*STREAM_CHUNK_SIZE;
  const structures=[],anchors=[],buildings=[];
  const push=(part,x,y,z,w,h,d,material='concrete',anchor=null,collidable=true,visualOnly=false)=>{
    structures.push({id:id+'/'+part,position:{x,y,z},
      size:{x:w,y:h,z:d},material,collidable,anchor,visualOnly});
  };
  // All chunks supply supported y=0 road. The nine centre chunks add only
  // seam-spanning roadway so the existing hand-authored V4 city stays intact.
  push('street',mx,-.285,mz,STREAM_CHUNK_SIZE,.49,STREAM_CHUNK_SIZE,'road');
  if(nearCenter(cx,cz))return {id,cx,cz,buildings,structures,anchors};
  buildings.push(...cityChunkTowers(cx,cz,seed));
  for(let i=0;i<buildings.length;i++){
    const tower=buildings[i],bx=tower.x,bz=tower.z;
    const {width:w,depth:d,levels,height,id:buildingId}=tower;
    const front=bz+d/2;
    // Four actual collider walls, not a fake silhouette; open ground
    // entrance with an accessible doorway facing each courtyard.
    for(let side of [-1,1]){
      push('tower-'+i+'/side-'+side,bx+side*(w/2-.22),height/2,bz,.44,height,d,'wall');
    }
    for(let side of [-1,1]){
      push('tower-'+i+'/rear-'+side,bx+side*(w/4),height/2,bz-d/2+.22,
        w/2,height,.44,'wall');
    }
    push('tower-'+i+'/roof',bx,height-.23,bz,w+.3,.46,d+.3,'deck');
    // Facade panels stay on solid side/rear walls, never across open entrances.
    // Purely decorative: neither bullet traces nor grapples use these.
    push('tower-'+i+'/glazing-rear',bx,height*.52,bz-d/2-.055,
      w*.68,height*.68,.09,'glass',null,false,true);
    push('tower-'+i+'/glazing-side',bx+w/2+.055,height*.52,bz,
      .09,height*.68,d*.62,'glass',null,false,true);
    // Small seeded HVAC/crown mass. Does not obstruct the roof landing.
    const crownX=bx-w*.22,crownZ=bz-d*.21;
    const crownW=w*(tower.roofStyle===2?.36:.23);
    push('tower-'+i+'/roof-equipment',crownX,height+.42,crownZ,
      crownW,.84,d*.26,'roof-equipment',null,false,true);
    // Two-level increments create actual reachable ledges with chainable
    // grapples. Each anchor is tied to a supported standing position.
    for(let level=2;level<=levels;level+=2){
      const y=level*5,ledgeZ=front+2.2;
      push('tower-'+i+'/terrace-'+level,bx,y-.23,ledgeZ,7,.46,4.5,'deck');
      const landing={x:bx,z:front+2.9,feetY:y};
      const point={x:bx,y:y+2.15,z:front+5.1};
      const anchor={id:buildingId+'/hook-'+level,position:point,landing};
      anchors.push(anchor);
      push('tower-'+i+'/anchor-'+level,point.x,point.y,point.z,.65,.65,.65,
        'anchor',anchor,false);
    }
  }
  // Free streets, two true waist-high cover blocks, no sealed passageways.
  for(let i=0;i<2;i++){
    const x=mx+(i===0?-10:12),z=mz+(i===0?0:5);
    push('cover-'+i,x,.65,z,3.1,1.3,1.25,'cover');
  }
  return {id,cx,cz,buildings,structures,anchors};
}
// Authoritative near-player spawned combat is also chunk deterministic. No
// enemies grow without bound as the user crosses the map; the runtime releases
// old instances while preserving only a small live neighborhood.
export function cityStreamGuardPosition(cx,cz,seed=STREAM_SEED_DEFAULT){
  if(nearCenter(cx,cz))return null;
  const roll=generator(seedMix(seed^0x77a8b21f,cx,cz));
  return {x:cx*STREAM_CHUNK_SIZE-4+roll()*2,
    z:cz*STREAM_CHUNK_SIZE-6+roll()*2,y:0};
}
export function nearbyChunkKeys(x,z,radius=STREAM_LOAD_RADIUS){
  const {cx,cz}=chunkCoords(x,z),keys=[];
  for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)
    keys.push([cx+dx,cz+dz]);
  return keys;
}

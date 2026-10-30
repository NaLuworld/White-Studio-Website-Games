// Pure building-kit contracts. Works both in browser and node --test.
export const KIT_SCHEMA='white-studio-building-kit-v1';
const SAFE_PATH=/^assets\/models\/skyline\/[a-z0-9_/-]+\.glb$/;
export function validateKitManifest(value){
  if(!value||value.schema!==KIT_SCHEMA)throw new Error('Unsupported building kit manifest');
  if(!/^[a-z][a-z0-9_]+$/.test(value.kit_id||''))throw new Error('Invalid kit ID');
  if(value.units!=='meters'||value.up!=='Y'||value.pivot!=='ground-center')
    throw new Error('Kit units/up-axis/pivot mismatch');
  if(value.collision!=='external_authoritative')
    throw new Error('Visual kit cannot replace gameplay collision');
  if(!(value.footprint?.x>0&&value.footprint?.z>0&&value.height>0))
    throw new Error('Invalid dimensions');
  if(!(value.walkable_roof_y>0&&value.walkable_roof_y<=value.height))
    throw new Error('Invalid walkable roof datum');
  for(const tier of ['0','1']){
    const lod=value.lods?.[tier];
    if(!lod||!SAFE_PATH.test(lod.path)||lod.path.includes('..'))throw new Error('Invalid asset path');
    if(!Number.isInteger(lod.triangles)||lod.triangles<4||lod.triangles>40000)
      throw new Error('Triangle budget violated');
    if(!Number.isInteger(lod.mesh_count)||lod.mesh_count<1||lod.mesh_count>20)
      throw new Error('Draw call budget violated');
    if(!/^[0-9a-f]{64}$/.test(lod.sha256||''))throw new Error('Invalid asset hash');
    if(!Number.isInteger(lod.bytes)||lod.bytes<100||lod.bytes>5000000)
      throw new Error('GLB size budget violated');
  }
  if(value.lods['1'].triangles>=value.lods['0'].triangles)
    throw new Error('LOD1 must be cheaper');
  return value;
}
export function pickBuildingLOD(distanceMeters,{lod0Until=90}={}){
  if(!Number.isFinite(distanceMeters)||distanceMeters<0)throw new Error('Invalid distance');
  return distanceMeters<=lod0Until?0:1;
}

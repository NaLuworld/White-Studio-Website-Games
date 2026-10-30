import {MUTED_URBAN} from '../art/MutedUrbanPalette.js';
import * as THREE from 'three';
import {STREAM_CHUNK_SIZE,STREAM_LOAD_RADIUS,STREAM_SEED_DEFAULT,
  generateCityChunk,nearbyChunkKeys,chunkId,chunkCoords,CITY_FACADE_COLORS} from './InfiniteCityChunks.js?v=muted-urban-v1';

// Authoritative dynamic city scene. Registry arrays retain identity, ensuring
// held player motor/ballistics/CityGrappleProjectile references stay live.
export class InfiniteCityStream {
  constructor(scene,registry,{seed=STREAM_SEED_DEFAULT,radius=STREAM_LOAD_RADIUS,goldenBlock=null}={}){
    // A stale cached WorldInteractionRegistry formerly lacked this method.
    // Fail once during startup with an actionable cache diagnostic, instead
    // of throwing every requestAnimationFrame after crossing a city cell.
    if(typeof registry?.register!=='function'||
       typeof registry?.unregisterMeshes!=='function'){
      throw new TypeError('Skyline registry API mismatch: missing register/unregisterMeshes. Reload the versioned game module.');
    }
    this.scene=scene;this.registry=registry;this.seed=seed;this.radius=radius;
    this.goldenBlock=goldenBlock;
    this.chunks=new Map();this.materials=new Map();this.geometries=new Map();
    this.anchorShape=new THREE.OctahedronGeometry(.37,0);
    this.loadedTotal=0;this.evictedTotal=0;this.updateCount=0;
    this.current='';this.maxResident=0;
    // Nearby physics must be authoritative now, but the 16 outer buffer
    // cells can be prepared across multiple animation frames while the player
    // is moving. Never stall a frame to rebuild an entire 5x5 district.
    this.maxOuterLoadsPerFrame=2;
    this.pendingOuter=0;this.lastLoads=0;this.lastUpdateMs=0;this.peakUpdateMs=0;
    this.tempMeshes=[];
  }
  material(kind){
    if(!this.materials.has(kind)){
      const colors={road:MUTED_URBAN.world.road,wall:MUTED_URBAN.world.wall,
        deck:MUTED_URBAN.world.deck,cover:MUTED_URBAN.world.cover,
        anchor:MUTED_URBAN.world.anchor,glass:MUTED_URBAN.world.glass,
        'roof-equipment':MUTED_URBAN.world.roofEquipment};
      const tint=kind.startsWith('facade-')?
        CITY_FACADE_COLORS[Number(kind.slice(7))]:undefined;
      this.materials.set(kind,new THREE.MeshStandardMaterial({
        color:tint??colors[kind]??MUTED_URBAN.world.default,
        metalness:kind==='anchor'?.45:kind==='glass'?.26:.11,
        roughness:kind==='anchor'?.33:kind==='glass'?.38:.8,
        emissive:kind==='anchor'?MUTED_URBAN.world.anchorEmissive:0,
        emissiveIntensity:kind==='anchor'?.72:0}));
    }
    return this.materials.get(kind);
  }
  shape(box){
    if(box.anchor)return this.anchorShape;
    const size=box.size,key=size.x+':'+size.y+':'+size.z;
    if(!this.geometries.has(key))this.geometries.set(key,
      new THREE.BoxGeometry(size.x,size.y,size.z));
    return this.geometries.get(key);
  }
  load(cx,cz){
    const data=generateCityChunk(cx,cz,this.seed),meshes=[];
    for(const item of data.structures){
      // Facades match the same deterministic palette as the skyline proxies.
      const towerMatch=/\/tower-(\d+)\//.exec(item.id);
      const tower=towerMatch?data.buildings[Number(towerMatch[1])]:null;
      const renderKind=item.material==='wall'&&tower?
        'facade-'+tower.facadeStyle:item.material;
      const mesh=new THREE.Mesh(this.shape(item),this.material(renderKind));
      mesh.name='infinite-city-'+item.id;
      mesh.position.set(item.position.x,item.position.y,item.position.z);
      mesh.userData.grappleAnchor=!!item.anchor;
      if(item.anchor)mesh.userData.grappleLanding={...item.anchor.landing};
      mesh.userData.grappleSurface=item.material!=='road'&&
        item.material!=='cover'&&item.collidable;
      // Muzzle traces use the same physical walls and platforms as the motor.
      mesh.receiveShadow=item.collidable;
      mesh.castShadow=item.material==='wall'&&item.position.y<30;
      this.scene.add(mesh);meshes.push(mesh);
      // Architectural details are visual-only, never invisible gameplay hitboxes.
      if(!item.visualOnly)this.registry.register(mesh,{
        label:mesh.name,kind:item.anchor?'gadget-anchor':'environment',
        surface:item.anchor?'metal':'concrete',
        collidable:item.collidable,shootable:item.material!=='road',
        traversal:item.material==='cover'?{vaultable:true,ledge:true}:null
      });
    }
    const chunk={meshes,buildings:data.buildings.length,
      anchors:data.anchors,cx,cz};
    this.chunks.set(data.id,chunk);
    this.goldenBlock?.attachChunk(data,chunk);
    this.loadedTotal++;
  }
  unload(key){
    const value=this.chunks.get(key);if(!value)return false;
    this.goldenBlock?.detachChunk(key);
    // Batched authoritative removal from collision, bullet and grapple arrays.
    this.registry.unregisterMeshes(value.meshes);
    for(const mesh of value.meshes)this.scene.remove(mesh);
    this.chunks.delete(key);this.evictedTotal++;return true;
  }
  update(position,{pin=null,fill=false}={}){
    const started=performance.now();
    const center=chunkCoords(position.x,position.z);
    const centerId=chunkId(center.cx,center.cz);
    const target=nearbyChunkKeys(position.x,position.z,this.radius);
    const desired=new Set(target.map(([cx,cz])=>chunkId(cx,cz)));
    // A cable's anchor may be one extra cell beyond the normal 5x5 window.
    // Keep it registered until release; G never latches a non-physical proxy.
    let pinnedCell=null;
    if(pin&&Number.isFinite(pin.x)&&Number.isFinite(pin.z)){
      pinnedCell=chunkCoords(pin.x,pin.z);
      desired.add(chunkId(pinnedCell.cx,pinnedCell.cz));
    }
    if(centerId===this.current&&this.chunks.size===desired.size&&
       [...desired].every(key=>this.chunks.has(key))){
      this.pendingOuter=0;this.lastLoads=0;this.lastUpdateMs=0;
      return false;
    }
    this.current=centerId;
    // First remove distant geometry and colliders in ONE registry pass. This
    // avoids N repeated scans of every live hitbox when a chunk column changes.
    const retiring=[...this.chunks].filter(([key])=>!desired.has(key));
    if(retiring.length){
      const meshes=retiring.flatMap(([,chunk])=>chunk.meshes);
      this.registry.unregisterMeshes(meshes);
      for(const [key,chunk] of retiring){
        this.goldenBlock?.detachChunk(key);
        for(const mesh of chunk.meshes)this.scene.remove(mesh);
        this.chunks.delete(key);this.evictedTotal++;
      }
    }
    let loaded=0;
    // A 72m gun/hook ray requires the player's central 3x3 physical cells,
    // which were already prefetched in the previous 5x5 window during normal
    // walking/swinging. Cold teleports also load this safety ring immediately.
    const critical=nearbyChunkKeys(position.x,position.z,1)
      .sort(([ax,az],[bx,bz])=>
        (Math.abs(ax-center.cx)+Math.abs(az-center.cz))-
        (Math.abs(bx-center.cx)+Math.abs(bz-center.cz)));
    for(const [cx,cz] of critical){
      const id=chunkId(cx,cz);
      if(!this.chunks.has(id)){this.load(cx,cz);loaded++;}
    }
    if(pinnedCell){
      const key=chunkId(pinnedCell.cx,pinnedCell.cz);
      if(!this.chunks.has(key)){
        this.load(pinnedCell.cx,pinnedCell.cz);loaded++;
      }
    }
    // Non-critical outer ring gets a small strict per-frame work allowance.
    // Near visuals are already drawn by SkylineHorizon, so this never exposes
    // the ungenerated void that was previously visible while flying.
    const peripheral=target.filter(([cx,cz])=>!this.chunks.has(chunkId(cx,cz)))
      .sort(([ax,az],[bx,bz])=>
        Math.hypot(ax-center.cx,az-center.cz)-
        Math.hypot(bx-center.cx,bz-center.cz));
    for(const [cx,cz] of peripheral.slice(0,fill?peripheral.length:this.maxOuterLoadsPerFrame)){
      this.load(cx,cz);loaded++;
    }
    this.pendingOuter=fill?0:Math.max(0,peripheral.length-this.maxOuterLoadsPerFrame);
    this.lastLoads=loaded;
    this.updateCount++;this.maxResident=Math.max(this.maxResident,this.chunks.size);
    this.lastUpdateMs=performance.now()-started;
    this.peakUpdateMs=Math.max(this.peakUpdateMs,this.lastUpdateMs);
    return true;
  }
  nearbyAnchors(point,maxDistance=72){
    const d2=maxDistance*maxDistance,choices=[];
    for(const chunk of this.chunks.values())
      for(const anchor of chunk.anchors){
        const a=anchor.position,dx=a.x-point.x,dz=a.z-point.z,dy=a.y-point.y;
        const distanceSq=dx*dx+dy*dy+dz*dz;
        if(distanceSq<=d2)choices.push({id:anchor.id,
          position:{...a},landing:{...anchor.landing},distance:Math.sqrt(distanceSq)});
      }
    return choices.sort((a,b)=>a.distance-b.distance).slice(0,32);
  }
  snapshot(){
    let buildings=0,anchors=0,meshes=0;
    for(const chunk of this.chunks.values()){
      buildings+=chunk.buildings;anchors+=chunk.anchors.length;meshes+=chunk.meshes.length;
    }
    return {seed:this.seed,chunkSize:STREAM_CHUNK_SIZE,radius:this.radius,
      center:this.current,residentChunks:this.chunks.size,buildings,anchors,
      meshes,loadedTotal:this.loadedTotal,evictedTotal:this.evictedTotal,
      maxResident:this.maxResident,updateCount:this.updateCount,
      pendingOuter:this.pendingOuter,lastLoads:this.lastLoads,
      lastUpdateMs:Number(this.lastUpdateMs.toFixed(2)),
      peakUpdateMs:Number(this.peakUpdateMs.toFixed(2)),
      goldenBlock:this.goldenBlock?.snapshot()??null};
  }
}

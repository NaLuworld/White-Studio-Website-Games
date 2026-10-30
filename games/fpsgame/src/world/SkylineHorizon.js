import {MUTED_URBAN} from '../art/MutedUrbanPalette.js';
import * as THREE from 'three';
import {cityChunkTowers,chunkCoords,nearCenter,STREAM_CHUNK_SIZE,
  CITY_FACADE_COLORS} from './InfiniteCityChunks.js?v=muted-urban-v1';

// Same deterministic footprints as physical streamed chunks. Distant geometry
// has no registry entries, raycasts or collision, and never receives shadows.
export const SKYLINE_VISUAL_RADIUS=11;
const makeInstanced=(scene,name,max,material)=>{
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,max);
  mesh.name=name;mesh.frustumCulled=false;
  mesh.castShadow=false;mesh.receiveShadow=false;mesh.count=0;
  scene.add(mesh);return mesh;
};
export class SkylineHorizon {
  constructor(scene,{seed,innerRadius=2,outerRadius=SKYLINE_VISUAL_RADIUS}={}){
    this.scene=scene;this.seed=seed;this.innerRadius=innerRadius;
    this.outerRadius=outerRadius;this.center=null;this.updates=0;
    this.maxInstances=3*((2*outerRadius+1)**2-(2*innerRadius+1)**2);
    this.towers=makeInstanced(scene,'Skyline facade tower silhouettes',
      this.maxInstances,new THREE.MeshStandardMaterial({
        color:0xffffff,roughness:.88,metalness:.08,fog:true}));
    // Four low-cost inset window fields show genuine facade planes rather than
    // bare identical slabs. A single InstancedMesh handles all four sides.
    this.glazing=makeInstanced(scene,'Skyline non-collidable window fields',
      this.maxInstances*4,new THREE.MeshStandardMaterial({
        color:MUTED_URBAN.world.horizonGlazing,emissive:MUTED_URBAN.world.horizonGlazingEmissive,emissiveIntensity:.08,
        roughness:.38,metalness:.22,fog:true}));
    this.roofCaps=makeInstanced(scene,'Skyline seeded roof crowns',
      this.maxInstances,new THREE.MeshStandardMaterial({
        color:0xffffff,roughness:.8,metalness:.1,fog:true}));
    // Sparse dark story breaks reduce the all-white monolith effect.
    this.bands=makeInstanced(scene,'Skyline facade floor bands',
      this.maxInstances*4,new THREE.MeshStandardMaterial({
        color:MUTED_URBAN.world.horizonBands,roughness:.78,metalness:.08,fog:true}));
    const extent=(outerRadius*2+1)*STREAM_CHUNK_SIZE*1.12;
    this.road=new THREE.Mesh(new THREE.PlaneGeometry(extent,extent),
      new THREE.MeshBasicMaterial({color:MUTED_URBAN.world.horizonGround,fog:true,depthWrite:true}));
    this.road.name='Skyline far ground / visual only';
    this.road.rotation.x=-Math.PI/2;this.road.position.y=-.43;
    this.road.receiveShadow=false;this.scene.add(this.road);
    this.dummy=new THREE.Object3D();this.color=new THREE.Color();
  }
  instance(mesh,index,x,y,z,w,h,d){
    this.dummy.position.set(x,y,z);
    this.dummy.scale.set(w,h,d);
    this.dummy.rotation.set(0,0,0);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(index,this.dummy.matrix);
  }
  update(position){
    const {cx,cz}=chunkCoords(position.x,position.z),id=cx+':'+cz;
    if(this.center===id)return false;
    this.center=id;
    let count=0,glassCount=0,capCount=0,bandCount=0;
    const r=this.outerRadius;
    for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
      if(Math.max(Math.abs(dx),Math.abs(dz))<=this.innerRadius)continue;
      const x=cx+dx,z=cz+dz;
      for(const b of cityChunkTowers(x,z,this.seed)){
        if(count>=this.maxInstances)break;
        this.instance(this.towers,count,b.x,b.height/2,b.z,b.width,b.height,b.depth);
        this.color.setHex(CITY_FACADE_COLORS[b.facadeStyle]??CITY_FACADE_COLORS[0]);
        this.towers.setColorAt(count,this.color);
        count++;
        const facadeY=b.height*.52,facadeH=b.height*.69;
        const panelOffset=.065;
        const front=b.z+b.depth/2+panelOffset,back=b.z-b.depth/2-panelOffset;
        const east=b.x+b.width/2+panelOffset,west=b.x-b.width/2-panelOffset;
        for(const zFace of [front,back]){
          this.instance(this.glazing,glassCount++,b.x,facadeY,zFace,b.width*.68,facadeH,.09);
        }
        for(const xFace of [east,west]){
          this.instance(this.glazing,glassCount++,xFace,facadeY,b.z,.09,facadeH,b.depth*.64);
        }
        const roofScale=b.roofStyle===2?.38:b.roofStyle===1?.29:.19;
        const capH=b.roofStyle===1?2.3:1.3;
        this.instance(this.roofCaps,capCount,b.x-b.width*.2,b.height+capH/2,
          b.z-b.depth*.2,b.width*roofScale,capH,b.depth*.27);
        this.color.setHex(CITY_FACADE_COLORS[b.facadeStyle]??CITY_FACADE_COLORS[0]);
        this.color.multiplyScalar(.74);
        this.roofCaps.setColorAt(capCount,this.color);
        capCount++;
        // One horizontal band on each facade at a reproducible floor level.
        const bandY=Math.min(b.height-3,Math.max(8,Math.floor(b.levels*.55)*5));
        for(const zFace of [front,back]){
          this.instance(this.bands,bandCount++,b.x,bandY,zFace,b.width*.83,.35,.11);
        }
        for(const xFace of [east,west]){
          this.instance(this.bands,bandCount++,xFace,bandY,b.z,.11,.35,b.depth*.81);
        }
      }
    }
    for(const [mesh,n] of [[this.towers,count],[this.glazing,glassCount],
      [this.roofCaps,capCount],[this.bands,bandCount]]){
      mesh.count=n;
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
    this.road.position.x=cx*STREAM_CHUNK_SIZE;
    this.road.position.z=cz*STREAM_CHUNK_SIZE;
    this.updates++;return true;
  }
  snapshot(){
    return {center:this.center,visualRadius:this.outerRadius,
      impostorBuildings:this.towers.count,updates:this.updates,
      drawObjects:5,collidable:false};
  }
  dispose(){
    for(const mesh of [this.towers,this.glazing,this.roofCaps,this.bands,this.road]){
      this.scene.remove(mesh);
      mesh.geometry.dispose();mesh.material.dispose();
    }
  }
}

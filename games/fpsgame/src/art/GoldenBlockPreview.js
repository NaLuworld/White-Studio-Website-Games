import * as THREE from 'three';
import {BuildingKitLibrary} from './BuildingKitLoader.js';
import {isGoldenBlockCell,goldenBlockTransform,desiredGoldenLOD,GOLDEN_BLOCK_ID,goldenArtFamily,GOLDEN_ART_FAMILIES}
  from './GoldenBlockContract.js';

// Opt-in Golden Block visual layer. Gameplay authority always stays with
// InfiniteCityStream and WorldInteractionRegistry. GLBs are never raycast targets.
export class GoldenBlockPreview {
  constructor(scene,{seed,assetRoot=new URL('./',location.href)}={}){
    this.scene=scene;this.seed=seed;
    this.libraries=new Map();this.assetRoot=assetRoot;
    this.cells=new Map();
    this.ready=false;
    this.cameraPosition={x:0,z:0};
    this.errors=[];
    this.loads=0;this.releases=0;
  }
  async initialize(){
    // Three independently authored GLB families, shared only within their family.
    for(const family of GOLDEN_ART_FAMILIES){
      const library=new BuildingKitLibrary({assetRoot:this.assetRoot});
      const manifest=family==='commercial_tower_a'?'manifest.json':family+'.json';
      await library.loadManifest('assets/models/skyline/'+manifest);
      await Promise.all([library.asset(0),library.asset(1)]);
      this.libraries.set(family,library);
    }
    this.ready=true;
    return this;
  }
  supports(cx,cz){
    return this.ready&&isGoldenBlockCell(cx,cz,this.seed);
  }
  attachChunk(data,chunk){
    if(!this.supports(data.cx,data.cz)||this.cells.has(data.id))return false;
    const cell={id:data.id,cx:data.cx,cz:data.cz,alive:true,chunk,
      entries:data.buildings.map((tower,index)=>({
        tower,index,family:goldenArtFamily(index),instance:null,lod:null,loadingLOD:null,token:0,
        hiddenPhysical:[]
      }))};
    this.cells.set(data.id,cell);
    this.update(this.cameraPosition);
    return true;
  }
  update(point){
    if(!this.ready)return;
    this.cameraPosition={x:point.x,z:point.z};
    for(const cell of this.cells.values()){
      for(const entry of cell.entries){
        const distance=Math.hypot(point.x-entry.tower.x,point.z-entry.tower.z);
        const desired=desiredGoldenLOD(distance,entry.lod);
        if(entry.loadingLOD===desired)continue;
        if(entry.lod===desired&&entry.loadingLOD===null)continue;
        const token=++entry.token;
        entry.loadingLOD=desired;
        // One GLTF cache per architectural family (six GLBs in total).
        const library=this.libraries.get(entry.family);
        library.create({lod:desired}).then(group=>{
          if(!cell.alive||entry.token!==token){
            library.release(group);
            return;
          }
          const transform=goldenBlockTransform(entry.tower,library.manifest);
          group.position.set(transform.position.x,transform.position.y,transform.position.z);
          group.scale.set(transform.scale.x,transform.scale.y,transform.scale.z);
          group.name='GoldenBlock/'+cell.id+'/'+entry.family+'/tower-'+entry.index+'/LOD'+desired;
          group.userData.goldenBlock=true;
          group.userData.artFamily=entry.family;
          group.userData.visualOnly=true;
          group.userData.physicalRoofY=transform.physicalRoofY;
          group.traverse(object=>{
            if(!object.isMesh)return;
            object.castShadow=false;
            object.receiveShadow=false;
            object.userData.visualOnly=true;
          });
          this.scene.add(group);
          const old=entry.instance;
          entry.instance=group;entry.lod=desired;entry.loadingLOD=null;
          if(old){library.release(old);this.releases++;}
          if(!entry.hiddenPhysical.length){
            // The hidden wall meshes remain inside the authoritative registry:
            // their AABB colliders and weapon raycasts MUST keep working.
            const prefix='/tower-'+entry.index+'/';
            entry.hiddenPhysical=cell.chunk.meshes.filter(mesh=>
              mesh.name.includes(prefix)&&
              (/\/(side-|rear-|glazing-|roof-equipment)/.test(mesh.name)));
            for(const mesh of entry.hiddenPhysical)mesh.visible=false;
          }
          this.loads++;
        }).catch(error=>{
          if(!cell.alive||entry.token!==token)return;
          entry.loadingLOD=null;
          this.errors.push(String(error).slice(0,180));
          if(this.errors.length>8)this.errors.shift();
        });
      }
    }
  }
  detachChunk(id){
    const cell=this.cells.get(id);
    if(!cell)return false;
    cell.alive=false;
    this.cells.delete(id);
    for(const entry of cell.entries){
      ++entry.token;
      for(const physical of entry.hiddenPhysical)physical.visible=true;
      entry.hiddenPhysical.length=0;
      if(entry.instance){this.libraries.get(entry.family).release(entry.instance);this.releases++;}
      entry.instance=null;entry.loadingLOD=null;
    }
    return true;
  }
  snapshot(){
    let instances=0,lod0=0,lod1=0,pending=0,hiddenPhysical=0;
    const towers=[];
    for(const cell of this.cells.values()){
      for(const entry of cell.entries){
        if(entry.instance){
          instances++;
          if(entry.lod===0)lod0++;else if(entry.lod===1)lod1++;
          towers.push({id:entry.tower.id,family:entry.family,lod:entry.lod,
            position:entry.instance.position.toArray(),
            scale:entry.instance.scale.toArray(),
            meshCount:(()=>{
              let count=0;entry.instance.traverse(n=>{if(n.isMesh)count++;});
              return count;
            })()});
        }
        if(entry.loadingLOD!==null)pending++;
        hiddenPhysical+=entry.hiddenPhysical.length;
      }
    }
    return {enabled:true,ready:this.ready,chunk:GOLDEN_BLOCK_ID,
      activeChunks:this.cells.size,instances,lod0,lod1,pending,
      hiddenPhysical,loads:this.loads,releases:this.releases,
      errors:[...this.errors],towers};
  }
  dispose(){
    for(const id of [...this.cells.keys()])this.detachChunk(id);
    for(const library of this.libraries.values())library.dispose();
    this.libraries.clear();
    this.ready=false;
  }
}

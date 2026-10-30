import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {validateKitManifest,pickBuildingLOD} from './BuildingKitRegistry.js';

// Visual-only; WorldInteractionRegistry retains every gameplay collider/anchor.
export class BuildingKitLibrary {
  constructor({assetRoot=new URL('/',globalThis.location?.href||'http://localhost/'),loader=new GLTFLoader()}={}){
    this.assetRoot=assetRoot instanceof URL?assetRoot:new URL(assetRoot);
    this.loader=loader;
    this.manifest=null;
    this.pending=new Map();
    this.live=new Set();
  }
  async loadManifest(url='assets/models/skyline/manifest.json'){
    if(!url.startsWith('assets/models/skyline/')||url.includes('..'))throw new Error('Unsafe manifest URL');
    const response=await fetch(new URL(url,this.assetRoot),{cache:'no-store'});
    if(!response.ok)throw new Error('Kit manifest HTTP '+response.status);
    this.manifest=validateKitManifest(await response.json());
    return this.manifest;
  }
  async asset(lod=0){
    if(!this.manifest)throw new Error('Load the manifest first');
    if(lod!==0&&lod!==1)throw new Error('Unknown LOD level');
    if(!this.pending.has(lod)){
      const url=new URL(this.manifest.lods[lod].path,this.assetRoot).href;
      this.pending.set(lod,this.loader.loadAsync(url).catch(error=>{
        this.pending.delete(lod);throw error;
      }));
    }
    return this.pending.get(lod);
  }
  async create({lod=0,position=new THREE.Vector3(),rotationY=0}={}){
    const gltf=await this.asset(lod);
    const instance=gltf.scene.clone(true);
    instance.name=this.manifest.kit_id+'@LOD'+lod;
    instance.position.copy(position);
    instance.rotation.y=rotationY;
    instance.userData.kitId=this.manifest.kit_id;
    instance.userData.kitLod=lod;
    this.live.add(instance);
    return instance;
  }
  async createAtDistance(distance,opts={}){
    return this.create({...opts,lod:pickBuildingLOD(distance)});
  }
  release(instance){
    if(!this.live.has(instance))throw new Error('Unknown or released kit instance');
    instance.removeFromParent();
    this.live.delete(instance);
  }
  dispose(){
    if(this.live.size)throw new Error('Release active kit instances before disposal');
    for(const promise of this.pending.values()){
      promise.then(gltf=>{
        const geometries=new Set(),materials=new Set(),textures=new Set();
        gltf.scene.traverse(node=>{
          if(!node.isMesh)return;
          if(node.geometry)geometries.add(node.geometry);
          for(const material of Array.isArray(node.material)?node.material:[node.material]){
            if(material)materials.add(material);
          }
        });
        for(const material of materials){
          for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
          material.dispose();
        }
        for(const texture of textures)texture.dispose();
        for(const geometry of geometries)geometry.dispose();
      });
    }
    this.pending.clear();this.manifest=null;
  }
}

import * as THREE from 'three';

export class WorldInteractionRegistry {
  constructor() {
    this.shootables = [];
    this.collisionBoxes = [];
    this.entries = [];
  }

  register(mesh, { surface='concrete', collidable=true, shootable=true, kind='environment', label=null, traversal=null }={}) {
    if (!mesh) return mesh;
    mesh.userData.surface = surface;
    mesh.userData.interactionKind = kind;
    mesh.userData.traversal = traversal;
    const entry = { mesh, surface, kind, label: label || mesh.name || kind, collider: null, savedCollider:null, colliderEnabled:false };

    if (shootable && !this.shootables.includes(mesh)) this.shootables.push(mesh);
    if (collidable) {
      entry.collider = new THREE.Box3().setFromObject(mesh);
      entry.collider.userData = { surface, kind, label: entry.label, traversal };
      entry.savedCollider=entry.collider.clone();entry.colliderEnabled=true;
      this.collisionBoxes.push(entry.collider);
    }

    this.entries.push(entry);
    return mesh;
  }

  // Dynamic chunk eviction must mutate these arrays IN PLACE. Weapons,
  // player physics, grapple and perception all hold their original references.
  unregisterMeshes(meshes){
    const targets=new Set(meshes),before=this.entries.length;
    const removed=this.entries.filter(e=>targets.has(e.mesh));
    if(!removed.length)return 0;
    const colliders=new Set(removed.filter(e=>e.collider).map(e=>e.collider));
    const survivors=this.entries.filter(e=>!targets.has(e.mesh));
    this.entries.splice(0,this.entries.length,...survivors);
    const bullets=this.shootables.filter(mesh=>!targets.has(mesh));
    this.shootables.splice(0,this.shootables.length,...bullets);
    const physics=this.collisionBoxes.filter(box=>!colliders.has(box));
    this.collisionBoxes.splice(0,this.collisionBoxes.length,...physics);
    return before-this.entries.length;
  }
  colliderActive(entry){return !!entry?.colliderEnabled;}
  setColliderEnabled(entry,enabled){
    if(!entry?.collider||!entry.savedCollider)return false;
    if(enabled)entry.collider.copy(entry.savedCollider);
    else entry.collider.makeEmpty();
    entry.colliderEnabled=!!enabled;
    return true;
  }
  findEntry(mesh){return this.entries.find(entry=>entry.mesh===mesh)??null;}

  registerShootable(mesh, { surface='character', kind='character', label=null }={}) {
    return this.register(mesh, { surface, kind, label, collidable:false, shootable:true });
  }

  snapshot() {
    const surfaces = {};
    const kinds = {};
    let shadowCasters=0;
    const routes={vault:0,mantle:0,wallRun:0,ledge:0};
    for (const entry of this.entries) {
      surfaces[entry.surface] = (surfaces[entry.surface] || 0) + 1;
      kinds[entry.kind] = (kinds[entry.kind] || 0) + 1;
      if(entry.mesh?.castShadow)shadowCasters++;
      const tag=entry.collider?.userData?.traversal;
      if(tag?.vaultable)routes.vault++;
      if(tag?.mantleable)routes.mantle++;
      if(tag?.wallRunnable)routes.wallRun++;
      if(tag?.ledge)routes.ledge++;
    }
    return {
      shootables: this.shootables.length,
      colliders: this.collisionBoxes.length,
      shadowCasters,
      routes,
      surfaces,
      kinds
    };
  }
}

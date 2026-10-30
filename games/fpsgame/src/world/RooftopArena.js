import * as THREE from 'three';
import {ROOFTOP_BLUEPRINT} from './RooftopBlacksiteBlueprint.js';
import {ROOFTOP_ENTRY} from '../core/RooftopArenaObjective.js';

// R2: render meshes and real motor/bullet/AI colliders from the SAME blueprint.
// Only entry→combat-bowl→extraction is mission-certified; upper routes are not.
const COLORS={...ROOFTOP_BLUEPRINT.materials};
export class RooftopArena {
  constructor(scene,registry){
    this.interactionFixtures={doors:[],alarms:[]};
    this.grappleAnchorPositions=[];
    this.meshes=[];
    const materials=new Map();
    const surfaceFor=name=>name==='glass'?'glass':name==='cover'||name==='deckTop'?'concrete':name==='edge'||name==='signal'||name==='traversal'?'metal':name==='structure'?'metal':'concrete';
    for(const g of ROOFTOP_BLUEPRINT.geometry){
      if(!materials.has(g.material)){
        const signal=['signal','traversal','edge'].includes(g.material);
        materials.set(g.material,new THREE.MeshStandardMaterial({
          color:COLORS[g.material],roughness:signal?.34:.78,metalness:signal?.36:.22,
          emissive:signal?COLORS[g.material]:0x000000,emissiveIntensity:signal?.3:0
        }));
      }
      const m=new THREE.Mesh(new THREE.BoxGeometry(g.size.x,g.size.y,g.size.z),materials.get(g.material));
      m.position.set(g.position.x,g.position.y,g.position.z);
      m.name='rooftop-'+g.id;
      m.receiveShadow=true;m.castShadow=!!g.collidable;
      scene.add(m);
      registry.register(m,{surface:surfaceFor(g.material),kind:'environment',
        label:g.id,collidable:!!g.collidable,shootable:!!g.collidable,traversal:g.traversal});
      this.meshes.push(m);
    }
    // Entry-only parapets physically delimit the playable roof corridor.
    // They stop walking over empty sky at the legacy ground-plane height.
    const parapet=new THREE.MeshStandardMaterial({color:0x243746,roughness:.7,metalness:.25});
    for(const [id,w,h,d,x,z] of [
      ['north',29,2.7,.5,0,50.8],
      ['west',.5,2.7,71,-14.65,15.0],
      ['east',.5,2.7,71,14.65,15.0],
      ['south',29,2.7,.5,0,-20.8]
    ]){
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),parapet);
      m.position.set(x,h/2,z);m.name='rooftop-entry-parapet-'+id;
      m.receiveShadow=true;m.castShadow=true;scene.add(m);
      registry.register(m,{surface:'metal',kind:'environment',label:m.name,
        collidable:true,shootable:true});
      this.meshes.push(m);
    }
    // Real tagged grappling anchors, visible in 3D and rejected by occluded raycast.
    this.grappleAnchorPositions=[{x:-10,y:3.6,z:22},{x:10,y:4.4,z:-1}];
    for(const a of this.grappleAnchorPositions){
      const m=new THREE.Mesh(new THREE.OctahedronGeometry(.45),
        new THREE.MeshStandardMaterial({color:0x68dbd4,emissive:0x157a86,emissiveIntensity:.9,metalness:.5}));
      m.position.set(a.x,a.y,a.z);m.name='rooftop-grapple-anchor';
      m.userData.grappleAnchor=true;scene.add(m);
      registry.register(m,{surface:'metal',kind:'gadget-anchor',label:m.name,collidable:false,shootable:true});
    }
    // Mark where the actual EARLY mission ends, not the proposed tower.
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.7,.085,10,48),
      new THREE.MeshBasicMaterial({color:0x54dfc0,transparent:true,opacity:.88}));
    ring.rotation.x=Math.PI/2;ring.position.set(ROOFTOP_ENTRY.exit.x,.10,ROOFTOP_ENTRY.exit.z);
    ring.name='rooftop-entry-extraction';scene.add(ring);
    const beacon=new THREE.PointLight(0x54dfc0,5,9,2);
    beacon.position.set(ROOFTOP_ENTRY.exit.x,1,ROOFTOP_ENTRY.exit.z);scene.add(beacon);
    // Separate recessed WEST extraction is reachable without leaving the
    // physical sightline cover. Never substitutes for the original loud exit.
    const quietRing=new THREE.Mesh(new THREE.TorusGeometry(.95,.09,10,40),
      new THREE.MeshBasicMaterial({color:0xf5c56e,transparent:true,opacity:.95}));
    quietRing.rotation.x=Math.PI/2;
    quietRing.position.set(ROOFTOP_ENTRY.quietExit.x,.12,ROOFTOP_ENTRY.quietExit.z);
    quietRing.name='rooftop-quiet-west-extraction';scene.add(quietRing);
    const quietBeacon=new THREE.PointLight(0xf5c56e,4,6,2);
    quietBeacon.position.set(ROOFTOP_ENTRY.quietExit.x,1.2,ROOFTOP_ENTRY.quietExit.z);
    scene.add(quietBeacon);
  }
  update(){}
}

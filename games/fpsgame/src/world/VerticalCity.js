import {MUTED_URBAN} from '../art/MutedUrbanPalette.js';
import * as THREE from 'three';
import {CITY_BLUEPRINT,cityGrappleEscape} from './VerticalCityBlueprint.js?v=city-combat-v2-2';

// One geometry registry is authoritative for render meshes, bullets and motor.
export class VerticalCity {
  constructor(scene,registry){
    this.interactionFixtures={doors:[],alarms:[]};
    this.grappleAnchorPositions=[];
    this.blueprint=CITY_BLUEPRINT;
    const mats=new Map(),geos=new Map(),decals=new Map();
    for(const item of CITY_BLUEPRINT.geometry){
      if(!mats.has(item.material)){
        const signal=['anchor','light'].includes(item.material);
        // Visual material only. CITY_BLUEPRINT physical structures unchanged.
        const tint=MUTED_URBAN.authoredCity[item.material]??CITY_BLUEPRINT.materials[item.material];
        mats.set(item.material,new THREE.MeshStandardMaterial({
          color:tint,
          emissive:signal?tint:0,
          emissiveIntensity:signal?.8:0,roughness:signal?.34:.76,metalness:signal?.4:.14
        }));
      }
      const {x,y,z}=item.position;
      // Batch non-collidable decorations into instances. Architecture, bullets
      // and grapple colliders remain individual authoritative scene meshes.
      if(!item.anchor&&!item.collidable){
        const key=item.material+':'+item.size.x+','+item.size.y+','+item.size.z;
        if(!decals.has(key))decals.set(key,{size:item.size,material:item.material,items:[]});
        decals.get(key).items.push(item.position);
        continue;
      }
      const shape=item.anchor?new THREE.OctahedronGeometry(.45):
        (geos.get(item.size.x+','+item.size.y+','+item.size.z)||
          (()=>{const geo=new THREE.BoxGeometry(item.size.x,item.size.y,item.size.z);
            geos.set(item.size.x+','+item.size.y+','+item.size.z,geo);return geo;})());
      const mesh=new THREE.Mesh(shape,mats.get(item.material));
      mesh.name='city-'+item.id;
      mesh.position.set(x,y,z);
      // Real collider-backed city architecture is hookable, but road/ground
      // and visual-only decals do not magically produce a rope attachment.
      mesh.userData.grappleSurface=!!item.collidable&&item.id!=='city-foundation'&&
        !item.id.startsWith('stair-')&&y+item.size.y/2>1.65;
      mesh.receiveShadow=item.collidable;
      // Citywide casters kept bounded to avoid high-rise shadow draw explosion.
      mesh.castShadow=item.collidable&&y<27&&item.material!=='floor'&&item.material!=='road'&&item.material!=='deck';
      if(item.anchor){
        mesh.userData.grappleAnchor=true;
        mesh.userData.grappleLanding={...item.landing};
        this.grappleAnchorPositions.push({x,y,z,landing:{...item.landing}});
      }
      scene.add(mesh);
      registry.register(mesh,{surface:item.material==='glass'?'glass':item.material==='anchor'?'metal':'concrete',
        kind:item.anchor?'gadget-anchor':'environment',label:item.id,
        collidable:!!item.collidable,shootable:!!item.collidable||!!item.anchor,traversal:item.traversal});
    }
    const transform=new THREE.Matrix4();
    for(const [key,batch] of decals){
      const {size,material,items}=batch;
      const geom=geos.get(size.x+','+size.y+','+size.z)||
        new THREE.BoxGeometry(size.x,size.y,size.z);
      const instanced=new THREE.InstancedMesh(geom,mats.get(material),items.length);
      instanced.name='city-decor-'+key;instanced.castShadow=false;instanced.receiveShadow=false;
      instanced.frustumCulled=false;
      items.forEach((p,i)=>instanced.setMatrixAt(i,transform.makeTranslation(p.x,p.y,p.z)));
      instanced.instanceMatrix.needsUpdate=true;
      scene.add(instanced);
    }
    this.decorationBatches=decals.size;
  }
  grappleEscape(position){return cityGrappleEscape(position);}
  update(){}
}

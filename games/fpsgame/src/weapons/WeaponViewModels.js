import {MUTED_URBAN} from '../art/MutedUrbanPalette.js';
// Procedural game-only viewmodel detailing, created once per weapon (no per-frame mesh allocations).
import * as THREE from 'three';
import {RIFLE_SIGHT_POINTS} from './RifleSightProfile.js';

export function detailRifle(part,material){
 const anodized=material(MUTED_URBAN.weapons.anodized,.37,.74),
  blued=material(MUTED_URBAN.weapons.blued,.32,.88),
  edge=material(MUTED_URBAN.weapons.edge,.42,.76),
  marking=material(MUTED_URBAN.weapons.marking,.42,.35);
 // Heat-shield and longitudinal top rail; irons deliberately share the aiming axis.
 part(new THREE.BoxGeometry(.21,.055,.61),anodized,[0,.13,-.50]);
 part(new THREE.BoxGeometry(.045,.03,.66),blued,[0,.17,-.52]);
 for(let k=0;k<7;k++){
  const z=-.82+k*.095;
  part(new THREE.BoxGeometry(.13,.012,.036),edge,[0,.191,z]);
  for(const side of [-1,1]){
   part(new THREE.BoxGeometry(.012,.035,.064),blued,[side*.10,.066,z]);
   part(new THREE.BoxGeometry(.045,.018,.034),anodized,[side*.095,.01,z]);
  }
 }
 part(new THREE.CylinderGeometry(.053,.055,.20,12),blued,[0,.03,-1.12],[Math.PI/2,0,0]);
 part(new THREE.CylinderGeometry(.075,.075,.052,12),edge,[0,.03,-1.08],[Math.PI/2,0,0]);
 // Narrow, open iron sights. The tip of the front post is the aim anchor.
 const sightPoints=RIFLE_SIGHT_POINTS;
 part(new THREE.BoxGeometry(.065,.032,.06),edge,[0,.239,-.82]);
 part(new THREE.BoxGeometry(.009,.068,.018),blued,[0,.292,-.82]);
 for(const side of [-1,1])part(new THREE.BoxGeometry(.007,.040,.020),blued,[side*.032,.31,.06]);
 part(new THREE.BoxGeometry(.073,.012,.024),edge,[0,.255,.06]);
 // Raised, removable reflex sight: thin open rings without an obstructing tube.
 // Irons sit in the lower third of its aperture, safely below the red dot.
 const opticParts=[];
 const optic=(geometry,mat,pos,rot)=>{const mesh=part(geometry,mat,pos,rot);opticParts.push(mesh);return mesh;};
 for(const side of [-1,1]){
  optic(new THREE.BoxGeometry(.012,.077,.09),edge,[side*.065,.298,-.14]);
  optic(new THREE.BoxGeometry(.025,.018,.19),anodized,[side*.065,.264,-.14]);
 }
 optic(new THREE.TorusGeometry(.080,.0045,8,28),edge,[0,.38,-.035]);
 const opticReticle=optic(new THREE.SphereGeometry(.006,12,12),
   new THREE.MeshBasicMaterial({color:0xff364d,toneMapped:false,transparent:true,
     depthTest:false,depthWrite:false}),[0,.38,-.14]);
 opticReticle.renderOrder=1000; // Holographic dot cannot disappear behind iron hardware.
 // Functional vented handguard, side receiver and muzzle collar.
 // Pure mesh detail: muzzle origin, optic height and ballistic math unchanged.
 for(const side of [-1,1]){
  part(new THREE.BoxGeometry(.022,.066,.40),anodized,[side*.123,.015,-.54]);
  for(let slot=0;slot<3;slot++)part(new THREE.BoxGeometry(.026,.014,.040),
    blued,[side*.140,.048,-.69+slot*.13]);
 }
 part(new THREE.BoxGeometry(.045,.06,.22),blued,[.132,.012,-.12]);
 part(new THREE.BoxGeometry(.075,.022,.065),edge,[.135,.062,-.15]);
 part(new THREE.CylinderGeometry(.031,.031,.092,10),blued,[0,.027,-1.224],[Math.PI/2,0,0]);
 const boltMesh=part(new THREE.BoxGeometry(.013,.055,.13),edge,[.116,.022,-.07]); // movable bolt cover
 part(new THREE.BoxGeometry(.022,.022,.074),marking,[.137,.021,-.10]);
 part(new THREE.BoxGeometry(.095,.039,.08),anodized,[.04,-.10,.11]);
 part(new THREE.BoxGeometry(.16,.024,.045),blued,[0,-.20,.33]); // trigger guard silhouette
 part(new THREE.BoxGeometry(.038,.03,.05),edge,[-.122,.01,.14]); // selector
 const setMode=(mode)=>{if(!Object.hasOwn(sightPoints,mode))return false;
  for(const mesh of opticParts)mesh.visible=mode==='RED_DOT';return true;};
 setMode('IRON');
 return {sightHeight:sightPoints.IRON.y,sightPoints,setMode,boltMesh,boltBase:-.07,opticReticle};
}
export function detailPistol(part,material){
 const slide=material(MUTED_URBAN.weapons.pistolSlide,.32,.87),edge=material(MUTED_URBAN.weapons.pistolEdge,.58,.55);
 const slideMesh=part(new THREE.BoxGeometry(.165,.09,.37),slide,[0,.085,-.28]);
 part(new THREE.BoxGeometry(.022,.04,.17),edge,[.091,.078,-.27]); // ejection-port silhouette
 for(let k=0;k<4;k++)part(new THREE.BoxGeometry(.176,.025,.013),edge,[0,.078,-.17+k*.025]);
 part(new THREE.BoxGeometry(.155,.018,.05),edge,[0,-.18,.02]);
 // Distinct front bead and twin rear notches form a usable pistol sightline.
 const bead=part(new THREE.SphereGeometry(.010,8,8),
   new THREE.MeshBasicMaterial({color:0xe7ebe2,toneMapped:false}),[0,.18,-.47]);
 for(const side of [-1,1])part(new THREE.BoxGeometry(.022,.048,.028),edge,[side*.058,.159,-.07]);
 // Machined slide serrations, muzzle ring and frame rail.
 part(new THREE.CylinderGeometry(.034,.034,.043,10),edge,[0,.085,-.487],[Math.PI/2,0,0]);
 for(const side of [-1,1]){
  for(let k=0;k<3;k++)part(new THREE.BoxGeometry(.012,.041,.012),
    edge,[side*.089,.091,-.38+k*.034]);
  part(new THREE.BoxGeometry(.020,.018,.16),slide,[side*.090,-.065,-.35]);
 }
 return {sightHeight:.18,slideMesh,slideBase:-.28,bead};
}

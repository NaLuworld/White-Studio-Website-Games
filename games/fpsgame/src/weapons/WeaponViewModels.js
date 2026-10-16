// Procedural game-only viewmodel detailing, created once per weapon (no per-frame mesh allocations).
import * as THREE from 'three';

export function detailRifle(part,material){
 const anodized=material(0x252d35,.37,.74),
  blued=material(0x121a21,.32,.88),
  edge=material(0x555e64,.42,.76),
  marking=material(0x6a876c,.42,.35);
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
 part(new THREE.BoxGeometry(.082,.066,.075),edge,[0,.23,-.82]);  // front sight mount
 part(new THREE.BoxGeometry(.018,.09,.025),blued,[0,.29,-.82]);   // front post
 for(const side of [-1,1])part(new THREE.BoxGeometry(.018,.065,.04),blued,[side*.05,.267,.06]);
 part(new THREE.BoxGeometry(.10,.045,.035),edge,[0,.23,.06]);   // rear notch
 part(new THREE.BoxGeometry(.013,.055,.13),edge,[.116,.022,-.07]); // bolt cover
 part(new THREE.BoxGeometry(.022,.022,.074),marking,[.137,.021,-.10]);
 part(new THREE.BoxGeometry(.095,.039,.08),anodized,[.04,-.10,.11]);
 part(new THREE.BoxGeometry(.16,.024,.045),blued,[0,-.20,.33]); // trigger guard silhouette
 part(new THREE.BoxGeometry(.038,.03,.05),edge,[-.122,.01,.14]); // selector
 return {sightHeight:.24};
}
export function detailPistol(part,material){
 const slide=material(0x2f3942,.32,.87),edge=material(0x171f29,.58,.55);
 const slideMesh=part(new THREE.BoxGeometry(.165,.09,.37),slide,[0,.085,-.28]);
 part(new THREE.BoxGeometry(.022,.04,.17),edge,[.091,.078,-.27]); // ejection-port silhouette
 for(let k=0;k<4;k++)part(new THREE.BoxGeometry(.176,.025,.013),edge,[0,.078,-.17+k*.025]);
 part(new THREE.BoxGeometry(.155,.018,.05),edge,[0,-.18,.02]);
 return {sightHeight:.135,slideMesh,slideBase:-.28};
}

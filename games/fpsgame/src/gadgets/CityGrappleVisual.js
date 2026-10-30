import * as THREE from 'three';

// All the visual parts are real Three.js meshes, built once per city session.
// Gun is a camera-local viewmodel; hook and cable live in world space.
export class CityGrappleVisual {
  constructor(scene,camera){
    this.scene=scene;this.camera=camera;
    const metal=new THREE.MeshStandardMaterial({color:0x354d64,metalness:.82,roughness:.24,depthTest:false}),
      black=new THREE.MeshStandardMaterial({color:0x101e2b,metalness:.6,roughness:.46,depthTest:false}),
      accent=new THREE.MeshStandardMaterial({color:0x52dfff,emissive:0x1186cb,emissiveIntensity:.7,metalness:.5,roughness:.26,depthTest:false});
    // Left-hand auxiliary: never obscures the primary 1/2/3 weapon at screen right.
    this.gun=new THREE.Group();this.gun.position.set(-.43,-.37,-.57);this.gun.scale.setScalar(.72);camera.add(this.gun);
    const part=(geometry,mat,pos,rot=null)=>{
      const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(...pos);
      if(rot)mesh.rotation.set(...rot);
      mesh.renderOrder=55;mesh.frustumCulled=false;this.gun.add(mesh);return mesh;
    };
    part(new THREE.BoxGeometry(.22,.14,.4),metal,[0,0,0]);
    part(new THREE.BoxGeometry(.16,.28,.13),black,[0,-.17,.11],[-.25,0,0]);
    part(new THREE.BoxGeometry(.085,.075,.47),black,[0,.09,-.27]);
    part(new THREE.CylinderGeometry(.067,.073,.24,14),metal,[0,.055,-.47],[Math.PI/2,0,0]);
    part(new THREE.CylinderGeometry(.054,.054,.055,14),accent,[0,.055,-.60],[Math.PI/2,0,0]);
    for(const side of [-1,1]){
      part(new THREE.BoxGeometry(.032,.065,.3),accent,[side*.115,.03,-.12]);
      part(new THREE.BoxGeometry(.022,.028,.18),black,[side*.078,.13,-.15]);
    }
    part(new THREE.BoxGeometry(.13,.048,.11),accent,[0,.16,-.20]);
    // Exposed motorized winch: visible wire drum, bearing caps, side rails and
    // tension markers distinguish this device from a generic sci-fi pistol.
    this.spool=part(new THREE.CylinderGeometry(.104,.104,.145,20),metal,[.17,.06,-.09],[0,0,Math.PI/2]);
    for(const side of [-1,1]){
      part(new THREE.TorusGeometry(.103,.014,7,24),accent,[.17+side*.079,.06,-.09],[0,Math.PI/2,0]);
      part(new THREE.BoxGeometry(.035,.13,.045),black,[side*.12,-.04,-.30]);
      part(new THREE.BoxGeometry(.026,.025,.17),metal,[side*.12,.15,-.25]);
      part(new THREE.BoxGeometry(.046,.028,.035),accent,[side*.128,.002,.12]);
    }
    part(new THREE.BoxGeometry(.17,.027,.17),metal,[0,-.07,-.35]);
    part(new THREE.CylinderGeometry(.022,.022,.19,10),black,[.12,-.10,.13],[0,0,Math.PI/2]);
    this.muzzle=new THREE.Object3D();this.muzzle.position.set(0,.055,-.64);this.gun.add(this.muzzle);
    this.hook=new THREE.Group();scene.add(this.hook);
    const hookMat=new THREE.MeshStandardMaterial({color:0x9beeff,metalness:.8,roughness:.22,emissive:0x1a819c,emissiveIntensity:.5});
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.12,.37,6),hookMat);tip.rotation.x=-Math.PI/2;this.hook.add(tip);
    for(let n=0;n<3;n++){const claw=new THREE.Mesh(new THREE.BoxGeometry(.075,.28,.085),hookMat);
      const a=n*2*Math.PI/3;claw.position.set(Math.sin(a)*.16,.0,Math.cos(a)*.16);
      claw.rotation.z=Math.sin(a)*.45;claw.rotation.x=Math.cos(a)*.45;this.hook.add(claw);}
    this.hook.visible=false;
    this.rope=new THREE.Mesh(new THREE.CylinderGeometry(.023,.023,1,7),new THREE.MeshStandardMaterial({
      color:0x6bddec,emissive:0x155b70,emissiveIntensity:.35,metalness:.35,roughness:.45
    }));
    this.rope.frustumCulled=false;this.rope.visible=false;scene.add(this.rope);
    this.origin=new THREE.Vector3();this.delta=new THREE.Vector3();this.up=new THREE.Vector3(0,1,0);
    this.shotKick=0;
  }
  muzzleWorld(){this.camera.updateMatrixWorld(true);return this.muzzle.getWorldPosition(new THREE.Vector3());}
  step(dt,{state='IDLE',point=null,selected=true,airSpeed=0,lateralSpeed=0,reducedMotion=false}={}){
    this.gun.visible=selected||state==='FLYING'||state==='SWINGING';
    this.shotKick=Math.max(0,this.shotKick-dt*3.4);
    const air=reducedMotion?0:Math.min(30,Math.max(0,airSpeed));
    this.gun.position.set(-.43,-.37-air*.00045,-.57+this.shotKick*.10);
    const bank=reducedMotion?0:THREE.MathUtils.clamp(-lateralSpeed*.0025,-.045,.045);
    this.gun.rotation.z+=(bank-this.gun.rotation.z)*(1-Math.exp(-9*Math.max(0,dt)));
    if(reducedMotion)this.gun.rotation.z=0;
    if(state==='SWINGING'||state==='FLYING')this.spool.rotation.y+=Math.max(0,dt)*Math.min(22,Math.max(2,airSpeed))*.7;
    const attached=state==='FLYING'||state==='HOOKED'||state==='SWINGING';
    this.hook.visible=attached&&!!point;this.rope.visible=attached&&!!point;
    if(!attached||!point)return;
    this.hook.position.copy(point);
    const start=this.muzzleWorld();
    this.delta.copy(point).sub(start);const length=this.delta.length();
    if(length<.001)return;
    this.rope.position.copy(start).add(point).multiplyScalar(.5);
    this.rope.scale.set(1,length,1);
    this.rope.quaternion.setFromUnitVectors(this.up,this.delta.multiplyScalar(1/length));
  }
  fire(){this.shotKick=1;}
  hide(){this.hook.visible=false;this.rope.visible=false;}
}

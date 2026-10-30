import {MUTED_URBAN} from '../art/MutedUrbanPalette.js';
import * as THREE from 'three';
import {solveTwoBoneElbow} from './TwoBoneArmIK.js';

// Lightweight, camera-local two-bone arm chains, with hands fixed to the gun.
// Anatomy is solved after the gun pose, never by changing weapon or camera aim.
const UP = new THREE.Vector3(0,1,0);
const STYLE = Object.freeze({
  glove:MUTED_URBAN.hands.glove,seam:MUTED_URBAN.hands.seam,
  sleeve:MUTED_URBAN.hands.sleeve,elbow:MUTED_URBAN.hands.elbow,
  cuff:MUTED_URBAN.hands.cuff
});
const GRIPS = {
  1: {
    dominant:{grip:[.115,-.217,.35],shoulder:[.49,-.77,-.38],pole:[.43,-.32,-.65],upper:.42,lower:.48},
    support:{grip:[-.116,-.105,-.52],shoulder:[-.16,-.82,-.72],pole:[-.28,-.57,-.94],upper:.34,lower:.42}
  },
  2: {
    dominant:{grip:[.106,-.206,.10],shoulder:[.37,-.78,-.40],pole:[.08,-.38,-.83],upper:.34,lower:.38},
    support:{grip:[-.106,-.204,.066],shoulder:[-.18,-.80,-.56],pole:[-.23,-.51,-.80],upper:.34,lower:.39}
  }
};
export class FirstPersonDualHandRig {
  constructor(camera,weaponGroup,slot,reloadHand){
    if(!GRIPS[slot])throw new RangeError('Dual hand rig expects firearm slot');
    this.weaponGroup=weaponGroup;
    this.reloadHand=reloadHand;
    this.root=new THREE.Group();
    this.root.name='fps-tactical-arms';
    camera.add(this.root);
    this._wrist=new THREE.Vector3();
    this._shoulder=new THREE.Vector3();
    this._elbow=new THREE.Vector3();
    this._axis=new THREE.Vector3();
    this._ikS=[0,0,0];this._ikW=[0,0,0];this._ikResult=[0,0,0];
    // Station lights have extreme intensity; fixed matte palette prevents blown-out
    // pale sleeves and keeps weapons, gloves and arms in the same visual language.
    const cloth=new THREE.MeshBasicMaterial({color:STYLE.sleeve,toneMapped:false});
    const glove=new THREE.MeshBasicMaterial({color:STYLE.glove,toneMapped:false});
    const seam=new THREE.MeshBasicMaterial({color:STYLE.seam,toneMapped:false});
    const cuffMat=new THREE.MeshBasicMaterial({color:STYLE.cuff,toneMapped:false});
    const elbowMat=new THREE.MeshBasicMaterial({color:STYLE.elbow,toneMapped:false});
    this.arms={};
    for(const [role,setup] of Object.entries(GRIPS[slot])){
      const hand=new THREE.Group();
      hand.name='fps-'+role+'-grip';
      hand.position.set(...setup.grip);
      const palm=new THREE.Mesh(new THREE.BoxGeometry(.115,.09,.138),glove);
      palm.position.set(0,-.019,0);
      hand.add(palm);
      const knuckle=new THREE.Mesh(new THREE.BoxGeometry(.102,.014,.040),seam);
      knuckle.position.set(0,-.032,-.051);
      hand.add(knuckle);
      const palmPad=new THREE.Mesh(new THREE.BoxGeometry(.109,.012,.082),cuffMat);
      palmPad.position.set(0,.031,-.016);
      hand.add(palmPad);
      // Matte glove armor: fitted wrist bridge and stitched top knuckle guard.
      // Hand origin and grip vectors are untouched, preserving the two-bone IK.
      const wristBridge=new THREE.Mesh(new THREE.BoxGeometry(.105,.022,.064),cuffMat);
      wristBridge.name='fps-'+role+'-visual-wrist-bridge';
      wristBridge.position.set(0,.027,.070);hand.add(wristBridge);
      const knuckleArmor=new THREE.Mesh(new THREE.BoxGeometry(.103,.013,.044),seam);
      knuckleArmor.name='fps-'+role+'-visual-knuckle-armor';
      knuckleArmor.position.set(0,-.021,-.067);hand.add(knuckleArmor);
      for(let f=0;f<4;f++){
        const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.014,.045,3,6),glove);
        finger.rotation.x=Math.PI/2;
        finger.position.set((f-1.5)*.028,-.048,-.059);
        hand.add(finger);
      }
      const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.022,.045,4,7),glove);
      thumb.rotation.z=role==='dominant'?-.65:.65;
      thumb.position.set(role==='dominant'?.072:-.072,-.016,.024);
      hand.add(thumb);
      weaponGroup.add(hand);
      // Narrow taper and 16-sided mesh remove the old oversized flat olive tubes.
      const upper=new THREE.Mesh(new THREE.CylinderGeometry(.067,.082,1,16),cloth);
      const forearm=new THREE.Mesh(new THREE.CylinderGeometry(.05,.062,1,16),cloth);
      const elbow=new THREE.Mesh(new THREE.SphereGeometry(.065,12,9),elbowMat);
      const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.053,.054,.055,12),cuffMat);
      for(const [name,mesh] of [['upper-arm',upper],['forearm',forearm],
         ['elbow-pad',elbow],['cuff',cuff]]){
        mesh.name='fps-'+role+'-'+name;
        mesh.castShadow=false;mesh.frustumCulled=false;
        this.root.add(mesh);
      }
      this.arms[role]={
        hand,upper,forearm,elbow,cuff,
        shoulder:new THREE.Vector3(...setup.shoulder),
        pole:setup.pole,upperLength:setup.upper,lowerLength:setup.lower,
        grip:new THREE.Vector3(...setup.grip),
        wristCamera:new THREE.Vector3(),elbowCamera:new THREE.Vector3()
      };
    }
    this.update(0,{sprintBlend:0,phase:0,reducedMotion:false});
  }
  segment(mesh,start,end){
    this._axis.copy(end).sub(start);
    const len=this._axis.length();
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    if(len>.0001)mesh.quaternion.setFromUnitVectors(UP,this._axis.multiplyScalar(1/len));
    mesh.scale.set(1,Math.max(.001,len),1);
  }
  setVisible(visible){this.root.visible=!!visible;}
  update(dt,{sprintBlend=0,phase=0,reducedMotion=false}={}){
    this.weaponGroup.updateMatrix();
    const sway=sprintBlend*(reducedMotion?.2:1);
    for(let i=0;i<2;i++){
      const arm=this.arms[i===0?'dominant':'support'];
      const reloading=i===1&&!!this.reloadHand?.visible;
      arm.hand.visible=!reloading;
      this._wrist.copy(reloading?this.reloadHand.position:arm.grip)
        .applyMatrix4(this.weaponGroup.matrix);
      arm.wristCamera.copy(this._wrist);
      this._shoulder.copy(arm.shoulder);
      this._shoulder.x+=Math.sin(phase+(i?Math.PI:0))*.007*sway;
      this._ikS[0]=this._shoulder.x;this._ikS[1]=this._shoulder.y;
      this._ikS[2]=this._shoulder.z;
      this._ikW[0]=this._wrist.x;this._ikW[1]=this._wrist.y;
      this._ikW[2]=this._wrist.z;
      solveTwoBoneElbow(this._ikS,this._ikW,arm.pole,
        arm.upperLength,arm.lowerLength,this._ikResult);
      this._elbow.set(...this._ikResult);
      arm.elbowCamera.copy(this._elbow);
      this.segment(arm.upper,this._shoulder,this._elbow);
      this.segment(arm.forearm,this._elbow,this._wrist);
      arm.elbow.position.copy(this._elbow);
      arm.cuff.position.copy(arm.forearm.position).lerp(this._wrist,.93);
      arm.cuff.quaternion.copy(arm.forearm.quaternion);
    }
  }
  snapshot(){
    const tip=new THREE.Vector3();
    const connected=Object.values(this.arms).every(a=>{
      tip.set(0,a.forearm.scale.y*.5,0)
        .applyQuaternion(a.forearm.quaternion).add(a.forearm.position);
      return tip.distanceTo(a.wristCamera)<.002;
    });
    return {
      visible:this.root.visible,
      supportGripVisible:this.arms.support.hand.visible,
      dominantGripVisible:this.arms.dominant.hand.visible,
      gloves:Object.values(this.arms).map(a=>a.hand.name),
      cameraWrist:Object.fromEntries(Object.entries(this.arms).map(([k,a])=>[k,a.wristCamera.toArray()])),
      cameraElbow:Object.fromEntries(Object.entries(this.arms).map(([k,a])=>[k,a.elbowCamera.toArray()])),
      segmentLengths:Object.fromEntries(Object.entries(this.arms).map(([k,a])=>[k,[a.upper.scale.y,a.forearm.scale.y]])),
      materialColor:STYLE.sleeve.toString(16),
      connected
    };
  }
}

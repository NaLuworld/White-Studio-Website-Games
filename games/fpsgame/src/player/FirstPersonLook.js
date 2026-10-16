import * as THREE from 'three';

export class FirstPersonLook {
  constructor(camera, domElement, { pointerSpeed, maxPitch }) {
    this.camera=camera; this.domElement=domElement; this.ownerDocument=domElement.ownerDocument;
    this.isLocked=false; this.fallbackActive=false; this.fallbackDragging=false; this.enabled=true;
    this.pointerSpeed=pointerSpeed; this.maxPitch=maxPitch; this.yaw=0; this.pitch=0; this.recoilYaw=0; this.recoilPitch=0; this.traversalRoll=0; this.traversalPitch=0; this.listeners=new Map();
    this.camera.rotation.order='YXZ'; this.syncFromCamera();
    this.onMouseMove=e=>{if(this.enabled&&(this.isLocked||(this.fallbackActive&&this.fallbackDragging)))this.applyLookDelta(e.movementX||0,e.movementY||0);};
    this.onPointerDown=e=>{if(this.fallbackActive&&e.button===2){this.fallbackDragging=true;e.preventDefault();}};
    this.onPointerUp=e=>{if(e.button===2)this.fallbackDragging=false;};
    this.onContextMenu=e=>{if(this.fallbackActive)e.preventDefault();};
    this.onPointerLockChange=()=>{const locked=this.ownerDocument.pointerLockElement===this.domElement;if(locked===this.isLocked)return;this.isLocked=locked;this.fallbackDragging=false;if(locked)this.fallbackActive=false;this.dispatchEvent(locked?'lock':'unlock');};
    this.onPointerLockError=()=>this.enableFallback();
    this.ownerDocument.addEventListener('mousemove',this.onMouseMove);
    this.ownerDocument.addEventListener('pointerup',this.onPointerUp);
    this.ownerDocument.addEventListener('pointerlockchange',this.onPointerLockChange);
    this.ownerDocument.addEventListener('pointerlockerror',this.onPointerLockError);
    this.domElement.addEventListener('pointerdown',this.onPointerDown);
    this.domElement.addEventListener('contextmenu',this.onContextMenu);
  }
  syncFromCamera(){const e=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');this.pitch=THREE.MathUtils.clamp(e.x-this.recoilPitch-this.traversalPitch,-this.maxPitch,this.maxPitch);this.yaw=e.y-this.recoilYaw;this.applyRotation();}
  applyRotation(){this.camera.rotation.set(THREE.MathUtils.clamp(this.pitch+this.recoilPitch+this.traversalPitch,-this.maxPitch,this.maxPitch),this.yaw+this.recoilYaw,this.traversalRoll,'YXZ');}
  setRecoilOffset(yaw=0,pitch=0){this.recoilYaw=yaw;this.recoilPitch=pitch;this.applyRotation();}
  setTraversalRoll(roll=0){this.traversalRoll=THREE.MathUtils.clamp(roll,-.122,.122);this.applyRotation();}
  setTraversalPitch(pitch=0){this.traversalPitch=THREE.MathUtils.clamp(pitch,-.10,.10);this.applyRotation();}
  applyLookDelta(x,y){this.yaw-=x*this.pointerSpeed;this.pitch=THREE.MathUtils.clamp(this.pitch-y*this.pointerSpeed,-this.maxPitch,this.maxPitch);this.applyRotation();this.dispatchEvent('change');}
  addEventListener(type,cb){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(cb);}
  dispatchEvent(type){for(const cb of this.listeners.get(type)||[])cb({type});}
  enableFallback(){if(this.fallbackActive)return;this.isLocked=false;this.fallbackActive=true;this.fallbackDragging=false;this.dispatchEvent('fallback');}
  lock(){if(this.isLocked)return;const request=this.domElement.requestPointerLock?.bind(this.domElement);if(!request){this.enableFallback();return;}try{const result=request();if(result?.catch)result.catch(()=>this.enableFallback());}catch{this.enableFallback();}}
  unlock(){if(this.ownerDocument.pointerLockElement){this.ownerDocument.exitPointerLock();return;}if(this.fallbackActive){this.fallbackActive=false;this.fallbackDragging=false;this.dispatchEvent('unlock');}}
  resetInteraction(){this.fallbackDragging=false;}
  getDirection(target){return target.set(0,0,-1).applyQuaternion(this.camera.quaternion).normalize();}
}

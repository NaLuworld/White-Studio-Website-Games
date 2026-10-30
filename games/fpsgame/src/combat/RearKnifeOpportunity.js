// S2 optional Action Circuit rear melee contract.
// Classification only: the real MeleeResolver raycast and DamageSystem
// remain the sole authorities for physical contact and actual HP mutation.
const UNSUSPECTING=new Set(['UNDETECTED','CALM','INVESTIGATING','SEARCHING']);
export function rearKnifeOpportunity({
 enabled=false,enemyPosition=null,attackerPosition=null,enemyYaw=0,
 phase=null,perceptionVisible=false,reach=2.2
}={}){
 if(!enabled||!UNSUSPECTING.has(phase)||perceptionVisible||!Number.isFinite(enemyYaw)||
    !Number.isFinite(reach)||reach<=0||reach>2.2)return false;
 const x=attackerPosition?.x-enemyPosition?.x;
 const z=attackerPosition?.z-enemyPosition?.z;
 if(!Number.isFinite(x)||!Number.isFinite(z))return false;
 const distance=Math.hypot(x,z);
 if(distance<.3||distance>reach)return false;
 // Existing Enemy forward is local +Z, rotated by its authoritative yaw.
 const behind=(Math.sin(enemyYaw)*x+Math.cos(enemyYaw)*z)/distance;
 return behind<=-.66;
}

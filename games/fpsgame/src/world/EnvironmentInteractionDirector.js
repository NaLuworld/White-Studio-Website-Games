// A single truth for switch/door state and collider participation.
// Does not write player/enemy transforms, damage, or AI sight knowledge.
const clampStep=dt=>Number.isFinite(dt)?Math.max(0,Math.min(.033,dt)):0;
export class EnvironmentInteractionDirector {
  constructor({registry,playerPosition,enemies=()=>[],emitNoise=()=>0}={}){
    this.registry=registry;this.playerPosition=playerPosition;this.enemies=enemies;this.emitNoise=emitNoise;
    this.items=new Map();this.alarmOn=false;this.alarmPulse=0;this.actions=0;this.blockedCloses=0;
  }
  addDoor(id,entry,{openY=2.9}={}){
    if(!id||this.items.has(id)||!entry?.collider)return false;
    this.items.set(id,{id,kind:'door',entry,closedY:entry.mesh.position.y,openY,open:false});
    entry.mesh.userData.interactionId=id;
    return true;
  }
  addAlarm(id,mesh){
    if(!id||this.items.has(id)||!mesh)return false;
    this.items.set(id,{id,kind:'alarm',mesh});
    mesh.userData.interactionId=id;
    return true;
  }
  blocked(item){
    const b=item.entry.savedCollider;
    const intersects=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&
      p.x>=b.min.x-.52&&p.x<=b.max.x+.52&&p.z>=b.min.z-.52&&p.z<=b.max.z+.52;
    if(intersects(this.playerPosition?.()))return true;
    return (this.enemies?.()||[]).some(e=>!e.dead&&intersects(e.group?.position));
  }
  activate(id){
    const item=this.items.get(id);
    if(!item)return {ok:false,reason:'unknown'};
    if(item.kind==='alarm'){
      this.alarmOn=!this.alarmOn;this.alarmPulse=0;this.actions++;
      return {ok:true,id,kind:'alarm',on:this.alarmOn};
    }
    if(item.open){
      if(this.blocked(item)){this.blockedCloses++;return {ok:false,id,reason:'occupied'};}
      item.entry.mesh.position.y=item.closedY;
      this.registry.setColliderEnabled(item.entry,true);
      item.open=false;
    }else{
      this.registry.setColliderEnabled(item.entry,false);
      item.entry.mesh.position.y=item.closedY+item.openY;
      item.open=true;
    }
    item.entry.mesh.updateMatrixWorld(true);
    this.actions++;
    return {ok:true,id,kind:'door',open:item.open};
  }
  step(dt){
    const step=clampStep(dt);
    if(!this.alarmOn||!step)return 0;
    this.alarmPulse+=step;
    if(this.alarmPulse<1.25)return 0;
    this.alarmPulse-=1.25;
    const alarm=[...this.items.values()].find(x=>x.kind==='alarm');
    return alarm?this.emitNoise(alarm.mesh.position):0;
  }
  reset(){
    this.alarmOn=false;this.alarmPulse=0;
    for(const item of this.items.values()){
      if(item.kind==='door'){
        item.entry.mesh.position.y=item.closedY;
        this.registry.setColliderEnabled(item.entry,true);
        item.entry.mesh.updateMatrixWorld(true);item.open=false;
      }
    }
  }
  snapshot(){
    return {enabled:true,alarmOn:this.alarmOn,actions:this.actions,blockedCloses:this.blockedCloses,
      doors:[...this.items.values()].filter(x=>x.kind==='door').map(x=>({id:x.id,open:x.open,
        colliderActive:this.registry.colliderActive(x.entry),z:x.entry.mesh.position.z,
        x:x.entry.mesh.position.x})),
      interactions:[...this.items.keys()]};
  }
}

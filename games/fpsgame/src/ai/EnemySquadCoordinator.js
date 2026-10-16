// Phase 17: local, line-of-sight grounded squad callouts. No remote wallhack
// or network information; awareness never authorizes combat without direct LOS.
export class EnemySquadCoordinator {
  constructor({radius=17.5,interval=1.25}={}){
    this.radius=radius;this.interval=interval;
    this.time=0;this.lastRelay=new Map();this.relays=0;this.recipients=0;
    this.lastSource=null;
  }
  advance(dt){
    if(Number.isFinite(dt)&&dt>0)this.time+=Math.min(.033,dt);
  }
  reset(){
    this.time=0;this.lastRelay.clear();this.relays=0;this.recipients=0;
    this.lastSource=null;
  }
  share(source,position,enemies,active){
    if(!source||source.dead||!source.perception?.visible||!position||!Number.isFinite(position.x)||!Number.isFinite(position.z))return 0;
    if(!active?.has(source.id))return 0;
    const last=this.lastRelay.get(source.id);
    if(last!==undefined && this.time-last<this.interval)return 0;
    this.lastRelay.set(source.id,this.time);
    const radiusSq=this.radius*this.radius,from=source.group.position;
    let reached=0;
    for(const ally of enemies){
      if(!ally||ally===source||ally.dead||!active.has(ally.id)||ally.perception?.visible)continue;
      if(!ally.perception||!ally.group?.position)continue;
      const dx=ally.group.position.x-from.x,dz=ally.group.position.z-from.z;
      if(dx*dx+dz*dz>radiusSq)continue;
      // Only last confirmed sighting, not invented current player tracking.
      ally.perception.forceRemember(position);
      ally.awareness?.hear(position); // Grounded relay gives a clue, never instant sight or fire.
      if(ally.state!=='ENGAGE'&&ally.state!=='REPOSITION'){
        ally.state='INVESTIGATE';ally.searchTimer=0;
      }
      reached++;
    }
    if(reached){this.relays++;this.recipients+=reached;this.lastSource=source.id;}
    return reached;
  }
  snapshot(){
    return {relays:this.relays,recipients:this.recipients,lastSource:this.lastSource,
      radius:this.radius,interval:this.interval};
  }
}

// Share only actually witnessed gunshot contact; target coordinates are a
// timestamped observation, never the current hidden player's position.
export class CitySuppressionCoordinator {
  constructor({radius=25,interval=1.3}={}){
    this.radius=radius;this.interval=interval;this.elapsed=0;this.lastShot=new Map();
    this.calls=0;this.orders=0;this.signalRemaining=0;
  }
  step(dt){const step=Math.max(0,Math.min(.033,Number.isFinite(dt)?dt:0));this.elapsed+=step;this.signalRemaining=Math.max(0,this.signalRemaining-step);}
  reset(){this.elapsed=0;this.lastShot.clear();this.calls=0;this.orders=0;this.signalRemaining=0;}
  notify(source,observedPosition,allies,activeIds){
    if(!source||source.dead||!source.perception?.visible||
      !observedPosition||!Number.isFinite(observedPosition.x)||!Number.isFinite(observedPosition.z)||
      !activeIds?.has(source.id))return 0;
    const last=this.lastShot.get(source.id);
    if(last!==undefined&&this.elapsed-last<this.interval)return 0;
    this.lastShot.set(source.id,this.elapsed);this.calls++;
    const r2=this.radius*this.radius;
    let issued=0;
    for(const ally of allies){
      if(!ally||ally===source||ally.dead||!activeIds.has(ally.id))continue;
      const p=ally.group.position,a=source.group.position;
      if((p.x-a.x)**2+(p.z-a.z)**2>r2)continue;
      if(!ally.cityTactics?.orderFlank(observedPosition))continue;
      // Last-known location only, and never grants direct fire authorization.
      ally.perception?.forceRemember(observedPosition);
      issued++;
    }
    this.orders+=issued;if(issued)this.signalRemaining=1.45;return issued;
  }
  snapshot(){return {calls:this.calls,orders:this.orders,radius:this.radius,
    interval:this.interval,warning:Number(this.signalRemaining.toFixed(2))};}
}

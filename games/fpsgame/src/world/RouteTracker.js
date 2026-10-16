// Records real movement through station geometry; never moves the player.
export const ROUTE_LABELS=Object.freeze(['GROUND','QUIET_SIDE','OVERHEAD_PARKOUR']);
export class RouteTracker{
  constructor(){this.reset();}
  reset(){this.route=null;this.completed=[];this.events=[];this.lastZ=null;this.lastSeen=null;}
  update({x,z,feetY=0,parkour='IDLE'}={}){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(feetY))return null;
    // The centerline crossings are physically measured, never debug position labels.
    if(this.route===null&&this.lastZ!==null&&this.lastZ>7&&z<=7){
      this.route=x<=-5?'QUIET_SIDE':x>=3.8?'EAST_APPROACH':'GROUND';
      this.events.push({kind:'ENTRY',route:this.route,x,z});
    }
    if(this.route==='EAST_APPROACH'&&z<7&&z>-18&&feetY>.55){
      this.route='OVERHEAD_PARKOUR';this.events.push({kind:'VERTICAL',route:this.route,x,z,feetY});
    }
    if(this.route&&this.route!=='EAST_APPROACH'&&!this.completed.includes(this.route)&&this.lastZ!==null&&this.lastZ>-18&&z<=-18){
      this.completed.push(this.route);this.events.push({kind:'EXIT',route:this.route,x,z});
    }
    this.lastZ=z;this.lastSeen={x,z,feetY};
    return this.route;
  }
  snapshot(){return {route:this.route,completed:[...this.completed],events:this.events.slice(-8),lastSeen:this.lastSeen?{...this.lastSeen}:null};}
}

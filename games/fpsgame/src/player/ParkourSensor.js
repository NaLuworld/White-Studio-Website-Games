// Bounded, allocation-light AABB traversal probes against the same station collision data as the motor.
// Only explicitly tagged station geometry grants special traversal permissions.
export class ParkourSensor {
  constructor(boxes,config){this.boxes=boxes;this.config=config;this.probes=0;this._ground={y:0,ground:null};}
  insideXZ(box,x,z,margin=0){
    return x>=box.min.x-margin && x<=box.max.x+margin && z>=box.min.z-margin && z<=box.max.z+margin;
  }
  isFree(x,z,feet,height=this.config.standing+.10,ignore=null){
    const c=this.config,r=c.radius;
    if(x-r<c.worldXMin||x+r>c.worldXMax||z-r<c.worldZMin||z+r>c.worldZMax)return false;
    this.probes++;
    for(const b of this.boxes){
      if(b===ignore)continue;
      if(feet+.025>=b.max.y-.008 || feet+height<=b.min.y+.008)continue;
      if(x+r>b.min.x+.008&&x-r<b.max.x-.008&&z+r>b.min.z+.008&&z-r<b.max.z-.008)return false;
    }
    return true;
  }
  // Recovery for a *shallow* existing overlap from a completed traversal or
  // floating-point contact. Never permits entering a solid from free space.
  // Each substep must reduce penetration of EVERY colliding box; no wall
  // teleport, through-wall traversal, or unbounded position correction.
  canExitShallowOverlap(fromX,fromZ,toX,toZ,feet,height=this.config.standing+.10){
    const c=this.config,r=c.radius,limit=r;
    if(![fromX,fromZ,toX,toZ,feet,height].every(Number.isFinite)||
       Math.hypot(toX-fromX,toZ-fromZ)>.075001||
       toX-r<c.worldXMin||toX+r>c.worldXMax||
       toZ-r<c.worldZMin||toZ+r>c.worldZMax)return false;
    let existed=false;
    for(const b of this.boxes){
      if(feet+.025>=b.max.y-.008||feet+height<=b.min.y+.008)continue;
      const left=b.min.x+.008-r,right=b.max.x-.008+r;
      const top=b.min.z+.008-r,bottom=b.max.z-.008+r;
      const depth=(x,z)=>x>left&&x<right&&z>top&&z<bottom?
        Math.min(x-left,right-x,z-top,bottom-z):0;
      const before=depth(fromX,fromZ),after=depth(toX,toZ);
      if(!before){if(after>0)return false;continue;}
      existed=true;
      if(before>limit||after>0&&after>=before-1e-7)return false;
    }
    return existed;
  }
  groundAt(x,z,fromFeet,toFeet=fromFeet-.12){
    this.probes++;
    let y=(fromFeet>=-.04&&toFeet<=.04)?0:null,ground=null;
    for(const b of this.boxes){
      // Stair tread support extends under the player's physical radius. It
      // prevents a one-frame unsupported gap when stepping onto a riser.
      const supportMargin=b.userData?.traversal?.stair?this.config.radius+.02:-.03;
      if(!this.insideXZ(b,x,z,supportMargin))continue;
      const top=b.max.y;
      if(top>fromFeet+.045||top<toFeet-.045)continue;
      if(y===null||top>y){y=top;ground=b;}
    }
    if(y===null)return null;
    this._ground.y=y;this._ground.ground=ground;return this._ground;
  }
  support(x,z,feet){const hit=this.groundAt(x,z,feet+.035,feet-.07);return hit&&Math.abs(hit.y-feet)<.08?hit:null;}
  forward(x,z,feet,dx,dz){
    this.probes++;
    const r=this.config.radius;let best=null,nearest=1.45;
    for(const b of this.boxes){
      const traversal=b.userData?.traversal;
      if(!traversal?.vaultable&&!traversal?.mantleable&&!traversal?.ledge)continue;
      const height=b.max.y-feet;
      if(height<.38||height>1.9||b.min.y>feet+1.6)continue;
      // Slab intersection against the player-expanded front face.
      let near=-Infinity,far=Infinity,nx=0,nz=0;
      for(const axis of ['x','z']){
        const d=axis==='x'?dx:dz,at=axis==='x'?x:z;
        const low=b.min[axis]-r-.03,high=b.max[axis]+r+.03;
        if(Math.abs(d)<1e-5){if(at<low||at>high){far=-Infinity;break;}continue;}
        const t1=(low-at)/d,t2=(high-at)/d;
        const enter=Math.min(t1,t2),exit=Math.max(t1,t2);
        if(enter>near){near=enter;nx=axis==='x'?(d>0?-1:1):0;nz=axis==='z'?(d>0?-1:1):0;}
        far=Math.min(far,exit);
      }
      if(near<-.08||near>nearest||far<0||dx*nx+dz*nz>-.68)continue;
      const extent=(Math.abs(dx)*(b.max.x-b.min.x)+Math.abs(dz)*(b.max.z-b.min.z));
      const landingDistance=near+extent+2*r+.35;
      const vaultX=x+dx*landingDistance,vaultZ=z+dz*landingDistance;
      const vaultGround=this.groundAt(vaultX,vaultZ,feet+.20,feet-1);
      const mantleDistance=near+r+Math.min(extent*.55,.6);
      const mantleX=x+dx*mantleDistance,mantleZ=z+dz*mantleDistance;
      const targetY=b.max.y;
      const mantleFree=this.insideXZ(b,mantleX,mantleZ,.04)&&this.isFree(mantleX,mantleZ,targetY);
      const canMantle=!!traversal.mantleable&&height>=(traversal.ledge?.42:.95)&&height<=1.85&&mantleFree&&
        this.isFree(x,z,Math.max(feet,targetY),undefined,b);
      const canVault=!!traversal.vaultable&&height>=.42&&height<=1.2&&extent<=1.9&&
        !!vaultGround&&this.isFree(vaultX,vaultZ,vaultGround.y)&&
        this.isFree(x,z,Math.max(feet,targetY),undefined,b);
      if(!canMantle&&!canVault)continue;
      nearest=near;
      best={box:b,distance:near,height,top:targetY,normalX:nx,normalZ:nz,
        canVault,canMantle,ledge:!!traversal.ledge,
        vaultTarget:{x:vaultX,z:vaultZ,y:vaultGround?.y??0},
        mantleTarget:{x:mantleX,z:mantleZ,y:targetY}};
    }
    return best;
  }
  wall(x,z,feet,dx,dz,side){
    this.probes++;
    const rx=-dz*side,rz=dx*side;let best=null,nearest=.38;
    for(const b of this.boxes){
      if(!b.userData?.traversal?.wallRunnable||b.max.y<feet+1.4||b.min.y>feet+.7)continue;
      // The forward direction must be almost tangent to the wall face.
      let distance=Infinity,nx=0,nz=0;
      if(Math.abs(dx)>.70){
        distance=rz>0?b.min.z-z:z-b.max.z;
        nz=rz>0?-1:1;
      }else if(Math.abs(dz)>.70){
        distance=rx>0?b.min.x-x:x-b.max.x;
        nx=rx>0?-1:1;
      }else continue;
      if(distance<-.08||distance>nearest)continue;
      if(Math.abs(dx*nx+dz*nz)>.4)continue;
      const nearX=x+rx*Math.max(0,distance),nearZ=z+rz*Math.max(0,distance);
      if(!this.insideXZ(b,nearX,nearZ,.12))continue;
      nearest=distance;
      best={box:b,side,normalX:nx,normalZ:nz,distance};
    }
    return best;
  }
  snapshot(x,z,feet,dx,dz){
    const f=this.forward(x,z,feet,dx,dz);
    const l=this.wall(x,z,feet,dx,dz,-1),r=this.wall(x,z,feet,dx,dz,1);
    return {canVault:!!f?.canVault,canMantle:!!f?.canMantle,ledgeDetected:!!f?.ledge,
      obstacleHeight:f?.height??null,wallSide:l?'LEFT':r?'RIGHT':null,
      wallNormal:l?[l.normalX,0,l.normalZ]:r?[r.normalX,0,r.normalZ]:null,probes:this.probes};
  }
}

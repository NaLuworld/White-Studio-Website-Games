import * as THREE from 'three';

const PARTICLE_COLORS=Object.freeze({
  dust:new THREE.Color(0xbcae97),
  glass:new THREE.Color(0xa9e7ff),
  smoke:new THREE.Color(0x8c939b),
  hit:new THREE.Color(0xd78b6b),
  spark:new THREE.Color(0xffc45a)
});

export class ParticleManager {
  constructor(scene, count=700) {
    this.count=count;
    this.activeLimit=count;
    this.pos=new Float32Array(count*3);
    this.vel=new Float32Array(count*3);
    this.life=new Float32Array(count);
    this.col=new Float32Array(count*3);
    for(let i=0;i<count;i++)this.pos[i*3+1]=-999;
    this.cursor=0;
    this.geo=new THREE.BufferGeometry();
    this.geo.setAttribute('position',new THREE.BufferAttribute(this.pos,3));
    this.geo.setAttribute('color',new THREE.BufferAttribute(this.col,3));
    this.geo.setDrawRange(0,count);
    this.mat=new THREE.PointsMaterial({size:.07,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending});
    this.points=new THREE.Points(this.geo,this.mat);
    this.points.frustumCulled=false;
    scene.add(this.points);
  }

  setActiveLimit(limit) {
    const next=Math.max(32,Math.min(this.count,Math.floor(limit)));
    if(next<this.activeLimit){for(let i=next;i<this.activeLimit;i++){this.life[i]=0;this.pos[i*3+1]=-999;}}
    this.activeLimit=next;this.geo.setDrawRange(0,next);this.geo.attributes.position.needsUpdate=true;
  }

  burst(point, kind='spark', count=14) {
    const color=PARTICLE_COLORS[kind]||PARTICLE_COLORS.spark;
    for(let k=0;k<count;k++) {
      const i=this.cursor++%this.activeLimit;
      const j=i*3;
      this.pos[j]=point.x;this.pos[j+1]=point.y;this.pos[j+2]=point.z;
      const speed=kind==='smoke'?.7:kind==='dust'?1.4:kind==='hit'?1.9:3.6;
      this.vel[j]=(Math.random()-.5)*speed;this.vel[j+1]=Math.random()*speed;this.vel[j+2]=(Math.random()-.5)*speed;
      this.life[i]=kind==='smoke'?1.2:kind==='hit'?.22+Math.random()*.12:.45+Math.random()*.35;
      this.col[j]=color.r;this.col[j+1]=color.g;this.col[j+2]=color.b;
    }
    this.geo.attributes.position.needsUpdate=true;
    this.geo.attributes.color.needsUpdate=true;
  }

  update(dt) {
    for(let i=0;i<this.activeLimit;i++) {
      if(this.life[i]<=0) continue;
      const j=i*3;
      this.life[i]-=dt;
      this.pos[j]+=this.vel[j]*dt;this.pos[j+1]+=this.vel[j+1]*dt;this.pos[j+2]+=this.vel[j+2]*dt;
      this.vel[j+1]-=2.4*dt;this.vel[j]*=.985;this.vel[j+2]*=.985;
      if(this.life[i]<=0)this.pos[j+1]=-999;
    }
    this.geo.attributes.position.needsUpdate=true;
  }

  snapshot() {
    let active=0;
    for(let i=0;i<this.activeLimit;i++) if(this.life[i]>0) active++;
    return { poolSize:this.count, activeLimit:this.activeLimit, activeParticles:active, cursor:this.cursor };
  }
}

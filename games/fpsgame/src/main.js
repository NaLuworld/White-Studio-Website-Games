import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FirstPersonLook } from './player/FirstPersonLook.js';
import { shouldSuppressBrowserShortcut } from './player/GameKeyboardGuard.js';
import { PlayerController } from './player/PlayerController.js';
import { WeaponStateMachine, WEAPON_STATES } from './weapons/WeaponStateMachine.js';
import {WEAPON_DEFINITIONS,weaponSlotValid} from './weapons/WeaponDefinitions.js';
import {WeaponInventory} from './weapons/WeaponInventory.js';
import {ADSController} from './weapons/ADSController.js';
import {detailRifle,detailPistol} from './weapons/WeaponViewModels.js';
import {KnifeWeapon} from './weapons/KnifeWeapon.js';
import {MeleeResolver} from './combat/MeleeResolver.js';
import { Ballistics } from './weapons/Ballistics.js';
import { RecoilModel } from './weapons/RecoilModel.js';
import { ProceduralCharacterRig } from './characters/ProceduralCharacterRig.js';
import { CharacterAnimator } from './characters/CharacterAnimator.js';
import { EnemyPerception } from './ai/EnemyPerception.js';
import { StealthAwareness } from './ai/StealthAwareness.js';
import { EnemyNavigation } from './ai/EnemyNavigation.js';
import { EnemyCombat } from './ai/EnemyCombat.js';
import { EnemyTacticalResponse } from './ai/EnemyTacticalResponse.js';
import { EnemySquadCoordinator } from './ai/EnemySquadCoordinator.js';
import { DamageSystem } from './combat/DamageSystem.js';
import { TraversalCombatDirector } from './combat/TraversalCombatDirector.js';
import { EncounterDirector } from './combat/EncounterDirector.js';
import { CombatFeelDirector } from './combat/CombatFeelDirector.js';
import { CombatActionQueue } from './combat/CombatActionQueue.js';
import { DIFFICULTY_PROFILES, DEFAULT_DIFFICULTY, validDifficulty, applyDifficulty } from './combat/DifficultyProfiles.js';
import { PlayerLifeCycle, PLAYER_LIFE_STATES } from './player/PlayerLifeCycle.js';
import { WorldInteractionRegistry } from './world/WorldInteractionRegistry.js';
import {EnvironmentInteractionDirector} from './world/EnvironmentInteractionDirector.js';
import {RouteTracker} from './world/RouteTracker.js';
import { AudioManager } from './audio/AudioManager.js';
import { ParticleManager } from './fx/ParticleManager.js';
import { RuntimeGuard } from './core/RuntimeGuard.js';
import { QualityTrace } from './quality/QualityTrace.js';
import {GADGET_DEFINITIONS} from './gadgets/GadgetDefinitions.js';
import {GadgetInventory} from './gadgets/GadgetInventory.js';
import {GadgetResolver} from './gadgets/GadgetResolver.js';
import {GrappleMotion} from './gadgets/GrappleMotion.js';

const QUERY = new URLSearchParams(location.search);
const CONFIG = {
  externalModels: QUERY.has('models'),
  autotest: QUERY.has('autotest'),
  debug: QUERY.has('debug'),
  stealth: QUERY.has('stealth'),
  gadgets: QUERY.has('gadgets'),
  sandbox: QUERY.has('sandbox'),
  assets: {
    station: './assets/models/station.glb',
    train: './assets/models/train.glb',
    rifle: './assets/models/rifle.glb',
    enemy: './assets/models/enemy.glb',
    hdr: './assets/hdr/station_night.hdr'
  },
  player: { walk: 5.2, sprint: 8.3, jump: 7.2, gravity: 20, standing: 1.72, crouch: 1.12, lookSensitivity: 0.0022, maxPitch: THREE.MathUtils.degToRad(86), acceleration: 24, deceleration: 30, radius: .35, eyeTransition: 15, landingDuration: .12 },
  weapon: { mag: 30, reserve: 120, damage: 36, headshot: 90, rpm: 632, reload: 1.75, equip: .2, spreadStanding: .0008, spreadMoving: .0045, spreadCrouch: .00045, recoil: { randomness: .18, cameraKickHorizontal: .42, cameraKickVertical: .38, recoverySpring: 44, recoveryDamping: 8.5, weaponKick: 2.8, weaponSpring: 72, weaponDamping: 12 } },
  enemyCount: 5,
  world: { x: 26, xMin: -12.8, xMax: 13.8, trainLaneMinX: 16, zMin: -60, zMax: 34 }
};

const $ = id => document.getElementById(id);
const QUALITY_PRESETS=Object.freeze({
  LOW:{bloom:false,shadows:false,shadowMap:1024,pixelRatio:1,bloomStrength:0,particles:280},
  MEDIUM:{bloom:true,shadows:true,shadowMap:1024,pixelRatio:1.25,bloomStrength:.32,particles:460},
  HIGH:{bloom:true,shadows:true,shadowMap:2048,pixelRatio:1.5,bloomStrength:.48,particles:700},
  ULTRA:{bloom:true,shadows:true,shadowMap:2048,pixelRatio:2,bloomStrength:.6,particles:700}
});
const ENEMY_BOUNDS=Object.freeze({xMin:-13.3,xMax:13.3,zMin:CONFIG.world.zMin+1,zMax:CONFIG.world.zMax-1});

const clamp = THREE.MathUtils.clamp;
const tmpV = new THREE.Vector3();
let lastFrame = performance.now();
const raycaster = new THREE.Raycaster();
const keys = new Set();
const worldInteractions = new WorldInteractionRegistry();
const shootables = worldInteractions.shootables;
const collisionBoxes = worldInteractions.collisionBoxes;
let game;

class AssetManager {
  constructor() {
    this.manager = new THREE.LoadingManager();
    this.gltf = new GLTFLoader(this.manager);
    this.hdr = new HDRLoader(this.manager);
    this.cache = new Map();
    this.manager.onProgress = (_, loaded, total) => {
      const p = total ? Math.round(loaded / total * 100) : 0;
      $('progressBar').style.width = p + '%';
      $('loadingText').textContent = 'LOADING STATION... ' + p + '%';
    };
  }
  async loadGLTF(key, url) {
    if (this.cache.has(key)) return this.cache.get(key);
    try {
      const g = await this.gltf.loadAsync(url);
      g.scene.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true; o.receiveShadow = true;
          if (o.material) o.material.needsUpdate = true;
        }
      });
      this.cache.set(key, g);
      return g;
    } catch {
      this.cache.set(key, null);
      return null;
    }
  }
  async loadHDR(url) {
    try {
      const tex = await this.hdr.loadAsync(url);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      return tex;
    } catch { return null; }
  }
  async warmup() {
    $('assetStatus').textContent = 'Loading station HDR environment...';
    const hdr = await this.loadHDR(CONFIG.assets.hdr);
    if (!CONFIG.externalModels) {
      $('assetStatus').textContent = hdr ? 'CC0 station HDR loaded. Procedural gameplay models active.' : 'HDR unavailable. Procedural lighting and models active.';
      return { hdr, station:null, train:null, rifle:null, enemy:null };
    }
    $('assetStatus').textContent = 'Checking optional GLB models...';
    const [station, train, rifle, enemy] = await Promise.all([
      this.loadGLTF('station', CONFIG.assets.station),
      this.loadGLTF('train', CONFIG.assets.train),
      this.loadGLTF('rifle', CONFIG.assets.rifle),
      this.loadGLTF('enemy', CONFIG.assets.enemy)
    ]);
    return { hdr, station, train, rifle, enemy };
  }
}

function box(w,h,d,mat,x,y,z, surface='concrete', collidable=true,traversal=null,shootable=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=collidable&&surface!=='glass'; m.receiveShadow=true;
  game.scene.add(m);worldInteractions.register(m,{surface,collidable,shootable,kind:'environment',traversal});
  return m;
}
function mat(color,rough=.5,metal=0,emissive=0x000000,ei=0){
  return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,emissive,emissiveIntensity:ei});
}
function signTexture(text, sub=''){
  const c=document.createElement('canvas'); c.width=1024;c.height=256;const x=c.getContext('2d');
  x.fillStyle='#07101b';x.fillRect(0,0,c.width,c.height);x.fillStyle='#f5f8fb';x.font='700 68px sans-serif';x.fillText(text,45,115);
  x.fillStyle='#9ad7ff';x.font='32px sans-serif';x.fillText(sub,47,178);x.strokeStyle='#ff4655';x.lineWidth=10;x.strokeRect(0,0,c.width,c.height);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

class Station {
  constructor(){
    this.group=new THREE.Group();game.scene.add(this.group);
    this.floorMat=new THREE.MeshPhysicalMaterial({color:0x27313a,roughness:.26,metalness:.05,clearcoat:.28,clearcoatRoughness:.25});
    const floor=box(54,.35,100,this.floorMat,0,-.18,-12,'concrete',false);
    const ceiling=box(54,.25,100,mat(0x151a20,.65,.15),0,8.5,-12,'metal',false);
    for(let z=-52;z<=26;z+=8){
      box(1.2,8,1.2,mat(0x555f69,.24,.92),-10,4,z,'metal');
      box(1.2,8,1.2,mat(0x555f69,.24,.92),10,4,z,'metal');
    }
    box(.4,3.3,100,mat(0x13181d,.6,.7),-15,1.65,-12,'metal');
    box(.4,3.3,100,mat(0x13181d,.6,.7),15,1.65,-12,'metal');
    for(let z=-54;z<32;z+=6){
      const strip=box(12,.05,.35,mat(0xffffff,.25,0,0xffffff,3),0,8.32,z,'metal',false);
      strip.castShadow=false;
      const light=new THREE.PointLight(0xe8f6ff,8,15,2);light.position.set(0,7.8,z);game.scene.add(light);
    }
    this.createPlatform();
    this.createShop();
    this.createGates();
    this.createSigns();
    this.createBenches();
    this.createParkourRoutes();
    if(CONFIG.gadgets)this.createGrappleAnchors();
    if(CONFIG.sandbox)this.createInteractiveRoutes();
    this.createSakura();
  }
  createPlatform(){
    box(8,.35,100,mat(0x343a40,.5,.05),20,.05,-12,'concrete',false);
    box(.12,.05,100,mat(0xffc629,.42,.05,0xffb900,.1),16.1,.25,-12,'concrete',false);
    for(let z=-56;z<34;z+=3){ box(.18,.12,2.2,mat(0x60656a,.3,.9),25,-.05,z,'metal',false); }
    for(let z=-54;z<32;z+=6){
      box(.2,.6,5.2,mat(0x323c46,.25,.9),16.3,1.05,z,'glass');
      const glass=box(.08,1.55,4.8,new THREE.MeshPhysicalMaterial({color:0x82a8bd,roughness:.12,metalness:.05,transmission:.55,transparent:true,opacity:.5}),16.22,1.8,z,'glass');
      glass.castShadow=false;
    }
  }
  createShop(){
    box(10,4.4,13,mat(0x202126,.55,.12),-19,2,-18,'concrete');
    const front=box(.12,3.4,9.8,new THREE.MeshPhysicalMaterial({color:0x88b6c8,roughness:.15,transmission:.42,transparent:true,opacity:.48}),-13.95,2,-18,'glass',false);
    front.castShadow=false;
    box(.18,1.1,9.5,mat(0xffe8b8,.3,.1,0xffb24a,2),-13.82,4.4,-18,'metal',false);
    const s=new THREE.Mesh(new THREE.PlaneGeometry(6.8,1.35),new THREE.MeshStandardMaterial({map:signTexture('駅コンビニ','STATION MARKET'),emissive:0xffffff,emissiveMap:signTexture('駅コンビニ','STATION MARKET'),emissiveIntensity:.6}));
    s.position.set(-13.72,4.45,-18);s.rotation.y=Math.PI/2;game.scene.add(s);
    const warm=new THREE.PointLight(0xffb86b,45,13,2);warm.position.set(-17,3.3,-18);game.scene.add(warm);
    for(let z=-22;z<=-14;z+=2.4) box(4,.12,1.2,mat(0xe6e2d8,.6,0),-19,1.2,z,'wood');
  }
  createGates(){
    for(let z=8;z<=20;z+=3) {
      box(2.4,1.15,1.0,mat(0x65727e,.3,.85),-4, .58,z,'metal');
      box(2.4,1.15,1.0,mat(0x65727e,.3,.85),4, .58,z,'metal');
    }
  }
  createSigns(){
    const tex=signTexture('中央線  PLATFORM 2','渋谷方面 / SHIBUYA · 3 MIN');
    const m=new THREE.Mesh(new THREE.PlaneGeometry(8,2),new THREE.MeshStandardMaterial({map:tex,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:.7}));
    m.position.set(0,5.6,-5); game.scene.add(m);
  }
  createBenches(){
    for(const z of [-34,-4,25]) {
      box(4,.25,1.1,mat(0x5b4838,.65,.05),6,.65,z,'wood');
      box(.2,.75,.2,mat(0x454d54,.3,.8),4.4,.27,z,'metal');
      box(.2,.75,.2,mat(0x454d54,.3,.8),7.6,.27,z,'metal');
    }
  }
  createParkourRoutes(){
    // Visual affordances match explicit collision tags, never arbitrary shop glass/train props.
    const routeMat=mat(0x536676,.62,.36),topMat=mat(0x8eb4c5,.4,.2);
    const safety=mat(0x58bed3,.34,.22,0x25849a,.72),mantleEdge=mat(0xe2ac55,.38,.17,0x9d571c,.55);
    const routes=[
      [1.8,.9,.9,0,.45,14,'metal',{vaultable:true,ledge:true}],
      [1.65,1.5,1.3,-2,.75,2,'concrete',{mantleable:true,ledge:true}],
      [2.8,.28,2.4,-6,1.62,-16,'concrete',{mantleable:true,ledge:true}],
      [.5,3.2,12,-8,1.6,-30,'concrete',{wallRunnable:true}],
      [3,.32,2.8,-5,1.6,-36,'concrete',{mantleable:true,ledge:true}],
      [1.55,.82,1.0,3.2,.41,-11.2,'metal',{vaultable:true,ledge:true}],
      [1.7,1.42,1.3,5.2,.71,-25,'concrete',{mantleable:true,ledge:true}],
      [1.6,.88,.95,-1.8,.44,-44,'metal',{vaultable:true,ledge:true}]
    ];
    for(const [w,h,d,x,y,z,surface,tag] of routes){
      box(w,h,d,tag.mantleable?topMat:routeMat,x,y,z,surface,true,tag);
      if(tag.wallRunnable){
        const guide=box(.045,.09,d,safety,x+w*.5+.035,1.5,z,'metal',false,null,false);
        guide.castShadow=false;
      }else{
        const stripe=box(w+.04,.055,.095,tag.mantleable?mantleEdge:safety,x,y+h*.5+.045,z+d*.5-.10,'metal',false,null,false);
        stripe.castShadow=false;
      }
    }
  }
  createGrappleAnchors(){
    // Public world anchors: visible, individually raycast-tagged, never wallhacks.
    this.grappleAnchorPositions=[{x:0,y:3.6,z:10},{x:-5,y:4.2,z:-20},{x:4,y:4,z:-41}];
    for(const {x,y,z} of this.grappleAnchorPositions){
      const m=new THREE.Mesh(new THREE.SphereGeometry(.36,12,8),mat(0x35d9de,.26,.55,0x1b888f,.82));
      m.position.set(x,y,z);m.castShadow=false;game.scene.add(m);
      m.userData.grappleAnchor=true;
      worldInteractions.register(m,{surface:'metal',kind:'gadget-anchor',collidable:false,shootable:true,label:'grapple-anchor'});
    }
  }
  createInteractiveRoutes(){
    // Dedicated opt-in arena. Do not replace any of the original cover, geometry or sector fixtures.
    this.interactionFixtures={doors:[],alarms:[]};
    const shutter=mat(0x657b90,.5,.65,0x17647d,.18);
    for(const [id,x,z] of [['central-shutter',0,7],['side-access',-7,-10]]){
      const mesh=box(2.35,2.55,.26,shutter,x,1.275,z,'metal');
      mesh.userData.interactionId=id;
      this.interactionFixtures.doors.push({id,entry:worldInteractions.findEntry(mesh)});
      // Switch stays reachable when the shutter rises above the player's gaze.
      const button=box(.26,.35,.18,mat(0x83ddec,.34,.3,0x2b9eb8,.85),x+1.6,1.42,z+.28,'metal',false);
      button.userData.interactionId=id;
      // Fixed luminous threshold guides remain shootable=false and non-colliding.
      box(2.85,.10,.16,mat(0x46c8d8,.6,0,0x308ba8,.7),x,2.65,z,'metal',false,null,false);
    }
    // Right-hand route needs true airborne traversal, not just a location label.
    box(1.3,.70,.85,mat(0x537e99,.62,.35),8.58,.35,-13.2,'metal',true,{vaultable:true,ledge:true});
    const alarm=box(.45,.55,.24,mat(0xe84a54,.45,.2,0xa61426,1.25),1.5,1.65,18.3,'metal',false);
    alarm.userData.interactionId='station-alarm';
    this.interactionFixtures.alarms.push({id:'station-alarm',mesh:alarm});
    // Three original route affordances with no invisible colliders or teleport triggers.
    for(const [x,z,color] of [[0,5,0xdab85a],[-7,5,0x59cca8],[6,5,0x74bce8]])
      box(.6,.025,1.8,mat(color,.85,0,color,.18),x,.02,z,'concrete',false,null,false);
  }
  createSakura(){
    const trunk=mat(0x4f352d,.85,0), blossom=mat(0xff9ac3,.8,0,0xff7fb4,.12);
    for(const z of [-43,-38]){
      box(.55,4,.55,trunk,-7,2,z,'wood',false);
      for(let i=0;i<10;i++){
        const p=new THREE.Mesh(new THREE.IcosahedronGeometry(.8+Math.random()*.55,1),blossom);
        p.position.set(-7+(Math.random()-.5)*3.8,4+Math.random()*2,z+(Math.random()-.5)*3.2);game.scene.add(p);
      }
    }
    this.petals=[];
    const g=new THREE.PlaneGeometry(.09,.05), pm=new THREE.MeshBasicMaterial({color:0xffa9c8,side:THREE.DoubleSide,transparent:true,opacity:.82});
    for(let i=0;i<120;i++){ const p=new THREE.Mesh(g,pm); this.resetPetal(p,true);game.scene.add(p);this.petals.push(p); }
  }
  resetPetal(p,first=false){p.position.set(-7+(Math.random()-.5)*10,first?Math.random()*8:8,-40+(Math.random()-.5)*16);p.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);p.userData.v=.25+Math.random()*.5;}
  update(dt){const windTime=performance.now()*.001;for(const p of this.petals){p.position.y-=p.userData.v*dt;p.position.x+=Math.sin(windTime+p.position.z)*.12*dt;p.rotation.z+=dt;if(p.position.y<.1)this.resetPetal(p);}}
}

class Train {
  constructor(){
    this.group=new THREE.Group();this.group.position.set(23,0,-86);this.group.userData.interactionKind='train-visual-only';this.collisionMode='visual-only';this.safeLaneMinX=CONFIG.world.trainLaneMinX;game.scene.add(this.group);
    const body=mat(0xd9dee2,.23,.65), stripe=mat(0x4aa1d7,.3,.65,0x1d5b85,.25), dark=mat(0x111820,.18,.55);
    for(let c=0;c<3;c++){
      const car=new THREE.Group();car.position.z=c*10.2;
      const shell=new THREE.Mesh(new THREE.BoxGeometry(4.6,3.5,9.7),body);shell.position.y=2.1;car.add(shell);
      const band=new THREE.Mesh(new THREE.BoxGeometry(4.72,.38,9.8),stripe);band.position.y=2.3;car.add(band);
      for(let z=-3.3;z<=3.3;z+=2.2){
        for(const x of [-2.31,2.31]){
          const w=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.9),dark);w.position.set(x,2.8,z);w.rotation.y=x>0?Math.PI/2:-Math.PI/2;car.add(w);
        }
      }
      this.group.add(car);
    }
    const head=new THREE.PointLight(0xeaf7ff,90,28,1.7);head.position.set(0,2.3,5.2);this.group.add(head);
    this.phase=0;this.timer=0;this.announced=false;
  }
  update(dt){
    this.timer+=dt;
    if(this.phase===0 && this.timer>8){this.phase=1;this.timer=0;this.announced=true;game.notice('TRAIN ARRIVING');game.audio.trainHorn();game.audio.announce();}
    if(this.phase===1){ this.group.position.z+=10*dt; if(this.group.position.z>-28){this.phase=2;this.timer=0;} }
    else if(this.phase===2 && this.timer>11){this.phase=3;this.timer=0;game.notice('DOORS CLOSING');}
    else if(this.phase===3){this.group.position.z+=10*dt;if(this.group.position.z>55){this.group.position.z=-86;this.phase=0;this.timer=0;this.announced=false;}}
  }
}

class Enemy {
  constructor(id,pos){
    this.id=id;this.hp=100;this.state='PATROL';this.dead=false;
    this.vel=new THREE.Vector3();this.desiredVel=new THREE.Vector3();this.home=pos.clone();
    this.strafeSign=id%2?1:-1;this.searchTimer=0;this.repositionTimer=0;
    this.rig=new ProceduralCharacterRig();this.group=this.rig.root;this.group.position.copy(pos);this.animator=new CharacterAnimator(this.rig);
    this.perception=new EnemyPerception({sightRadius:25,fovDegrees:122,memorySeconds:2.4,nearAwarenessRadius:5.5});
    this.awareness=game.stealthMode?new StealthAwareness():null;
    this.navigation=new EnemyNavigation({radius:.34,maxSpeed:2.35,acceleration:5.2,separationRadius:1.6});
    this.combat=new EnemyCombat({id,aimDelay:.58,burstMin:2,burstMax:3,shotInterval:.2,cooldown:1.0,damage:4});
    this.tactics=new EnemyTacticalResponse(id);this.combatRole='INVESTIGATE';this._losBlocker=null;
    this.forward=new THREE.Vector3(0,0,1);
    this._eye=new THREE.Vector3();this._losDirection=new THREE.Vector3();this._losOrigin=new THREE.Vector3();this._losHit=new THREE.Vector3();this._losRay=new THREE.Ray();
    this._toTarget=new THREE.Vector3();this._moveForward=new THREE.Vector3();this._tangent=new THREE.Vector3();this._desired=new THREE.Vector3();
    this._movement={desired:this._desired,strafe:0,distance:0,toTarget:this._toTarget};
    this._losTest=(a,b)=>this.hasLineOfSight(a,b);
    this._combatContext={canFire:false,onFire:(damage)=>{this.animator.fire();game.audio.tone(190,.05,.04,'square');game.damage(damage,this);}};
    for(const mesh of this.rig.hitMeshes){mesh.userData.enemy=this;worldInteractions.registerShootable(mesh,{surface:'character',kind:'character',label:`enemy-${id}-${mesh.userData.part}`});}
    game.scene.add(this.group);
  }
  hasLineOfSight(origin,target){
    const direction=this._losDirection.copy(target).sub(origin);const distance=direction.length();
    if(distance<.001)return true;
    direction.multiplyScalar(1/distance);
    // origin is already eye-height (1.4 m); adding it twice caused unfair see-over-cover shots.
    const ray=this._losRay.set(this._losOrigin.copy(origin),direction);
    const targetDistance=distance;
    let closest=targetDistance-.25;this._losBlocker=null;
    for(const box of collisionBoxes){
      if(!ray.intersectBox(box,this._losHit))continue;
      const hitDistance=ray.origin.distanceTo(this._losHit);
      if(hitDistance<closest){closest=hitDistance;this._losBlocker=box;}
    }
    return this._losBlocker===null;
  }
  onNoise(origin){
    this.awareness?.hear(origin);
    this.perception.forceRemember(origin);
    game.encounter.noteContact(this.id,'heard');
    this.perception.memoryRemaining=Math.max(this.perception.memoryRemaining,3.6);
    if(!this.perception.visible&&this.state!=='ENGAGE'&&this.state!=='REPOSITION'){
      this.state='INVESTIGATE';this.searchTimer=0;
    }
  }
  hit(dmg,part,p){
    if(this.dead)return null;
    const direction=this.group.position.clone().sub(game.camera.position).normalize();
    return game.damageSystem.apply({source:game.player,target:this,amount:dmg,hitPoint:p,bodyPart:part,direction,weaponId:'autotest',applyBodyMultiplier:false});
  }
  receiveDamage(event){
    if(this.dead)return false;
    this.hp=Math.max(0,this.hp-event.amount);this.hitTimer=.24;
    const localDirection=(event.direction?.clone?.()??new THREE.Vector3()).applyQuaternion(this.group.quaternion.clone().invert());
    const side=Math.sign(localDirection.x)||1;
    this.animator.hit(event.bodyPart,side,event.amount>=60?1.2:.7);
    this.perception.forceRemember(game.camera.position);
    this.state='ENGAGE';
    this.awareness?.confirmAttack(game.camera.position);
    game.encounter.noteContact(this.id,'damaged');
    const hitPoint=event.hitPoint??this.group.position.clone().add(new THREE.Vector3(0,1.3,0));
    // Character contact uses a short cloth/armor-colored burst; metal surfaces
    // retain the separate original spark path. Never creates damage by itself.
    game.particles.burst(hitPoint,'hit',event.bodyPart==='head'?14:9);
    if(this.hp<=0){
      this.dead=true;this.state='DEAD';this.vel.set(0,0,0);this.desiredVel.set(0,0,0);
      this.combat.reset();this.animator.die(side);
      game.kills++;game.notice('ELIMINATED');game.updateTargets();
    }
    game.onConfirmedEnemyHit(event,this.id,this.dead);
    return true;
  }
  turnToward(dir,dt){
    if(dir.lengthSq()<.0001)return;
    const target=Math.atan2(dir.x,dir.z);
    let delta=target-this.group.rotation.y;delta=Math.atan2(Math.sin(delta),Math.cos(delta));
    this.group.rotation.y+=delta*(1-Math.exp(-7*dt));
  }
  desiredForState(target,dt){
    const toTarget=this._toTarget.copy(target).sub(this.group.position);toTarget.y=0;
    const distance=toTarget.length();
    const forward=this._moveForward.set(0,0,0);
    if(distance>.001)forward.copy(toTarget).multiplyScalar(1/distance);
    const tangent=this._tangent.set(-forward.z,0,forward.x).multiplyScalar(this.strafeSign);
    const desired=this._desired.set(0,0,0);
    let strafe=0;
    if(this.state==='ENGAGE'){
      if(distance>11)desired.copy(forward).multiplyScalar(2.35).addScaledVector(tangent,.3);
      else {this.state='REPOSITION';this.repositionTimer=.9+(this.id%3)*.18;}
    }
    if(this.state==='REPOSITION'){
      this.repositionTimer=Math.max(0,this.repositionTimer-dt);strafe=this.strafeSign;
      if(distance<4.8)desired.copy(forward).multiplyScalar(-1.45).addScaledVector(tangent,.8);
      else desired.copy(tangent).multiplyScalar(1.35).addScaledVector(forward,(distance-7.5)*.12);
      if(this.repositionTimer<=0)this.strafeSign*=-1;
    } else if(this.state==='INVESTIGATE'){
      desired.copy(forward).multiplyScalar(distance>1.25?1.8:0);
      if(distance<=1.25){this.state='SEARCH';this.searchTimer=2.1;}
    } else if(this.state==='SEARCH'){
      this.searchTimer=Math.max(0,this.searchTimer-dt);
      desired.set(this.strafeSign*.55,0,Math.sin(this.id+this.searchTimer)*.3);
      if(this.searchTimer<=0)this.state='PATROL';
    } else if(this.state==='SUSPICIOUS'){
      desired.set(0,0,0);
    } else if(this.state==='PATROL'){
      const patrolX=this.home.x+Math.sin(performance.now()*.00045+this.id)*2.2;
      desired.x=clamp(patrolX-this.group.position.x,-1,1)*.85;
    }
    this._movement.strafe=strafe;this._movement.distance=distance;return this._movement;
  }
  update(dt){
    if(this.dead){this.animator.update(dt,0,0);return;}
    const eye=this._eye.copy(this.group.position);eye.y+=1.4;
    this.forward.set(0,0,1).applyQuaternion(this.group.quaternion).normalize();
    const perception=this.perception.update(dt,eye,this.forward,game.camera.position,this._losTest);
    const phase=this.awareness?.advance(dt,{
      visible:perception.visible,position:game.camera.position})??null;
    const earnedAlert=phase===null||phase==='ALERTED';
    if(phase!==null){
      if(phase==='ALERTED')this.state=perception.visible?(perception.distance<4.8?'REPOSITION':'ENGAGE'):'INVESTIGATE';
      else if(phase==='SUSPICIOUS')this.state='SUSPICIOUS';
      else if(phase==='INVESTIGATING')this.state='INVESTIGATE';
      else if(phase==='SEARCHING'){this.state='SEARCH';this.searchTimer=2.1;}
      else this.state='PATROL';
    }else if(perception.visible){
      this.state=perception.distance<4.8?'REPOSITION':'ENGAGE';
      this.searchTimer=0;
    }else if(perception.remembered){
      if(this.state!=='SEARCH')this.state='INVESTIGATE';
    }else if(perception.blocked && perception.distance<12){
      if(this.state!=='SEARCH')this.state='SUSPICIOUS';
      this.searchTimer=Math.max(this.searchTimer,1.0);
    }else if(this.state!=='PATROL' && this.state!=='SEARCH'){
      this.state='SEARCH';this.searchTimer=2.1;
    }

    if(perception.visible&&earnedAlert)game.squad.share(this,game.camera.position,game.enemies,game.encounter.activeIds);
    const target=perception.visible&&earnedAlert?game.camera.position:
      (this.awareness?.lastKnown||perception.lastKnownPosition||this.home);
    const movement=this.desiredForState(target,dt);
    this.combatRole=game.encounter.role(this.id,perception.visible&&earnedAlert);
    if(perception.visible&&earnedAlert&&this.combatRole==='FLANK'&&movement.distance>4.8){
      // Supporting guard shifts laterally while a teammate owns the firing lane.
      // Navigation still performs obstacle collision and bounds checks.
      movement.desired.addScaledVector(this._tangent,.45);
    }else if(perception.visible&&earnedAlert&&this.combatRole==='ANCHOR'){
      movement.desired.multiplyScalar(.63);
    }
    if(!perception.visible&&perception.remembered&&perception.blocked)
      this.tactics.steer(this.group.position,target,this._losBlocker,movement.desired);
    else this.tactics.reset();
    const steered=this.navigation.steer(this,movement.desired,game.enemies||[]);
    this.navigation.move(this,steered,dt,collisionBoxes,ENEMY_BOUNDS);

    const face=perception.visible?movement.toTarget:(this.vel.lengthSq()>.01?this.vel:movement.toTarget);
    this.turnToward(face,dt);

    const canFire=game.lifeCycle?.state===PLAYER_LIFE_STATES.ALIVE && earnedAlert && perception.visible && perception.distance>=4.2 && perception.distance<=15 && (this.state==='ENGAGE'||this.state==='REPOSITION') && game.encounter.mayFire(this.id);
    this._combatContext.canFire=canFire;this.combat.update(dt,this._combatContext);

    const speed=this.vel.length();
    let animState='IDLE';
    if(canFire)animState='AIM';
    else if(Math.abs(movement.strafe)>.1)animState=movement.strafe<0?'STRAFE_LEFT':'STRAFE_RIGHT';
    else if(speed>1.55)animState='RUN';
    else if(speed>.12)animState='WALK';
    this.animator.setState(animState);
    this.animator.update(dt,speed,movement.strafe);
  }
}

class Weapon {
  constructor(slot=1){
    this.slot=slot;this.definition=WEAPON_DEFINITIONS[slot];
    this.config=slot===1?CONFIG.weapon:{...CONFIG.weapon,...this.definition,
      spreadStanding:.0011,spreadMoving:.005,spreadCrouch:.00065,
      recoil:{...CONFIG.weapon.recoil,cameraKickVertical:.3,weaponKick:2.3}};
    this.group=new THREE.Group();game.camera.add(this.group);this.group.position.set(.34,-.31,-.65);
    this.base=this.group.position.clone();this._muzzleWorld=new THREE.Vector3();
    this.ammo=this.config.mag;this.reserve=this.config.reserve;this.shots=0;this.hits=0;this.lastHit=null;this.lastShot=null;this.motionState='IDLE';
    this._triggerDown=false;
    this.ballistics=new Ballistics(this.config);this.recoilModel=new RecoilModel(this.config.recoil);
    if(slot===1)this.makeRifle();else this.makePistol();
    this.poseLower=0;this.poseTilt=0;this.motionClock=0;
    this.machine=new WeaponStateMachine({
      roundsPerMinute:this.config.rpm,
      reloadSeconds:this.config.reload,
      equipSeconds:this.config.equip,
      onShot:()=>this.performShot(),
      onReloadComplete:()=>this.finishReload(),
      hasAmmo:()=>this.ammo>0,
      canReload:()=>this.ammo<this.config.mag&&this.reserve>0
    });
  }
  get state(){return this.machine.state;}
  get reloading(){return this.machine.state===WEAPON_STATES.RELOADING;}
  get cool(){return this.machine.cooldownRemaining;}
  get recoil(){return this.recoilModel.weaponKick;}
  part(geo,material,p,r=[0,0,0]){const m=new THREE.Mesh(geo,material);m.position.set(...p);m.rotation.set(...r);m.castShadow=true;this.group.add(m);return m;}
  makeRifle(){
    const metal=mat(0x15191d,.22,.92),poly=mat(0x24282c,.58,.18),rubber=mat(0x111214,.82,.04);
    this.part(new THREE.BoxGeometry(.18,.18,.72),metal,[0,0,-.18]);
    this.part(new THREE.BoxGeometry(.22,.22,.32),metal,[0,-.02,.18]);
    this.part(new THREE.BoxGeometry(.1,.12,.65),poly,[0,-.06,.65]);
    this.part(new THREE.CylinderGeometry(.035,.035,.62,12),metal,[0,.03,-.82],[Math.PI/2,0,0]);
    this.magazineMesh=this.part(new THREE.BoxGeometry(.18,.45,.13),poly,[0,-.25,.12],[-.18,0,0]);
    this.magazineBaseY=this.magazineMesh.position.y;
    this.part(new THREE.BoxGeometry(.12,.28,.12),rubber,[0,-.23,.48],[-.42,0,0]);
    this.part(new THREE.BoxGeometry(.12,.12,.2),metal,[0,.17,-.14]);
    this.muzzle=new THREE.Object3D();this.muzzle.position.set(0,.03,-1.17);this.group.add(this.muzzle);
    this.flash=new THREE.PointLight(0xffb257,0,4,2);this.flash.position.copy(this.muzzle.position);this.group.add(this.flash);
    this.flashMesh=new THREE.Mesh(new THREE.OctahedronGeometry(.11,0),new THREE.MeshBasicMaterial({color:0xffc469,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    this.flashMesh.position.copy(this.muzzle.position);this.group.add(this.flashMesh);
    this.modelDetail=detailRifle(this.part.bind(this),mat);
  }
  makePistol(){
    const steel=mat(0x242930,.27,.8),grip=mat(0x141820,.7,.18),sight=mat(0x090d12,.3,.7);
    this.part(new THREE.BoxGeometry(.18,.14,.49),steel,[0,.025,-.30]);
    this.part(new THREE.BoxGeometry(.16,.17,.24),steel,[0,-.08,-.04]);
    this.part(new THREE.BoxGeometry(.13,.36,.14),grip,[0,-.25,.12],[-.22,0,0]);
    this.magazineMesh=this.part(new THREE.BoxGeometry(.094,.16,.10),steel,[0,-.335,.143],[-.22,0,0]);
    this.magazineBaseY=this.magazineMesh.position.y;
    this.part(new THREE.BoxGeometry(.055,.032,.07),sight,[0,.115,-.44]);
    this.part(new THREE.BoxGeometry(.07,.035,.06),sight,[0,.115,-.07]);
    this.part(new THREE.CylinderGeometry(.024,.024,.45,12),steel,[0,.02,-.47],[Math.PI/2,0,0]);
    this.muzzle=new THREE.Object3D();this.muzzle.position.set(0,.02,-.70);this.group.add(this.muzzle);
    this.flash=new THREE.PointLight(0xffb257,0,4,2);this.flash.position.copy(this.muzzle.position);this.group.add(this.flash);
    this.flashMesh=new THREE.Mesh(new THREE.OctahedronGeometry(.075,0),new THREE.MeshBasicMaterial({
      color:0xffc469,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    this.flashMesh.position.copy(this.muzzle.position);this.group.add(this.flashMesh);
    this.modelDetail=detailPistol(this.part.bind(this),mat);
  }
  setVisible(value){this.group.visible=!!value;}
  stow(){this.resetTransientState('slot-stow');}
  draw(){
    this.resetTransientState('slot-draw');
    this.machine.equipRemaining=this.config.equip;
    this.machine.transition(WEAPON_STATES.EQUIPPING,'slot-equip');
  }
  fire(){return game.missionActive&&game.lifeCycle?.state===PLAYER_LIFE_STATES.ALIVE&&game.player?.canFire()?this.machine.triggerOnce():false;}
  setTrigger(held){
    const down=!!held&&!!game.missionActive&&game.lifeCycle?.state===PLAYER_LIFE_STATES.ALIVE&&!!game.player?.canFire();
    if(this.slot===2){
      if(down&&!this._triggerDown)this.machine.triggerOnce();
      this.machine.setTrigger(false);this._triggerDown=down;return;
    }
    this.machine.setTrigger(down);this._triggerDown=down;
  }
  performShot(){
    if(this.ammo<=0||!game.missionActive||game.lifeCycle?.state!==PLAYER_LIFE_STATES.ALIVE||!game.player?.canFire())return false;
    const shotIndex=this.shots;
    const aimScale=game.combatTraversal.spreadScale(this.motionState,game.player.onGround)*(game.ads?.spreadScale()??1);
    const ballistic=this.ballistics.sample(game.camera,shotIndex,this.motionState,aimScale);
    const muzzleOrigin=this.muzzle.getWorldPosition(this._muzzleWorld);
    this.ammo--;this.shots++;
    this.recoilModel.impulse(shotIndex);
    this.flash.intensity=70;this.flashMesh.material.opacity=1;this.flashMesh.scale.setScalar(.75+((shotIndex*37)%7)/10);
    game.audio.gunshot(this.slot===2?'pistol':'rifle');game.combatTraversal.emitNoise('SHOT',game.camera.position,game.enemies);game.particles.burst(muzzleOrigin,'smoke',7);game.screenShake=Math.max(game.screenShake,.004);
    raycaster.set(game.camera.position,ballistic.direction);raycaster.far=80;
    const hits=raycaster.intersectObjects(shootables,false);
    this.lastShot={index:shotIndex,state:this.motionState,spread:ballistic.spread,spreadOffset:[ballistic.offsetX,ballistic.offsetY],aimDirection:ballistic.direction.toArray(),muzzleOrigin:muzzleOrigin.toArray()};
    this.lastHit={kind:'miss',point:null,bodyPart:null,surface:null,targetId:null};
    if(hits.length){
      const h=hits[0],o=h.object,p=h.point;
      if(o.userData.enemy&&!o.userData.enemy.dead){
        this.hits++;this.lastHit={kind:'enemy',point:p.toArray(),bodyPart:o.userData.part,surface:null,targetId:o.userData.enemy.id};
        const hitNormal=h.face?.normal?h.face.normal.clone().transformDirection(o.matrixWorld):null;
        const bodyPart=o.userData.part||'torso';
        const amount=bodyPart==='head'?this.config.headshot/2.5:this.config.damage;
        game.damageSystem.apply({source:game.player,target:o.userData.enemy,amount,hitPoint:p,hitNormal,bodyPart,
          direction:ballistic.direction,weaponId:this.definition.id});
      }
      else {const s=o.userData.surface||'concrete';this.lastHit={kind:'surface',point:p.toArray(),bodyPart:null,surface:s,targetId:null};game.particles.burst(p,s==='metal'?'spark':s==='glass'?'glass':'dust',s==='metal'?20:12);game.audio.impact(s);}
    }
    game.combatFeel.recordShot(this.lastHit);
    game.refreshCombatFeelHud();
    this.updateHud();
    return true;
  }
  reload(){
    if(!game.missionActive||game.lifeCycle?.state!==PLAYER_LIFE_STATES.ALIVE)return false;
    const accepted=this.machine.requestReload();
    if(accepted){game.notice('RELOADING');game.audio.reload();}
    return accepted;
  }
  finishReload(){
    const need=this.config.mag-this.ammo,take=Math.min(need,this.reserve);
    this.ammo+=take;this.reserve-=take;this.updateHud();
  }
  setAmmo(ammo,reserve=this.reserve){
    this.ammo=clamp(Math.floor(ammo),0,this.config.mag);this.reserve=Math.max(0,Math.floor(reserve));this.machine.syncAmmoState();this.updateHud();
  }
  resetTransientState(reason='reset'){
    this.machine.reset(reason);this.recoilModel.reset();this.motionState='IDLE';this._triggerDown=false;
    this.flash.intensity=0;this.flashMesh.material.opacity=0;this.group.position.copy(this.base);this.group.rotation.set(0,0,0);
    this.poseLower=0;this.poseTilt=0;
    if(this.magazineMesh)this.magazineMesh.position.y=this.magazineBaseY;
    game.playerLook?.setRecoilOffset(0,0);
  }
  update(dt,moving,sprint,motion={}){
    this.motionState=motion.state||this.motionState||(moving?'WALK':'IDLE');
    if(!game.player?.canFire())this.machine.setTrigger(false);
    this.machine.update(dt);
    if(this.magazineMesh){
      const fraction=this.machine.state===WEAPON_STATES.RELOADING?
        THREE.MathUtils.clamp(1-this.machine.reloadRemaining/this.config.reload,0,1):0;
      this.magazineMesh.position.y=this.magazineBaseY-Math.sin(Math.PI*fraction)*.21;
    }
    this.recoilModel.update(dt);
    game.playerLook?.setRecoilOffset(this.recoilModel.cameraOffset.x,this.recoilModel.cameraOffset.y);
    if(motion.landed)this.recoilModel.weaponVelocity+=.22;
    this.motionClock+=Math.max(0,dt);
    const t=this.motionClock,state=this.motionState;
    const travel=state==='VAULT'||state==='MANTLE'||state==='LEDGE_HANG'||state==='SLIDE'||state==='WALL_RUN';
    const bob=game.runtimeGuard.reducedMotion||travel?0:moving?Math.sin(t*(sprint?13:8))*(sprint?.018:.009):Math.sin(t*1.8)*.002;
    const lowerTargets={SPRINT:.075,SLIDE:.12,VAULT:.16,MANTLE:.20,LEDGE_HANG:.21,WALL_RUN:.065};
    const lowerTarget=lowerTargets[state]??0;
    const tiltTarget=state==='SLIDE'?.095:state==='VAULT'?-.15:state==='MANTLE'?-.19:state==='LEDGE_HANG'?.16:0;
    const poseAlpha=1-Math.exp(-13*Math.min(.033,Math.max(0,dt)));
    this.poseLower=THREE.MathUtils.lerp(this.poseLower,lowerTarget,poseAlpha);
    this.poseTilt=THREE.MathUtils.lerp(this.poseTilt,tiltTarget,poseAlpha);
    const weaponKick=this.recoilModel.weaponKick;
    const arc=(state==='VAULT'||state==='MANTLE')?Math.sin(Math.PI*(motion.traversalProgress||0))*.02:0;
    const aim=game.ads?.progress||0;
    const sightHeight=this.modelDetail?.sightHeight??(this.slot===2?.135:.24);
    this.group.position.x=THREE.MathUtils.lerp(this.group.position.x,
      (this.base.x+Math.cos(t*8)*Math.abs(bob)*.45)*(1-aim),poseAlpha);
    this.group.position.y=THREE.MathUtils.lerp(this.group.position.y,
      (this.base.y+bob+arc-weaponKick*.16-this.poseLower)*(1-aim)+(-sightHeight-weaponKick*.16)*aim,poseAlpha);
    this.group.position.z=THREE.MathUtils.lerp(this.group.position.z,
      this.base.z+weaponKick*.22+this.poseLower*.15+aim*.10,poseAlpha);
    if(this.slot===2&&this.modelDetail?.slideMesh)
      this.modelDetail.slideMesh.position.z=this.modelDetail.slideBase+
        Math.min(.055,this.recoilModel.weaponKick*.045);
    this.group.rotation.x=-weaponKick*.7+this.poseTilt;
    const wallLean=state==='WALL_RUN'?(game.player?.parkour?.wallSide==='LEFT'?-.10:.10):0;
    this.group.rotation.z=THREE.MathUtils.lerp(this.group.rotation.z,wallLean,poseAlpha);
    const flashDecay=Math.exp(-32*dt);this.flash.intensity*=flashDecay;this.flashMesh.material.opacity*=Math.exp(-42*dt);
  }
  updateHud(){if(game.weapon===this)$('ammo').textContent=this.ammo+' / '+this.reserve;}
}

class Game {
  constructor(){
    this.runtimeGuard=new RuntimeGuard({reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true});
    document.body.classList.toggle('reduced-motion',this.runtimeGuard.reducedMotion);
    this.assets=new AssetManager();this.audio=new AudioManager();this.damageSystem=new DamageSystem();this.actionQueue=new CombatActionQueue();this.combatTraversal=new TraversalCombatDirector();this.encounter=new EncounterDirector();this.squad=new EnemySquadCoordinator();this.combatFeel=new CombatFeelDirector();this.stealthMode=CONFIG.stealth;this.gadgetsEnabled=CONFIG.gadgets;this.sandboxEnabled=CONFIG.sandbox;this.gadgetInventory=null;this.gadgetMotion=null;this.gadgetResolver=null;this.environmentDirector=null;this.routeTracker=null;this.interactionRay=new THREE.Raycaster();this._interactionHintClock=0;this._lastEncounterNoticedStage=0;this.aiEnabled=true;this.missionActive=false;this.missionStarted=false;this.difficulty=DEFAULT_DIFFICULTY;this._idleMotion={landed:false,state:'IDLE'};this.kills=0;this.startedAt=0;this.screenShake=0;this.lastFps=performance.now();this.frames=0;this.metrics={fps:0,drawCalls:0,triangles:0,geometries:0,textures:0};this.qualityTrace=CONFIG.debug||CONFIG.autotest?new QualityTrace():null;
  }
  async init(){
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.info.autoReset=false;
    this.renderer.debug.checkShaderErrors = new URLSearchParams(location.search).has('debug');
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    document.body.prepend(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost',event=>{
      event.preventDefault();
      if(!this.runtimeGuard.lose())return;
      keys.clear();this.actionQueue.clear();this.player?.resetInputMotion();this.combatTraversal.clear();this.ads?.reset();
      this.weapon?.setTrigger(false);this.gadgetMotion?.cancel('context-lost');
      this.playerLook?.unlock();
      this.notice('GRAPHICS PAUSED / RESTORING',1800);
    });
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>{
      if(!this.runtimeGuard.restore())return;
      this.resize(); // Three.js retains its scene; never rebuild world or actors here.
      this.notice('GRAPHICS RESTORED',1400);
    });
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x071019);this.scene.fog=new THREE.FogExp2(0x071019,.017);
    this.camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,160);this.camera.position.set(0,CONFIG.player.standing,20);this.scene.add(this.camera);
    this.ads=new ADSController(this.camera);
    const hemi=new THREE.HemisphereLight(0x9ccfff,0x1c1510,1.5);this.scene.add(hemi);
    this.moon=new THREE.DirectionalLight(0xbad8ff,2.8);const moon=this.moon;moon.position.set(-12,18,8);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);moon.shadow.camera.left=-30;moon.shadow.camera.right=30;moon.shadow.camera.top=45;moon.shadow.camera.bottom=-45;this.scene.add(moon);
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.48,.45,.88);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
    const loaded=await this.assets.warmup();
    if(loaded.hdr){this.scene.environment=loaded.hdr;$('assetStatus').textContent='HDR loaded. Procedural models remain available as fallback.';}
    else {$('assetStatus').textContent='External assets unavailable. Using procedural PBR fallback world.';}
    $('progressBar').style.width='100%';$('loadingText').textContent='READY';
    this.particles=new ParticleManager(this.scene);this.station=new Station();this.train=new Train();
    this.playerLook=new FirstPersonLook(this.camera,this.renderer.domElement,{pointerSpeed:CONFIG.player.lookSensitivity,maxPitch:CONFIG.player.maxPitch});
    this.player=new PlayerController(this.camera,this.playerLook,{keys,collisionBoxes,config:{...CONFIG.player,worldXMin:CONFIG.world.xMin,worldXMax:CONFIG.world.xMax,worldZMin:CONFIG.world.zMin,worldZMax:CONFIG.world.zMax},onMotion:(dt,moving,sprint,motion)=>{this.combatTraversal.advance(dt);this.weapon?.update(dt,moving,sprint,motion);if(this.missionActive||this.testActive){this.refreshTraversalHint(dt);this.refreshCombatFlowHint();}},onTraversal:event=>this.onTraversalEvent(event)});
    this.meleeResolver=new MeleeResolver({damageSystem:this.damageSystem,shootables});
    this.weapons={
      1:new Weapon(1),
      2:new Weapon(2),
      3:new KnifeWeapon(this.camera,{
        canUse:()=>this.canUseWeapon(),
        resolve:()=>this.meleeResolver.resolve(this.camera,this.player),
        onHit:(result)=>{
          this.audio.melee(result.kind);
          if(result.kind==='blocked')this.audio.impact(result.surface);
        }
      })
    };
    this.inventory=new WeaponInventory(this.weapons);
    this.weapon=this.inventory.active;
    this.weapon.updateHud();this.refreshWeaponHud();
    this.lifeCycle=new PlayerLifeCycle({
      player:this.player,
      onDamage:(event,hp)=>this.onPlayerDamage(event,hp),
      onDying:(event)=>this.onPlayerDying(event),
      onRespawn:()=>this.onPlayerRespawn(),
      onAlive:()=>this.onPlayerAlive()
    });
    this.player.setDamageHandler(event=>this.lifeCycle.receiveDamage(event));
    this.enemies=[];
    const spawn=[[0,10],[-6,-28],[7,-38],[-5,-50],[7,-8]];
    for(let i=0;i<CONFIG.enemyCount;i++)this.enemies.push(new Enemy(i,new THREE.Vector3(spawn[i%spawn.length][0],0,spawn[i%spawn.length][1])));
    if(this.sandboxEnabled){
      this.environmentDirector=new EnvironmentInteractionDirector({registry:worldInteractions,
        playerPosition:()=>this.camera.position,enemies:()=>this.enemies,
        emitNoise:point=>this.combatTraversal.emitNoise('ALARM',point,this.enemies)});
      for(const door of this.station.interactionFixtures.doors)
        this.environmentDirector.addDoor(door.id,door.entry);
      for(const alarm of this.station.interactionFixtures.alarms)
        this.environmentDirector.addAlarm(alarm.id,alarm.mesh);
      this.routeTracker=new RouteTracker();
    }
    if(this.gadgetsEnabled){
      this.gadgetInventory=new GadgetInventory();this.gadgetMotion=new GrappleMotion(this.player);
      this.gadgetResolver=new GadgetResolver({
        world:{shootables,xMin:CONFIG.world.xMin,xMax:CONFIG.world.xMax,zMin:CONFIG.world.zMin,zMax:CONFIG.world.zMax},
        emitNoise:point=>this.combatTraversal.emitNoise('DISTRACTION',point,this.enemies),
        onImpact:(point,surface)=>{this.particles.burst(point,'spark',8);this.audio.impact(surface);}
      });
      this.refreshGadgetHud();
    }
    this.setDifficulty(DEFAULT_DIFFICULTY);
    this.encounter.update(0,this.camera.position,this.enemies,false);
    this.bind();this.updateTargets();this.refreshEncounterHud(true);this.setQuality('HIGH');this.exposeDebug();
    $('reducedMotion').checked=this.runtimeGuard.reducedMotion;
    setTimeout(()=>{$('loading').style.display='none';$('menu').style.display='grid';},350);
    this.animate();
  }
  canUseWeapon(){
    return !!this.missionActive&&!this.runtimeGuard.contextLost&&!this.isVictory&&
      this.lifeCycle?.state===PLAYER_LIFE_STATES.ALIVE&&!!this.player?.canFire();
  }
  selectSlot(slot){
    if(!this.missionActive||!this.lifeCycle||this.lifeCycle.state!==PLAYER_LIFE_STATES.ALIVE||
      this.runtimeGuard.contextLost||!weaponSlotValid(slot))return false;
    if(this.inventory.selectedSlot!==slot){this.ads.reset();this.actionQueue.clear();}
    if(!this.inventory.select(slot))return false;
    this.qualityTrace?.mark('EQUIP',{slot});
    this.weapon=this.inventory.active;this.weapon.updateHud?.();
    this.refreshWeaponHud();return true;
  }
  refreshWeaponHud(){
    const active=this.inventory.active,slot=this.inventory.selectedSlot;
    $('slotHud').textContent='1 RIFLE   /   2 PISTOL   /   3 KNIFE   •   '+slot+' '+WEAPON_DEFINITIONS[slot].label;
    if(slot===3)$('ammo').textContent='MELEE';
    else active.updateHud();
  }
  advanceADS(dt){
    this.ads.step(dt,{
      slot:this.inventory.selectedSlot,weaponState:this.weapon.state,
      playerState:this.player.state,traversalState:this.player.parkour.state,
      mission:this.missionActive,alive:this.lifeCycle?.state===PLAYER_LIFE_STATES.ALIVE,
      contextLost:this.runtimeGuard.contextLost,locked:this.playerLook.isLocked,
      fallback:this.playerLook.fallbackActive,testActive:!!this.testActive
    });
    $('crosshair').style.opacity=String(.85*(1-this.ads.progress));
    $('adsReadout').textContent=this.ads.aiming?'AIM / '+WEAPON_DEFINITIONS[this.inventory.selectedSlot].label:'';
    $('adsReadout').style.opacity=this.ads.aiming?'1':'0';
  }
  refreshGadgetHud(){
    const el=$('gadgetHud');if(!el)return;
    if(!this.gadgetInventory){el.style.display='none';return;}
    const s=this.gadgetInventory.snapshot(),slot=s.selectedSlot,def=GADGET_DEFINITIONS[slot];
    el.style.display='block';el.textContent='G '+def.label+'  '+s.charges[slot]+' CHARGES  /  '+
      (s.cooldowns[slot]>0?s.cooldowns[slot].toFixed(1)+'s':'READY')+'  ·  TAB SWITCH';
  }
  useGadget(){
    if(!this.gadgetInventory||!this.missionActive||this.isVictory||this.runtimeGuard.contextLost||
      this.lifeCycle?.state!==PLAYER_LIFE_STATES.ALIVE||this.gadgetMotion?.active||
      !(this.playerLook.isLocked||this.playerLook.fallbackActive||this.testActive))return false;
    const result=this.gadgetInventory.use(def=>{
      if(def.id===1)return this.gadgetResolver.throwDistraction(this.camera,{range:def.range});
      const grapple=this.gadgetResolver.findAnchor(this.camera,{range:def.range});
      if(!grapple.ok)return grapple;
      return this.gadgetMotion.start(grapple.target)?grapple:{ok:false,reason:'blocked'};
    });
    if(result.ok){this.audio.tone(440,.055,.03,'triangle');this.qualityTrace?.mark('GADGET',{slot:result.slot,kind:result.kind});}
    this.refreshGadgetHud();return result.ok;
  }
  focusedInteraction(){
    if(!this.environmentDirector||!this.camera)return null;
    this.camera.updateMatrixWorld(true);
    this.interactionRay.set(this.camera.position,this.camera.getWorldDirection(new THREE.Vector3()).normalize());
    this.interactionRay.near=0;this.interactionRay.far=3.35;
    const nearest=this.interactionRay.intersectObjects(shootables,false)[0];
    const id=nearest?.object?.userData?.interactionId;
    return id&&this.environmentDirector.items.has(id)?id:null;
  }
  interactEnvironment(){
    if(!this.environmentDirector||!this.missionActive||this.runtimeGuard.contextLost||this.isVictory||
      this.lifeCycle?.state!==PLAYER_LIFE_STATES.ALIVE||
      !(this.playerLook.isLocked||this.playerLook.fallbackActive||this.testActive))return false;
    const id=this.focusedInteraction();if(!id)return false;
    const result=this.environmentDirector.activate(id);
    if(result.ok){
      if(id==='station-alarm'){
        const alarm=this.environmentDirector.items.get(id).mesh;
        alarm.material.emissive.setHex(result.on?0xff2939:0x411018);
      }
      this.notice(result.kind==='door'?(result.open?'ACCESS OPEN':'ACCESS SEALED'):
        (result.on?'STATION ALARM ACTIVE':'STATION ALARM DISABLED'),1100);
    }else if(result.reason==='occupied')this.notice('DOORWAY OCCUPIED',900);
    this.refreshInteractionHint(true);return result.ok;
  }
  refreshInteractionHint(force=false,dt=0){
    if(!this.environmentDirector)return;
    this._interactionHintClock+=dt;
    if(!force&&this._interactionHintClock<.17)return;
    this._interactionHintClock=0;
    const id=this.missionActive?this.focusedInteraction():null;
    const node=$('interactionHint');node.textContent=id?'E  /  '+(id==='station-alarm'?'TOGGLE STATION ALARM':'OPEN / CLOSE SHUTTER'):'';
    node.style.opacity=id?'1':'0';
  }
  bind(){
    addEventListener('keydown',e=>{
      const playing=this.missionActive&&(this.playerLook.isLocked||this.playerLook.fallbackActive);
      if(shouldSuppressBrowserShortcut(e,playing))e.preventDefault();
      // Browser shortcuts are blocked, but movement modifiers must still reach the motor.
      const movementChord=new Set(['ControlLeft','ControlRight','ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD','Space']);
      if(playing&&(e.altKey||e.metaKey||(e.ctrlKey&&!movementChord.has(e.code))))return;
      this.qualityTrace?.input(e,true);
      keys.add(e.code);
      if(e.code==='Space'){e.preventDefault();this.player.jump();}
      if(e.code==='KeyR'&&!e.repeat)this.weapon.reload();
      if(e.code==='KeyQ')this.ads.setHold('q',true);
      if(playing&&!e.repeat&&e.code==='Tab'&&this.gadgetInventory){e.preventDefault();this.gadgetInventory.cycle();this.refreshGadgetHud();}
      if(playing&&!e.repeat&&e.code==='KeyG')this.useGadget();
      if(playing&&!e.repeat&&e.code==='KeyE')this.interactEnvironment();
      if(['Digit1','Digit2','Digit3'].includes(e.code)&&!e.repeat)this.selectSlot(Number(e.code.slice(-1)));
      if(e.code==='Escape'&&this.playerLook.fallbackActive)this.playerLook.unlock();
    });
    addEventListener('keyup',e=>{const playing=this.missionActive&&(this.playerLook.isLocked||this.playerLook.fallbackActive);if(shouldSuppressBrowserShortcut(e,playing))e.preventDefault();this.qualityTrace?.input(e,false);keys.delete(e.code);if(e.code==='KeyQ')this.ads.setHold('q',false);});
    const resetInput=()=>{keys.clear();this.actionQueue.clear();this.player.resetInputMotion();this.combatTraversal.clear();this.refreshCombatFlowHint();this.weapon.setTrigger(false);this.ads.reset();this.gadgetMotion?.cancel('input-reset');};
    addEventListener('blur',resetInput);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInput();});
    addEventListener('mousedown',e=>{if(e.target.closest?.('#autotestPanel'))return;
      this.qualityTrace?.input(e,true);
      if(e.button===0&&(this.playerLook.isLocked||this.playerLook.fallbackActive||this.testActive)){
        if(!this.player.canFire()&&this.actionQueue.arm({slot:this.inventory.selectedSlot,
          state:this.player.state,mission:this.missionActive,
          alive:this.lifeCycle?.state===PLAYER_LIFE_STATES.ALIVE,
          contextLost:this.runtimeGuard.contextLost,weaponState:this.weapon.state}))
          this.qualityTrace?.mark('ACTION_BUFFERED',{slot:this.inventory.selectedSlot});
        this.weapon.setTrigger(true);
      }
      if(e.button===2&&this.playerLook.isLocked)this.ads.setHold('rmb',true);
    });
    addEventListener('mouseup',e=>{this.qualityTrace?.input(e,false);if(e.button===0)this.weapon.setTrigger(false);if(e.button===2)this.ads.setHold('rmb',false);});
    $('startBtn').onclick=()=>{this.audio.unlock();this.startedAt=performance.now();this.missionStarted=true;$('difficulty').disabled=true;this.missionActive=true;this.testActive=CONFIG.autotest;if(!CONFIG.autotest)this.playerLook.lock();$('menu').style.display='none';$('hud').style.display='block';this.notice('MISSION 01 — SECURE THE STATION',1800);};
    this.playerLook.addEventListener('lock',()=>{this.missionStarted=true;$('difficulty').disabled=true;this.missionActive=true;this.testActive=false;$('menu').style.display='none';$('hud').style.display='block';this.notice('MOUSE LOOK ACTIVE',700);});
    this.playerLook.addEventListener('unlock',()=>{resetInput();this.missionActive=false;if(!this.isVictory&&!CONFIG.autotest){$('menu').style.display='grid';$('hud').style.display='none';}});
    this.playerLook.addEventListener('fallback',()=>{this.missionStarted=true;$('difficulty').disabled=true;this.missionActive=true;this.notice('POINTER LOCK UNAVAILABLE — HOLD RMB + DRAG TO LOOK',2600);$('menu').style.display='none';$('hud').style.display='block';});
    $('restartBtn').onclick=()=>location.reload();
    $('quality').onchange=e=>this.setQuality(e.target.value);
    $('difficulty').onchange=e=>this.setDifficulty(e.target.value);
    $('reducedMotion').onchange=e=>this.setReducedMotion(e.target.checked);
    if(CONFIG.autotest){$('autotestPanel').style.display='flex';$('testLookLeft').onclick=()=>this.playerLook.applyLookDelta(-120,0);$('testLookRight').onclick=()=>this.playerLook.applyLookDelta(120,0);$('testLookUp').onclick=()=>this.playerLook.applyLookDelta(0,-80);$('testLookDown').onclick=()=>this.playerLook.applyLookDelta(0,80);$('testFire').onclick=()=>this.weapon.fire();$('testReload').onclick=()=>this.weapon.reload();$('testDamage').onclick=()=>this.damage(5);$('testComplete').onclick=()=>{for(const e of this.enemies.filter(x=>!x.dead))e.hit(999,'body',e.group.position.clone().add(new THREE.Vector3(0,1,0)));};}
    addEventListener('resize',()=>this.resize());
  }
  exposeDebug(){
    if(!(CONFIG.autotest||CONFIG.debug))return;
    const snapshot=()=>this.getDebugSnapshot();
    window.__FPS_DEBUG__={snapshot};
    window.__FPS_TEST__={
      start:()=>$('startBtn').click(),
      look:(x=0,y=0)=>this.playerLook.applyLookDelta(x,y),
      aimAt:(x=0,y=1.5,z=0)=>{this.camera.lookAt(x,y,z);this.playerLook.syncFromCamera();this.camera.updateMatrixWorld(true);},
      setInput:(code,down=true)=>{if(down)keys.add(code);else keys.delete(code);},
      teleport:(x=0,z=20,y=0)=>{this.combatTraversal.clear();this.player.parkour.reset('test-teleport');this.camera.position.x=x;this.camera.position.z=z;this.player.feetY=y;this.player.verticalOffset=y;this.player.onGround=!!this.player.parkour.sensor.support(x,z,y);this.player.horizontalVelocity.set(0,0,0);this.player.velocity.set(0,0,0);this.camera.position.y=y+this.player.eyeHeight;},
      jump:()=>this.player.jump(),
      step:(dt=0.0166667)=>this.player.update(Math.min(0.033,Math.max(0,dt))),
      fire:()=>this.weapon.fire(),
      setTrigger:(held=true)=>this.weapon.setTrigger(held),
      weaponStep:(dt=.0166667)=>{const step=Math.min(.033,Math.max(0,dt));this.advanceADS(step);this.weapon.update(step,0,false);},
      setAmmo:(ammo,reserve)=>this.weapon.setAmmo(ammo,reserve),
      reload:()=>this.weapon.reload(),
      damage:(amount=5)=>this.damage(amount),
      lifeStep:(dt=.1)=>this.lifeCycle?.update(Math.max(0,dt)),
      trainStep:(dt=.0166667)=>{this.train?.update(Math.max(0,dt));this.enforceTrainSafety();},
      setQuality:(quality='HIGH')=>this.setQuality(quality),
      setDifficulty:(id)=>this.setDifficulty(id),
      setReducedMotion:(enabled=true)=>this.setReducedMotion(enabled),
      selectSlot:(slot)=>this.selectSlot(slot),
      setAimHeld:(down=true,source='q')=>this.ads.setHold(source,down),
      adsStep:(dt=.0166667)=>this.advanceADS(Math.min(.033,Math.max(0,dt))),
      setAIEnabled:(enabled=true)=>{this.aiEnabled=!!enabled;},
      enemyStep:(dt=.0166667,steps=1)=>{for(let i=0;i<steps;i++)this.updateEnemies(Math.min(.033,Math.max(0,dt)),true);},
      probeEnemyLOS:(id=0)=>{const e=this.enemies[id];if(!e)return null;const eye=e.group.position.clone().add(new THREE.Vector3(0,1.4,0));return e.hasLineOfSight(eye,this.camera.position);},
      hitEnemy:(id=0,damage=10,part='torso')=>{const e=this.enemies[id];if(e&&!e.dead)e.hit(damage,part,e.group.position.clone().add(new THREE.Vector3(0,1.4,0)));},
      setEnemyPosition:(id=0,x=0,z=0)=>{const e=this.enemies[id];if(e){e.group.position.set(x,0,z);e.vel.set(0,0,0);e.group.updateMatrixWorld(true);}},
      setEnemyYaw:(id=0,yaw=0)=>{const e=this.enemies[id];if(e){e.group.rotation.y=yaw;e.group.updateMatrixWorld(true);}},
      complete:()=>{for(const e of this.enemies.filter(x=>!x.dead))e.hit(999,'torso',e.group.position.clone().add(new THREE.Vector3(0,1,0)));},
      parkourProbe:()=>this.player.parkour.snapshot(),
      encounterStep:(dt=.016)=>this.updateEnemies(Math.min(.033,Math.max(0,dt)),true),
      feedbackStep:(dt=.016)=>{const step=Math.min(.033,Math.max(0,dt));this.combatFeel.advance(step,{stage:this.encounter.stage,engaged:this.lifeCycle.state===PLAYER_LIFE_STATES.ALIVE?this.encounter.engaged:0});this.refreshCombatFeelHud();},
      emitNoise:(kind='SLIDE',x=0,z=0)=>this.combatTraversal.emitNoise(kind,new THREE.Vector3(x,0,z),this.enemies),
      useGadget:()=>this.useGadget(),
      cycleGadget:()=>{if(!this.gadgetInventory)return false;const ok=this.gadgetInventory.cycle();this.refreshGadgetHud();return ok;},
      gadgetStep:(dt=.016)=>{const step=Math.min(.033,Math.max(0,dt));this.gadgetInventory?.step(step);const result=this.gadgetMotion?.step(step)??null;this.refreshGadgetHud();return result;},
      gadgetAimAt:(id=0)=>{const a=this.station?.grappleAnchorPositions?.[id];if(!a)return false;this.camera.lookAt(a.x,a.y,a.z);this.playerLook.syncFromCamera();this.camera.updateMatrixWorld(true);return true;},
      interactEnvironment:()=>this.interactEnvironment(),
      focusedInteraction:()=>this.focusedInteraction(),
      environmentStep:(dt=.016)=>this.environmentDirector?.step(Math.min(.033,Math.max(0,dt)))??0,
      routeStep:(x,z,y=0,parkour='IDLE')=>this.routeTracker?.update({x,z,feetY:y,parkour})??null,
      qualityTrace:()=>this.qualityTrace?.snapshot()??null,
      snapshot
    };
  }
  getDebugSnapshot(){
    const look=this.playerLook;
    const p=this.camera?.position;
    return {
      camera:{yaw:look?.yaw??0,pitch:look?.pitch??0,recoilYaw:look?.recoilYaw??0,recoilPitch:look?.recoilPitch??0,traversalRoll:look?.traversalRoll??0,traversalPitch:look?.traversalPitch??0,mode:look?.isLocked?'LOCKED':look?.fallbackActive?'RMB_DRAG':'IDLE'},
      parkour:this.player?.parkour?.snapshot()??null,
      presentation:this.player?.presentation.snapshot()??null,
      cadence:this.player?.cadence.snapshot()??null,
      traversalEvent:this.lastTraversalEvent??null,
      combatTraversal:this.combatTraversal.snapshot(),
      encounter:this.encounter.snapshot(),
      difficulty:{id:this.difficulty,...DIFFICULTY_PROFILES[this.difficulty],locked:this.missionStarted},
      squad:this.squad.snapshot(),
      combatFeel:this.combatFeel.snapshot(),
      inventory:this.inventory.snapshot(),
      ads:this.ads.snapshot(),
      actionQueue:this.actionQueue.snapshot(),
      runtime:this.runtimeGuard.snapshot(),
      player:{state:this.player?.state??'BOOT',lifeState:this.lifeCycle?.state??'BOOT',position:p?p.toArray():[0,0,0],velocity:this.player?.velocity?.toArray?.()??[0,0,0],grounded:!!this.player?.onGround,crouched:!!this.player?.crouch,hp:this.player?.hp??0,deaths:this.lifeCycle?.deaths??0,lastDamage:this.lifeCycle?.lastDamageEvent?{id:this.lifeCycle.lastDamageEvent.id,amount:this.lifeCycle.lastDamageEvent.amount,bodyPart:this.lifeCycle.lastDamageEvent.bodyPart,weaponId:this.lifeCycle.lastDamageEvent.weaponId}:null},
      weapon:{state:this.weapon?.state??'BOOT',ammo:this.weapon?.ammo??0,reserve:this.weapon?.reserve??0,shots:this.weapon?.shots??0,hits:this.weapon?.hits??0,recoil:this.weapon?.recoil??0,lastShot:this.weapon?.lastShot??null,lastHit:this.weapon?.lastHit??null,motionState:this.weapon?.motionState??'IDLE',poseLower:this.weapon?.poseLower??0,poseTilt:this.weapon?.poseTilt??0,triggerHeld:!!this.weapon?.machine?.triggerHeld,viewmodelPosition:this.weapon?.group?.position?.toArray?.()??null,sightHeight:this.weapon?.modelDetail?.sightHeight??null,magazineOffset:this.weapon?.magazineMesh?(this.weapon.magazineBaseY-this.weapon.magazineMesh.position.y):0,knifeSwing:this.weapon?.swing??0,cooldown:this.weapon?.machine?.cooldownRemaining??0,reloadRemaining:this.weapon?.machine?.reloadRemaining??0,transitions:[...(this.weapon?.machine?.transitions||[])]},
      enemies:(this.enemies||[]).map(e=>({id:e.id,state:e.state,combatRole:e.combatRole,animation:e.animator?.state??'NONE',hp:e.hp,dead:e.dead,position:e.group.position.toArray(),velocity:e.vel?.toArray?.()??[0,0,0],yaw:e.group.rotation.y,rigParts:e.rig?.partNames?.length??0,deathProgress:e.animator?.deathProgress??0,rootRotation:[e.group.rotation.x,e.group.rotation.y,e.group.rotation.z],torsoX:e.rig?.nodes?.torso?.rotation.x??0,hitTimer:e.animator?.hitTimer??0,hitStrength:e.animator?.hitStrength??0,hitSide:e.animator?.hitSide??0,torsoZ:e.rig?.nodes?.torso?.rotation.z??0,headZ:e.rig?.nodes?.head?.rotation.z??0,fireTimer:e.animator?.fireTimer??0,tactics:e.tactics.snapshot(),perception:{visible:!!e.perception?.visible,remembered:!!e.perception?.hasLastKnown,memory:e.perception?.memoryRemaining??0,blocked:!!e.perception?.blocked,distance:e.perception?.distance??null,lastKnown:e.perception?.hasLastKnown?e.perception.lastKnownPosition.toArray():null},awareness:e.awareness?.snapshot()??null,combat:{phase:e.combat?.phase??'NONE',shotsFired:e.combat?.shotsFired??0,aim:e.combat?.aimRemaining??0,burst:e.combat?.burstRemaining??0,cooldown:e.combat?.cooldownRemaining??0}})),
      stealth:{enabled:this.stealthMode,alerted:this.enemies?.filter(e=>e.awareness?.phase==='ALERTED').length??0},
      gadgets:{enabled:this.gadgetsEnabled,inventory:this.gadgetInventory?.snapshot()??null,motion:this.gadgetMotion?.snapshot()??null},
      sandbox:{enabled:this.sandboxEnabled,interactions:this.environmentDirector?.snapshot()??null,routes:this.routeTracker?.snapshot()??null},
      mission:{kills:this.kills,targetsRemaining:(this.enemies||[]).filter(e=>!e.dead).length,victory:!!this.isVictory,active:!!this.missionActive,trainPhase:this.train?.phase??0},
      performance:{...this.metrics,quality:this.quality??'HIGH',pixelRatio:this.renderer?.getPixelRatio?.()??1,shadowEnabled:!!this.renderer?.shadowMap?.enabled,shadowMapSize:this.moon?.shadow?.mapSize?.x??0,bloomEnabled:!!this.bloom?.enabled,particleLimit:this.particles?.activeLimit??0},
      damage:{recent:[...this.damageSystem.recent]},
      environment:{...worldInteractions.snapshot(),train:{phase:this.train?.phase??0,collisionMode:this.train?.collisionMode??'none',laneMinX:CONFIG.world.trainLaneMinX,playerSafe:(p?.x??0)<CONFIG.world.trainLaneMinX}},
      testControl:{aiEnabled:this.aiEnabled},
      audio:this.audio.snapshot(),
      fx:{...this.particles.snapshot(),muzzleLight:this.weapon?.flash?.intensity??0,muzzleOpacity:this.weapon?.flashMesh?.material?.opacity??0}
    };
  }
  onTraversalEvent(event){
    this.qualityTrace?.mark('TRAVERSAL',{to:event?.to??null,reason:event?.reason??null});
    if(this.lifeCycle?.state===PLAYER_LIFE_STATES.ALIVE||!this.lifeCycle)this.encounter.noteTraversal(event);
    if(this.lifeCycle?.state===PLAYER_LIFE_STATES.ALIVE||!this.lifeCycle)
      this.combatTraversal.onTransition(event,this.camera.position,this.enemies);
    else this.combatTraversal.clear();
    const kind=event.to||({ 'wall-kick':'WALL_KICK', 'ledge-drop':'DROP' }[event.reason]??null);
    if(!kind)return;
    this.player?.presentation?.onEvent(kind);
    this.audio.traversal(kind);
    if(kind==='SLIDE'&&this.particles){
      const dustPoint=new THREE.Vector3(this.camera.position.x,(this.player?.feetY??0)+.12,this.camera.position.z);
      this.particles.burst(dustPoint,'dust',8);
    }
    this.lastTraversalEvent={...event,kind};
  }
  refreshTraversalHint(dt){
    this._traversalHintClock=(this._traversalHintClock||0)+dt;
    if(this._traversalHintClock<.11)return;
    this._traversalHintClock=0;
    const traversal=this.player?.parkour,s=traversal?.state;
    const label=s==='WALL_RUN'?'WALL RUN  //  SPACE TO KICK':
      s==='LEDGE_HANG'?'LEDGE  //  W OR SPACE: CLIMB    CTRL: DROP':
      s==='SLIDE'?'SLIDE  //  SPACE TO JUMP':
      s==='MANTLE'||s==='VAULT'?s+'  //  CLEARING':
      this.player?.onGround?(()=>{
        const probe=traversal.snapshot();
        return probe.canVault?'SPRINT + SPACE  //  VAULT':
          probe.canMantle?'SPRINT + SPACE  //  MANTLE':'';
      })():'';
    if(label===this._lastTraversalHint)return;
    this._lastTraversalHint=label;
    $('traversalHint').textContent=label;
    $('traversalHint').style.opacity=label?'1':'0';
  }

  refreshCombatFlowHint(){
    const node=$('combatFlow'),seconds=this.combatTraversal.flowRemaining;
    const active=seconds>.005;
    const breakTime=this.encounter.breakRemaining;
    node.textContent=(active?'FLOW / STABILIZED AIM  '+seconds.toFixed(1)+'s':'')+
      (breakTime>.005?(active?'   |   ':'')+'BREAK CONTACT  '+breakTime.toFixed(1)+'s':'');
    node.style.opacity=active||breakTime>.005?'1':'0';
  }

  damage(v,source=null){
    if(this.isVictory||this.lifeCycle?.state!==PLAYER_LIFE_STATES.ALIVE)return null;
    const direction=source?.group?.position?this.camera.position.clone().sub(source.group.position).normalize():new THREE.Vector3();
    return this.damageSystem.apply({source,target:this.player,amount:v,hitPoint:this.camera.position,direction,bodyPart:'torso',weaponId:source?'enemy-rifle':'world',applyBodyMultiplier:false});
  }
  onPlayerDamage(event,hp){
    this.combatFeel.recordPlayerDamage(event,this.camera.position,this.playerLook.yaw);
    this.audio.confirmation('HURT');this.refreshCombatFeelHud();
    this.combatTraversal.clear();this.encounter.interruptBreak();this.refreshCombatFlowHint();this.player.cancelTraversal('damage');
    $('health').textContent='HP '+Math.ceil(hp);$('damageVignette').style.boxShadow='inset 0 0 130px 38px rgba(255,30,45,.42)';
    setTimeout(()=>$('damageVignette').style.boxShadow='inset 0 0 120px 35px rgba(255,30,45,0)',110);
  }
  onPlayerDying(){
    this.combatFeel.clearTransient();this.refreshCombatFeelHud();this.ads.reset();this.actionQueue.clear();
    this.combatTraversal.clear();this.encounter.interruptBreak();this.encounter.respite(2);keys.clear();this.player.resetInputMotion();this.player.cancelTraversal('death');this.player.state='DEAD';this.weapon.setTrigger(false);this.inventory.reset('player-dying');this.gadgetMotion?.cancel('player-dying');this.notice('DOWN');
  }
  onPlayerRespawn(){
    this.combatFeel.clearTransient();this.refreshCombatFeelHud();
    this.combatTraversal.clear();this.encounter.interruptBreak();this.refreshCombatFlowHint();this.encounter.respite(1.5);this.squad.reset();
    for(const enemy of this.enemies||[]){
      enemy.perception.hasLastKnown=false;enemy.perception.memoryRemaining=0;
      enemy.awareness?.reset();
      enemy.tactics.reset();enemy.combat.reset();
    }
    this.actionQueue.clear();keys.clear();this.player.resetForRespawn(new THREE.Vector3(0,CONFIG.player.standing,20));this.environmentDirector?.reset();this.routeTracker?.reset();
    const alarm=this.environmentDirector?.items.get('station-alarm')?.mesh;
    if(alarm)alarm.material.emissive.setHex(0x411018);this.inventory.reset('player-respawn');this.gadgetMotion?.cancel('player-respawn');this.gadgetInventory?.reset();this.refreshGadgetHud();this.ads.reset();this.screenShake=0;
  }
  onPlayerAlive(){
    $('health').textContent='HP 100';this.player.state='IDLE';this.notice('RESPAWNED');
  }
  updateEnemies(dt,force=false){
    if(!force&&(!this.aiEnabled||!this.missionActive))return;
    const previousCritical=this.encounter.lowHealth;
    this.encounter.update(dt,this.camera.position,this.enemies,true,this.player.hp);
    if(previousCritical!==this.encounter.lowHealth)this.refreshEncounterHud(true);
    this.squad.advance(dt);
    if(this.encounter.stage!==this._lastEncounterNoticedStage){
      this._lastEncounterNoticedStage=this.encounter.stage;
      const sector=this.encounter.sectors[this.encounter.stage];
      if(this.missionActive)this.notice('SECTOR '+(this.encounter.stage+1)+' / '+this.encounter.sectors.length+'   '+sector.label,1400);
      this.refreshEncounterHud(true);
    }
    for(const enemy of this.enemies||[]){
      if(enemy.dead||this.encounter.isActive(enemy.id))enemy.update(dt);
      else enemy.animator.update(dt,0,0);
    }
    this.refreshEncounterHud(false,dt);
  }
  refreshEncounterHud(force=false,dt=0){
    this._encounterHudClock=(this._encounterHudClock||0)+dt;
    if(!force&&this._encounterHudClock<.12)return;
    this._encounterHudClock=0;
    const state=this.encounter,sector=state.sectors[state.stage],n=state.sectors.length;
    const label='SECTOR '+(state.stage+1)+' / '+n+'    '+sector.label;
    const alert=this.stealthMode?this.enemies.filter(e=>!e.dead&&e.awareness?.phase==='ALERTED').length:0;
    $('encounterHud').textContent=label+'\n'+sector.route+
      '\nVISIBLE '+state.threatCount+'  /  LANES '+state.engaged+' / '+state.pressureSlots+
      '  /  PARKOUR '+state.routeUses[state.stage]+(state.lowHealth?'  /  RECOVER':'')+
      (this.stealthMode?'\nSTEALTH  /  ALERTED '+alert+' / '+this.enemies.filter(e=>!e.dead).length:'');
  }
  enforceTrainSafety(){
    if(!this.player||!this.train)return;
    if(this.camera.position.x>=CONFIG.world.trainLaneMinX){
      this.camera.position.x=CONFIG.world.xMax;this.player.horizontalVelocity.x=0;this.player.velocity.x=0;
    }
  }
  onConfirmedEnemyHit(event,targetId,eliminated){
    this.qualityTrace?.mark('HIT',{targetId,eliminated:!!eliminated,amount:event?.amount??0});
    if(!this.combatFeel.recordEnemyHit(event,{id:targetId,eliminated}))return;
    this.audio.confirmation(eliminated?'KILL':event.bodyPart==='head'?'HEAD':'HIT');
    this.refreshCombatFeelHud();
  }
  refreshCombatFeelHud(){
    const state=this.combatFeel.snapshot();
    const h=$('hitmarker'),label=$('hitFeedback'),incoming=$('incomingCue');
    h.style.opacity=state.hitTime>0?'1':'0';
    h.style.filter=state.hitKind==='HEAD'||state.hitKind==='KILL'?
      'drop-shadow(0 0 5px #ff4655)':'none';
    label.textContent=state.hitText||(state.impactTime>0?state.impactText:'');
    label.style.opacity=state.hitTime>0||state.impactTime>0?'1':'0';
    incoming.textContent=state.hurtTime>0?'INCOMING / '+state.hurtDirection:'';
    incoming.style.opacity=state.hurtTime>0?'1':'0';
  }
  notice(t,ms=950){const n=$('notice');n.textContent=t;n.style.opacity='1';clearTimeout(this.noticeTimer);this.noticeTimer=setTimeout(()=>n.style.opacity='0',ms);}
  updateTargets(){
    const remain=this.enemies?this.enemies.filter(e=>!e.dead).length:CONFIG.enemyCount;$('targets').textContent='TARGETS '+remain;
    if(this.enemies&&remain===0&&!this.isVictory){this.isVictory=true;this.missionActive=false;setTimeout(()=>this.victory(),700);}
  }
  victory(){
    this.ads.reset();this.actionQueue.clear();if(this.playerLook.isLocked)this.playerLook.unlock();this.testActive=false;
    const sec=Math.max(1,(performance.now()-this.startedAt)/1000);
    const firearmShots=this.weapons[1].shots+this.weapons[2].shots;
    const firearmHits=this.weapons[1].hits+this.weapons[2].hits;
    const acc=firearmShots?Math.round(firearmHits/firearmShots*100):0;
    $('results').textContent='KILLS '+this.kills+' · ACCURACY '+acc+'% · TIME '+Math.floor(sec/60)+':'+String(Math.floor(sec%60)).padStart(2,'0')+' · '+this.difficulty;
    $('menu').style.display='none';$('hud').style.display='none';$('victory').style.display='grid';
  }
  setDifficulty(id){
    if(this.missionStarted||!validDifficulty(id))return false;
    const profile=applyDifficulty(this.enemies||[],id);
    this.difficulty=profile.id;
    $('difficulty').value=profile.id;
    $('difficultyHelp').textContent=profile.description;
    return true;
  }
  setReducedMotion(enabled){
    this.runtimeGuard.setReducedMotion(enabled);
    document.body.classList.toggle('reduced-motion',this.runtimeGuard.reducedMotion);
    $('reducedMotion').checked=this.runtimeGuard.reducedMotion;
    if(this.runtimeGuard.reducedMotion)this.screenShake=0;
    return this.runtimeGuard.reducedMotion;
  }
  setQuality(q){
    const quality=QUALITY_PRESETS[q]?q:'HIGH';const cfg=QUALITY_PRESETS[quality];this.quality=quality;
    this.bloom.enabled=cfg.bloom;this.bloom.strength=cfg.bloomStrength;
    this.renderer.shadowMap.enabled=cfg.shadows;this.moon.castShadow=cfg.shadows;
    const shadowSizeChanged=this.moon.shadow.mapSize.x!==cfg.shadowMap;
    if(shadowSizeChanged||(!cfg.shadows&&this.moon.shadow.map)){
      this.moon.shadow.map?.dispose?.();this.moon.shadow.map=null;this.moon.shadow.mapSize.set(cfg.shadowMap,cfg.shadowMap);
    }
    this.renderer.shadowMap.needsUpdate=true;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,cfg.pixelRatio));
    this.particles?.setActiveLimit(cfg.particles);
    this.resize();
  }
  resize(){
    this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.composer.setSize(innerWidth,innerHeight);
  }
  animate=()=>{
    requestAnimationFrame(this.animate);const nowFrame=performance.now();const dt=Math.min(.033,(nowFrame-lastFrame)/1000);lastFrame=nowFrame;
    if(this.runtimeGuard.contextLost)return; // Pause the world without recreating it or advancing lost GPU resources.
    this.lifeCycle?.update(dt);
    this.gadgetInventory?.step(dt);
    if((this.playerLook?.isLocked||this.playerLook?.fallbackActive||this.testActive)&&!this.isVictory&&this.lifeCycle?.state===PLAYER_LIFE_STATES.ALIVE){
      if(this.gadgetMotion?.active){this.gadgetMotion.step(dt);this._idleMotion.state='AIRBORNE';this.weapon?.update(dt,0,false,this._idleMotion);}
      else this.player.update(dt);
    }else{this._idleMotion.state=this.player?.state??'IDLE';this.weapon?.update(dt,0,false,this._idleMotion);}
    if(this.gadgetInventory?.cooldowns[this.gadgetInventory.selectedSlot]>0)this.refreshGadgetHud();
    if(this.environmentDirector){
      this.environmentDirector.step(dt);
      if(this.missionActive)this.routeTracker.update({x:this.camera.position.x,z:this.camera.position.z,
        feetY:this.player.feetY,parkour:this.player.parkour.state});
      this.refreshInteractionHint(false,dt);
    }
    const buffered=this.actionQueue.advance(dt,{slot:this.inventory.selectedSlot,
      valid:this.missionActive&&!this.isVictory&&!this.runtimeGuard.contextLost&&
        this.lifeCycle?.state===PLAYER_LIFE_STATES.ALIVE,
      canFire:this.player?.canFire()??false,execute:()=>this.weapon.fire()});
    if(buffered)this.qualityTrace?.mark('ACTION_BUFFER_FIRED',{slot:this.inventory.selectedSlot});
    this.advanceADS(dt);
    this.qualityTrace?.frame(nowFrame,{state:this.player?.parkour?.state??this.player?.state,slot:this.inventory?.selectedSlot,shots:this.weapons?this.weapons[1].shots+this.weapons[2].shots:0,kills:this.kills});
    this.station?.update(dt);this.train?.update(dt);this.enforceTrainSafety();this.particles?.update(dt);this.updateEnemies(dt);
    this.combatFeel.advance(dt,{stage:this.encounter.stage,engaged:this.aiEnabled&&this.missionActive&&this.lifeCycle.state===PLAYER_LIFE_STATES.ALIVE?this.encounter.engaged:0});
    if(this.combatFeel.hitTime>0||this.combatFeel.impactTime>0||this.combatFeel.hurtTime>0||
       $('hitmarker').style.opacity==='1'||$('incomingCue').style.opacity==='1'||$('hitFeedback').style.opacity==='1')this.refreshCombatFeelHud();
    let shakeX=0,shakeY=0;if(this.runtimeGuard.reducedMotion)this.screenShake=0;
    if(this.screenShake>0){shakeX=(Math.random()-.5)*this.screenShake;shakeY=(Math.random()-.5)*this.screenShake;this.camera.position.x+=shakeX;this.camera.position.y+=shakeY;this.screenShake*=.78;}
    this.renderer.info.reset();this.composer.render();
    if(shakeX||shakeY){this.camera.position.x-=shakeX;this.camera.position.y-=shakeY;}
    this.frames++;const now=performance.now();if(now-this.lastFps>500){const fps=Math.round(this.frames*1000/(now-this.lastFps));this.frames=0;this.lastFps=now;this.metrics={fps,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures};const look=this.playerLook;$('debug').innerHTML='FPS '+fps+'<br>DRAW '+this.metrics.drawCalls+'<br>TRIS '+this.metrics.triangles.toLocaleString()+(look?'<br>YAW '+THREE.MathUtils.radToDeg(look.yaw).toFixed(1)+'°<br>PITCH '+THREE.MathUtils.radToDeg(look.pitch).toFixed(1)+'°<br>LOOK '+(look.isLocked?'LOCKED':look.fallbackActive?'RMB DRAG':'IDLE'):'');}
  }
}

game=new Game();
game.init().catch(err=>{
  console.error(err);
  $('assetStatus').textContent='Fatal startup error: '+err.message;
  $('loadingText').textContent='STARTUP FAILED — CHECK CONSOLE';
});

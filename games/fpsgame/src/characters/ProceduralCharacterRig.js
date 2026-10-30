import {MUTED_URBAN} from '../art/MutedUrbanPalette.js';
import * as THREE from 'three';

const material = (color, roughness=.65, metalness=.1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export class ProceduralCharacterRig {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'character-root';
    this.nodes = {};
    this.hitMeshes = [];
    this.partNames = [];

    const suit = material(MUTED_URBAN.character.suit,.72,.08);
    const armor = material(MUTED_URBAN.character.armor,.38,.62);
    const skin = material(MUTED_URBAN.character.skin,.78,0);
    const dark = material(MUTED_URBAN.character.dark,.66,.18);

    this.nodes.pelvis = this.group('pelvis', this.root, 0, .92, 0);
    this.mesh('pelvis-hit', new THREE.BoxGeometry(.62,.38,.34), suit, this.nodes.pelvis, [0,0,0], 'pelvis');

    this.nodes.torso = this.group('torso', this.nodes.pelvis, 0, .48, 0);
    this.mesh('torso-hit', new THREE.BoxGeometry(.78,.78,.38), armor, this.nodes.torso, [0,.28,0], 'torso');

    this.nodes.head = this.group('head', this.nodes.torso, 0, .98, 0);
    this.mesh('head-hit', new THREE.SphereGeometry(.27,14,10), skin, this.nodes.head, [0,0,0], 'head');

    for (const side of [-1,1]) {
      const key=side<0?'left':'right';
      const upperArm=this.group(`${key}UpperArm`,this.nodes.torso,side*.52,.68,0);
      this.mesh(`${key}-upper-arm`,new THREE.CapsuleGeometry(.11,.42,4,7),suit,upperArm,[0,-.23,0],'arm');
      const forearm=this.group(`${key}Forearm`,upperArm,0,-.54,0);
      this.mesh(`${key}-forearm`,new THREE.CapsuleGeometry(.095,.36,4,7),dark,forearm,[0,-.2,0],'arm');
      this.nodes[`${key}UpperArm`]=upperArm;this.nodes[`${key}Forearm`]=forearm;

      const thigh=this.group(`${key}Thigh`,this.nodes.pelvis,side*.22,-.22,0);
      this.mesh(`${key}-thigh`,new THREE.CapsuleGeometry(.14,.48,4,7),suit,thigh,[0,-.3,0],'leg');
      const shin=this.group(`${key}Shin`,thigh,0,-.68,0);
      this.mesh(`${key}-shin`,new THREE.CapsuleGeometry(.12,.44,4,7),dark,shin,[0,-.27,0],'leg');
      this.nodes[`${key}Thigh`]=thigh;this.nodes[`${key}Shin`]=shin;
    }

    this.nodes.weaponAnchor=this.group('weaponAnchor',this.nodes.torso,.22,.42,-.28);
    const weapon=this.mesh('enemy-weapon',new THREE.BoxGeometry(.18,.15,.75),armor,this.nodes.weaponAnchor,[0,0,-.32],null);
    weapon.rotation.x=.05;
    // Functional silhouette from the third-person view, including a visible
    // barrel, front sight and magazine. Parts are visual, not invulnerable hits.
    const receiver=material(MUTED_URBAN.character.receiver,.4,.65),barrel=material(MUTED_URBAN.character.barrel,.28,.72);
    this.mesh('rifle-barrel',new THREE.CylinderGeometry(.037,.037,.48,8),barrel,
      this.nodes.weaponAnchor,[0,.01,-.88],null).rotation.x=Math.PI/2;
    this.mesh('rifle-stock',new THREE.BoxGeometry(.22,.19,.26),dark,
      this.nodes.weaponAnchor,[0,-.018,.14],null);
    this.mesh('rifle-magazine',new THREE.BoxGeometry(.12,.27,.18),receiver,
      this.nodes.weaponAnchor,[0,-.18,-.37],null).rotation.x=-.20;
    this.mesh('rifle-sight',new THREE.BoxGeometry(.045,.09,.11),receiver,
      this.nodes.weaponAnchor,[0,.135,-.65],null);

    this.addVisualArmor();
    this.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  }

  addVisualArmor(){
    // Visual-only mesh hierarchy follows the existing animated bones.
    // No part tags are registered, so the 11 authoritative hit meshes remain.
    const ceramic=material(MUTED_URBAN.character.ceramic,.51,.34);
    const straps=material(MUTED_URBAN.character.straps,.78,.12);
    const highlight=material(MUTED_URBAN.character.highlight,.39,.52);
    const visor=new THREE.MeshPhysicalMaterial({color:MUTED_URBAN.character.visor,metalness:.55,
      roughness:.19,clearcoat:.65,clearcoatRoughness:.12});
    const add=(name,shape,mat,parent,position)=>{
      const mesh=this.mesh('visual-'+name,shape,mat,parent,position,null);
      mesh.userData.visualOnly=true;
      return mesh;
    };
    add('helmet-shell',new THREE.SphereGeometry(.298,18,12,0,Math.PI*2,0,1.70),
      ceramic,this.nodes.head,[0,.085,0]);
    add('helmet-visor',new THREE.BoxGeometry(.40,.14,.075),
      visor,this.nodes.head,[0,-.015,-.262]);
    add('carrier-front',new THREE.BoxGeometry(.62,.48,.10),
      ceramic,this.nodes.torso,[0,.29,-.247]);
    add('carrier-strap-left',new THREE.BoxGeometry(.115,.53,.075),
      straps,this.nodes.torso,[-.24,.37,-.305]);
    add('carrier-strap-right',new THREE.BoxGeometry(.115,.53,.075),
      straps,this.nodes.torso,[.24,.37,-.305]);
    add('carrier-clip',new THREE.BoxGeometry(.26,.075,.08),
      highlight,this.nodes.torso,[0,.20,-.34]);
    add('backpack',new THREE.BoxGeometry(.49,.55,.25),
      straps,this.nodes.torso,[0,.25,.325]);
    for(const side of [-1,1]){
      const key=side<0?'left':'right';
      add(key+'-pauldron',new THREE.BoxGeometry(.30,.24,.38),
        ceramic,this.nodes[key+'UpperArm'],[0,-.055,0]);
      add(key+'-forearm-guard',new THREE.BoxGeometry(.16,.29,.085),
        ceramic,this.nodes[key+'Forearm'],[0,-.20,-.095]);
      add(key+'-shin-plate',new THREE.BoxGeometry(.23,.36,.10),
        ceramic,this.nodes[key+'Shin'],[0,-.25,-.115]);
      add(key+'-boot',new THREE.BoxGeometry(.30,.18,.43),
        straps,this.nodes[key+'Shin'],[0,-.555,-.090]);
    }
  }

  group(name,parent,x,y,z){
    const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;
  }

  mesh(name,geometry,mat,parent,position,part){
    const m=new THREE.Mesh(geometry,mat);m.name=name;m.position.set(...position);parent.add(m);
    if(part){m.userData.part=part;this.hitMeshes.push(m);this.partNames.push(name);}
    return m;
  }
}

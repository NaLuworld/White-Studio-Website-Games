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

    const suit = material(0x252b31,.72,.08);
    const armor = material(0x11161b,.38,.62);
    const skin = material(0x8b7567,.78,0);
    const dark = material(0x161a1f,.66,.18);

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
    const weapon=this.mesh('enemy-weapon',new THREE.BoxGeometry(.13,.13,.78),armor,this.nodes.weaponAnchor,[0,0,-.32],null);
    weapon.rotation.x=.05;

    this.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
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

// Rooftop Blacksite R1: deterministic scene *proposal*.
// All distances are metres. Geometry and collision definitions share the same source.
// IMPORTANT: R1 is a visual/layout prototype, not an accepted PlayerController-integrated level.
const deck=(id,x,z,w,d,top=0,color='concrete')=>({
  id,kind:'deck',position:{x,y:top-.24,z},size:{x:w,y:.48,z:d},
  material:color,collidable:true,traversal:null
});
const block=(id,x,y,z,w,h,d,material='structure',traversal=null)=>({
  id,kind:'block',position:{x,y,z},size:{x:w,y:h,z:d},
  material,collidable:true,traversal
});
const accent=(id,x,y,z,w,h,d,material='signal')=>({
  id,kind:'accent',position:{x,y,z},size:{x:w,y:h,z:d},
  material,collidable:false,traversal:null
});

export const ROOFTOP_BLUEPRINT={
  id:'rooftop_blacksite',
  name:'ROOFTOP / BLACKSITE',
  label:'R1 GRAYBOX · NOT YET PLAYABLE',
  version:1,
  units:'metres',
  world:{xMin:-48,xMax:48,zMin:-62,zMax:52,yMin:-8,yMax:28},
  spawn:{x:0,y:0,z:44},
  objective:{id:'security-control',x:0,y:5,z:-35,description:'Interact with an actual security console in R4'},
  extraction:{id:'extraction-tower',x:0,y:12,z:-56,description:'Complete level-dependent extraction in R4'},
  zones:[
    {id:'Z1',name:'ENTRY ROOF',z:38,top:0,goal:'Observe / approach',theme:'arrival'},
    {id:'Z2',name:'SERVICE EXTERIOR',z:19,top:3.5,goal:'Wall run / wall kick',theme:'traverse'},
    {id:'Z3',name:'COMBAT BOWL',z:-7,top:7,goal:'3-route encounter',theme:'combat'},
    {id:'Z4',name:'SECURITY INTERIOR',z:-33,top:9,goal:'Infiltrate terminal',theme:'security'},
    {id:'Z5',name:'EXTRACTION TOWER',z:-53,top:12,goal:'Climb / escape',theme:'extraction'}
  ],
  materials:{
    concrete:'#343e4b',deckTop:'#495461',structure:'#1d2836',cover:'#69727d',
    traversal:'#57c7c7',edge:'#f0ba67',signal:'#e95846',glass:'#4e727f'
  },
  geometry:[
    // Ground spine is contiguous; future R3 must physically verify every 3D alternate route.
    deck('z1-ground',0,37,30,28),
    deck('z2-ground',0,17,30,22),
    deck('z3-ground',0,-6,34,28),
    deck('z3-z4-connector',0,-19.5,13,7),
    deck('z4-ground',0,-34,29,24),
    deck('z5-ground',0,-51,26,21),
    // Center combat arena: two sightline blockers and legitimate low-vault cover.
    block('z1-vault',-2,.47,35,2.1,.94,1.05,'cover',{vaultable:true,ledge:true}),
    block('z1-lowcover',6,.50,40,3,1.0,1.0,'cover',{vaultable:true,ledge:true}),
    block('z2-hvac-a',-6,1.2,18,3,2.4,2.0,'cover'),
    block('z2-hvac-b',-2,.60,12.8,3,1.2,1.2,'cover',{vaultable:true,ledge:true}),
    // PLAYABLE east mobility lane: two authentic waist-high, collider-backed
    // vault gates on contiguous rooftop ground. No teleport, no fake upper
    // bridge or path across unsupported sky. The player must sprint + SPACE.
    block('east-parkour-gate-a',9,.45,24.5,4,.9,.95,'traversal',{vaultable:true,ledge:true}),
    block('east-parkour-gate-b',9,.45,9.0,4,.9,.95,'traversal',{vaultable:true,ledge:true}),
    accent('east-parkour-cue-a',9,1.06,24.5,3.5,.09,.13,'signal'),
    accent('east-parkour-cue-b',9,1.06,9.0,3.5,.09,.13,'signal'),
    // Opaque service divider: west stealth lane gains actual collider + enemy LOS cover.
    // North entry at z>8, south corner at z<-16 remains open for physical flanking.
    block('z2-z3-west-service-screen',-11.0,1.65,-0.5,.55,3.3,30,'structure'),
    block('z3-cover-west',-8,.55,-7,3,1.1,1.5,'cover',{vaultable:true,ledge:true}),
    block('z3-cover-east',7,.52,-10,3,1.04,1.55,'cover',{vaultable:true,ledge:true}),
    block('z3-cover-center',0,.65,-4,2.7,1.3,1.2,'cover',{vaultable:true,ledge:true}),
    block('z4-control-room',-9,2.2,-34,6,4.4,8,'structure'),
    block('z4-security-wall',7,2.5,-34,1,5,13,'structure'),
    block('z4-side-hall',-14,2.1,-35,.65,4.2,15,'structure'),
    block('z4-security-console',0,1.05,-35,2.4,2.1,1,'edge'),
    block('z5-tower-core',0,5.2,-54,5,10.4,4,'structure'),
    // Obvious but physically grounded wall-running surfaces, geometry tags used in R3.
    block('z1-wallrun-west',-13,2.0,35,.5,4.0,9,'structure',{wallRunnable:true}),
    block('z2-wallkick-left',12.5,5.4,18,.45,3.8,8,'structure',{wallRunnable:true}),
    block('z2-wallkick-right',15.8,5.4,18,.45,3.8,8,'structure',{wallRunnable:true}),
    block('z3-wallrun-east',15.4,5.0,-6,.5,4.0,11,'structure',{wallRunnable:true}),
    block('z5-wallrun-tower',9.2,12.2,-52,.5,5,10,'structure',{wallRunnable:true}),
    // Separated upper traversal structures; bridges and ramps remain to be physically closed in R3.
    deck('z2-maintenance-deck',13.6,18,8,17,3.5,'deckTop'),
    deck('z3-overlook',12,-6,9,19,7.0,'deckTop'),
    deck('z4-upper-walkway',11,-33,10,17,9.0,'deckTop'),
    deck('z5-tower-platform',10,-53,10,12,12.0,'deckTop'),
    block('z1-mantle-block',11,1.2,33,2.8,2.4,2.4,'cover',{mantleable:true,ledge:true}),
    block('z3-mantle-ledge',6,1.1,-15,2.8,2.2,1.8,'cover',{mantleable:true,ledge:true}),
    // Upper-level steps and small bridges are visual layout placeholders until swept physics verification.
    block('z2-traverse-guide',13.6,3.62,26,7.7,.12,.13,'traversal'),
    block('z3-overlook-guide',12,7.15,0,8.5,.10,.13,'traversal'),
    block('z4-interior-guide',11,9.13,-28,9,.1,.13,'traversal'),
    block('z5-edge-guide',10,12.16,-48,9,.1,.13,'edge'),
    // Construction masses are non-walkable skyline visuals, not collisions.
    accent('backdrop-left',-35,13,-20,8,26,8,'structure'),
    accent('backdrop-right',37,18,-36,9,36,12,'structure'),
    accent('horizon-a',-34,16,-51,7,32,6,'glass'),
    accent('horizon-b',32,20,18,9,40,7,'glass'),
    accent('antenna-tip',0,14,-54,.18,5,.18,'signal'),
    accent('zone-terminal-glow',0,2.3,-34.4,1.8,.22,.12,'signal'),
    accent('extraction-signal',0,13,-56,1.8,.16,.16,'traversal')
  ],
  routes:[
    {id:'LOUD',label:'DIRECT ASSAULT',color:'#e95846',risk:'High alert / accessible',waypoints:[
      [0,.3,44],[0,.3,31],[1,.3,18],[0,.3,-6],[3,.3,-22],[1,.3,-34],[0,.3,-51],[0,12,-56]]},
    {id:'STEALTH',label:'SIDE INFILTRATION',color:'#f0ba67',risk:'Patrol timing / concealment',waypoints:[
      [0,.3,44],[-9,.3,34],[-9,.3,18],[-13,.3,-2],[-13,.3,-17],[-13,.3,-34],[-6,.3,-48],[0,12,-56]]},
    {id:'MOBILITY',label:'VERTICAL PARKOUR',color:'#57c7c7',risk:'Fast / execution challenge',waypoints:[
      [0,.3,44],[11,1.3,33],[13.6,3.9,24],[13.6,3.9,14],[12,7.4,1],[12,7.4,-12],[11,9.4,-31],[10,12.4,-49],[0,12,-56]]}
  ]
};

export function solidBounds(solid){
  const {position:p,size:s}=solid;
  return {min:{x:p.x-s.x/2,y:p.y-s.y/2,z:p.z-s.z/2},
          max:{x:p.x+s.x/2,y:p.y+s.y/2,z:p.z+s.z/2},
          userData:{traversal:solid.traversal,surface:solid.material}};
}

export function blueprintSummary(bp=ROOFTOP_BLUEPRINT){
  return {
    level:bp.id,zones:bp.zones.length,routes:bp.routes.map(r=>r.id),
    geometry:bp.geometry.length,physicalSolids:bp.geometry.filter(g=>g.collidable).length,
    wallRunSurfaces:bp.geometry.filter(g=>g.traversal?.wallRunnable).length,
    mantleSurfaces:bp.geometry.filter(g=>g.traversal?.mantleable).length,
    vaultSurfaces:bp.geometry.filter(g=>g.traversal?.vaultable).length
  };
}

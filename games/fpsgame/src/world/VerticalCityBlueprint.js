// VERTICAL CITY V2: 3D dense urban battlefield. Geometry is common for physics/render.
// Metres. All floors and public streets are physically traversable, not visual path ribbons.
export const CITY_BOUNDS=Object.freeze({xMin:-112,xMax:112,zMin:-112,zMax:112,trainLaneMinX:999});
const PRIMARY_BUILDINGS=[
  {id:'KITE',name:'KITE OFFICES',x:-38,z:-30,w:24,d:25,levels:5},
  {id:'NEXUS',name:'NEXUS LAB',x:37,z:-29,w:26,d:26,levels:7},
  {id:'ATLAS',name:'ATLAS RESIDENCES',x:-37,z:33,w:24,d:26,levels:5},
  {id:'HARBOR',name:'HARBOR TOWER',x:37,z:34,w:26,d:26,levels:7},
  {id:'RELAY',name:'RELAY TERMINAL',x:0,z:-58,w:24,d:20,levels:5}
];
// Tight high-rise streets: real buildings, not fake skyline cards. Stagger
// heights to create near/mid/far hooks within 56m from multiple street routes.
const INFILL_SITES=[
  [-63,-60],[-63,-18],[-63,20],[-63,61],
  [63,-60],[63,-18],[63,20],[63,61],
  [-17,-22],[-17,22],[-17,60],
  [17,-22],[17,22],[17,60],
  // New perimeter belts: 25-40m grapple corridors instead of empty outskirts.
  [-94,-82],[-94,-40],[-94,0],[-94,40],[-94,82],
  [94,-82],[94,-40],[94,0],[94,40],[94,82],
  // Mid-city relays dissolve the old oversize central courtyards.
  [-47,0],[47,0],[-10,-37],[0,34]
];
const INFILL_BUILDINGS=INFILL_SITES.map(([x,z],i)=>({
  id:'INFILL-'+String(i+1).padStart(2,'0'),
  name:'TOWER '+String(i+1).padStart(2,'0'),x,z,
  w:Math.abs(x)>50?11:8,d:Math.abs(z)>45?12:11,
  levels:6+(i*5)%7,compact:true
}));
export const CITY_BUILDINGS=Object.freeze([...PRIMARY_BUILDINGS,...INFILL_BUILDINGS]);
const elements=[];
const put=(id,x,y,z,w,h,d,material='concrete',solid=true,traversal=null)=>elements.push({
  id,position:{x,y,z},size:{x:w,y:h,z:d},material,collidable:solid,traversal
});
const floor=(id,x,z,w,d,y=0,mat='floor')=>put(id,x,y-.22,z,w,.44,d,mat);
const wall=(id,x,y,z,w,h,d,mat='wall',tag=null)=>put(id,x,y+h/2,z,w,h,d,mat,true,tag);
const marker=(id,x,y,z,w,h,d,mat='light')=>put(id,x,y,z,w,h,d,mat,false);
floor('city-foundation',0,0,223,223,0,'road');
for(const x of [-95,-62,0,62,95]){
  marker('lane-x-'+x,x,.018,0,1,.025,221,'lane');
  marker('cross-x-'+x,0,.02,x,221,.025,1,'lane');
}
for(let i=0;i<6;i++)for(let j=0;j<6;j++){
  const x=-95+i*38,z=-95+j*38;
  if(Math.hypot(x,z)>24)marker('walkway-'+i+'-'+j,x,.035,z,13,.04,13,'pavement');
}
// Open, line-of-sight readable plaza; not an impassable central prop.
marker('central-plaza',0,.04,0,25,.08,25,'plaza');
for(const b of PRIMARY_BUILDINGS){
  const halfW=b.w/2,halfD=b.d/2,levels=b.levels,roof=levels*5;
  // Every exterior facade is sectioned by story. South-facing entrance and north
  // emergency exit stay open at ALL heights, enabling exterior balconies and rooms.
  for(let layer=0;layer<levels;layer++){
    const base=layer*5,suffix=b.id+'-'+layer;
    for(const front of [-1,1]){
      const z=b.z+front*(halfD-.2);
      const sideWidth=(b.w-4.4)/2;
      for(const side of [-1,1])wall('facade-'+suffix+'-'+front+'-'+side,
        b.x+side*(2.2+sideWidth/2),base,z,sideWidth,4.8,.4,'wall');
      marker('entry-header-'+suffix+'-'+front,b.x,base+4.83,z,4,.11,.32,'trim');
    }
    for(const side of [-1,1])wall('side-'+suffix+'-'+side,
      b.x+side*(halfW-.2),base,b.z,.4,4.8,b.d,'wall');
    // Room partitions have alternating door openings; both interior corridors
    // lead out to a visible, real exit rather than closing into dead-end boxes.
    const inner=b.w-1.2,gap=3.4,span=(inner-gap)/2;
    for(const [offset,doorShift] of [[-3.6,-2.2],[3.5,2.3]]){
      for(const side of [-1,1]){
        // Keep the east stairwell physically clear of room-divider colliders.
        const length=side===-1?(inner/2+doorShift-gap/2):
          Math.max(0,halfW-6.0-doorShift-gap/2);
        const start=side===-1?b.x-inner/2:b.x+doorShift+gap/2;
        if(length>1.0)wall('room-'+suffix+'-'+offset+'-'+side,start+length/2,base,b.z+offset,length,4.5,.26,'partition');
      }
    }
    // Upper floors use a real stairwell cutout, not a collider hidden in the stairs.
    if(layer>0){
      const riserX=b.x+halfW-4.2,shaftW=3.5;
      if(layer===1){
        const mainW=b.w-5.95;
        floor('mezz-main-'+suffix,b.x-(b.w-mainW)/2+.35,b.z,mainW,b.d-.8,base);
        const stripW=5.0,stripX=b.x+halfW-2.65;
        const minZ=b.z+halfD-10.65,maxZ=b.z+halfD-1;
        const northLen=minZ-(b.z-halfD+.4),southLen=(b.z+halfD-.4)-maxZ;
        if(northLen>1)floor('mezz-north-'+suffix,stripX,(b.z-halfD+.4+minZ)/2,stripW,northLen,base);
        if(southLen>1)floor('mezz-south-'+suffix,stripX,(maxZ+b.z+halfD-.4)/2,stripW,southLen,base);
      }else floor('mezz-'+suffix,b.x,b.z,b.w-.8,b.d-.8,base);
    }
    // Accessible upper exterior transfer ledges. Same elevation as interior.
    if(layer>0){
      floor('balcony-'+suffix,b.x,b.z+halfD+2.0,8.5,4.6,base,'deck');
    }
    // Building-specific inset glazing is cosmetic so it never closes door gaps.
    for(const side of [-1,1])marker('windowband-'+suffix+'-'+side,
      b.x+side*(halfW+.025),base+3.45,b.z, .06,.32,b.d-3,'glass');
  }
  // Real ground level interior stairs. 12 risers x 0.416 m, up to floor 5.
  const sx=b.x+halfW-4.2,firstZ=b.z+halfD-1.65;
  for(let i=1;i<=12;i++){
    const top=i*5/12,sz=firstZ-(i-.5)*.75;
    put('stair-'+b.id+'-'+i,sx,top/2,sz,2.3,top,.745,'stair',true,{stair:true});
  }
  floor('roof-'+b.id,b.x,b.z,b.w+.2,b.d+.2,roof,'deck');
  for(let side of [-1,1])wall('roof-parapet-x-'+b.id+'-'+side,
    b.x+side*halfW,roof,b.z,.36,.84,b.d,'parapet');
  wall('roof-parapet-back-'+b.id,b.x,roof,b.z-halfD,b.w,.84,.36,'parapet');
  const roofSide=(b.w-4.4)/2;
  for(const side of [-1,1])wall('roof-parapet-front-'+b.id+'-'+side,
    b.x+side*(2.2+roofSide/2),roof,b.z+halfD,roofSide,.84,.36,'parapet');
  // Front ledge for each height (including the roof), physically supported and
  // safely approached via an ascent-then-approach grapple trajectory.
  for(let level=1;level<=levels;level++){
    const y=level*5;
    floor('transfer-'+b.id+'-'+level,b.x,b.z+halfD+2.2,9.2,4.7,y,'deck');
    const landing={x:b.x,z:b.z+halfD+2.85,feetY:y};
    elements.push({id:'anchor-'+b.id+'-'+level,anchor:true,landing,
      position:{x:b.x,y:y+2.2,z:b.z+halfD+6.4},
      size:{x:.9,y:.9,z:.9},material:'anchor',collidable:false,traversal:null});
    marker('edge-neon-'+b.id+'-'+level,b.x,y+.075,b.z+halfD+4.52,9,.13,.12,'light');
  }
  // External cover and traversal tags, never closing the lobby entrance.
  put('cover-'+b.id,b.x-halfW-3,.52,b.z,3,1.04,2,'cover',true,{vaultable:true,ledge:true});
  marker('tower-vertical-'+b.id,b.x-halfW-.25,roof/2,b.z-halfD-.5,.16,roof, .16,'light');
}
// DENSE INFILL QUARTERS. All anchors, bullets and physics share these box solids.
// Broad hollow lower corridors remain usable from both street ends. The compact
// facades, supportable balcony floors and roofs double as midair traversal targets.
for(const [index,b] of INFILL_BUILDINGS.entries()){
  const height=b.levels*5,hw=b.w/2,hd=b.d/2,open=3.3,wing=(b.w-open)/2;
  const masonry=index%3===0?'towerBrick':index%3===1?'towerSlate':'wall';
  for(const face of [-1,1]){
    const z=b.z+face*(hd-.15);
    for(const side of [-1,1]){
      wall('infill-front-'+b.id+'-'+face+'-'+side,
        b.x+side*(open/2+wing/2),0,z,wing,height,.3,masonry);
    }
    // Raised lintel keeps a truly unobstructed 3.3m ground passage.
    wall('infill-lintel-'+b.id+'-'+face,b.x,3.8,z,open,height-3.8,.3,masonry);
  }
  for(const side of [-1,1]){
    wall('infill-side-'+b.id+'-'+side,b.x+side*(hw-.15),0,b.z,.3,height,b.d,masonry);
    for(let level=0;level<b.levels;level++){
      marker('infill-glass-'+b.id+'-'+side+'-'+level,
        b.x+side*(hw+.025),level*5+3,b.z,.08,2.4,b.d-1.8,'towerGlass');
      marker('infill-glint-'+b.id+'-'+side+'-'+level,
        b.x+side*(hw+.07),level*5+1.2,b.z,.08,.09,b.d-1.8,'trim');
    }
  }
  // Interior transfer mezzanines: no solid ground-floor trap.
  for(let level=2;level<b.levels;level+=2)
    floor('infill-mezz-'+b.id+'-'+level,b.x,b.z,b.w-.5,b.d-.5,level*5,'deck');
  floor('infill-roof-'+b.id,b.x,b.z,b.w+.25,b.d+.25,height,'deck');
  for(const side of [-1,1])wall('infill-parapet-'+b.id+'-'+side,
    b.x+side*hw,height,b.z,.25,.55,b.d,'parapet');
  // Exposed side balconies at regular heights are true physical overhangs.
  for(let level=2;level<=b.levels;level+=2){
    const y=level*5;
    floor('infill-perch-'+b.id+'-'+level,b.x,b.z+hd+1.1,Math.max(4,b.w-1.6),2.5,y,'deck');
    marker('infill-neon-'+b.id+'-'+level,b.x,y+.1,b.z+hd+2.4,b.w-2,.12,.14,'light');
    // Intermediate anchors support 60m+ climbs through successive grapples.
    elements.push({id:'anchor-'+b.id+'-'+level,anchor:true,
      landing:{x:b.x,z:b.z+hd+1.5,feetY:y},
      position:{x:b.x,y:y+2.2,z:b.z+hd+4.6},
      size:{x:.9,y:.9,z:.9},material:'anchor',collidable:false,traversal:null});
  }
  marker('infill-crown-'+b.id,b.x,height+.12,b.z,b.w-.9,.2,b.d-.9,'towerRoof');
}
// Mid-level traversable skybridge: ATLAS ↔ HARBOR balconies at 10 metres.
// Real colliders, independent of grappling; more than one valid crossing mode.
floor('atlas-harbor-skybridge',0,48.5,78,2.8,10,'deck');
for(const side of [-1,1])wall('skybridge-railing-'+side,0,10,48.5+side*1.3,61,.9,.18,'parapet');
for(const x of [-19,19])wall('skybridge-column-'+x,x,0,48.5,.95,9.78,.95,'wall');

// STREET COMBAT COVER: low, vaultable, collision-backed barricades break the
// broad avenues into tactical fire lanes. They never close the central spawn or
// original ten-metre sky-hub hook lanes and are light enough to draw cheaply.
for(const x of [-73,-29,29,73])for(const z of [-86,-49,-8,8,49,86]){
  const id='street-barricade-'+x+'-'+z;
  const orientation=(Math.abs(x)+Math.abs(z))%2===0;
  put(id,x,.68,z,orientation?3.0:1.55,1.36,orientation?1.55:3.0,
    'cover',true,{vaultable:true,ledge:true});
  marker('street-guide-'+x+'-'+z,x,1.4,z,2.4,.09,.13,'light');
}
// CENTRAL SKY-TRANSFER HUB: a pair of accessible supported decks break up
// long tower-to-tower jumps into two legal, line-of-sight grapple legs.
for(const level of [2,3]){
  const y=level*5;
  floor('city-sky-hub-'+level,0,0,14,14,y,'deck');
  wall('hub-rear-rail-'+level,0,y,-6.8,13.8,.84,.28,'parapet');
  marker('hub-status-'+level,0,y+.08,6.85,9,.1,.12,'light');
  elements.push({id:'anchor-SKYHUB-'+level,anchor:true,
    landing:{x:0,z:5,feetY:y},position:{x:0,y:y+2.2,z:9},
    size:{x:.9,y:.9,z:.9},material:'anchor',collidable:false,traversal:null});
}
// Rear-only supports keep both tower-to-hub airborne lanes collision-free.
for(const x of [-6,6])
  wall('sky-hub-strut-'+x+'-rear',x,0,-6,.9,14.75,.9,'structure');

export const CITY_BLUEPRINT=Object.freeze({
  id:'vertical_city',name:'VERTICAL CITY / DENSE COMBAT SANDBOX',version:2,
  world:CITY_BOUNDS,spawn:{x:0,y:0,z:9},buildings:CITY_BUILDINGS,geometry:elements,
  materials:{road:'#283642',lane:'#657785',pavement:'#344655',plaza:'#34434f',
    floor:'#485362',wall:'#303e4d',structure:'#304759',partition:'#5b6773',deck:'#526878',
    towerBrick:'#51434b',towerSlate:'#425466',towerGlass:'#518ca1',towerRoof:'#6d8ba1',
    cover:'#6b767c',stair:'#71818f',trim:'#879ca4',glass:'#538296',
    parapet:'#344654',light:'#5ce8d6',anchor:'#70ffda'},
  routes:['GROUND FLANK','INTERIOR THROUGH-ROUTE','STAIRWELL TO MEZZANINE',
          'ROOFTOP LINK','GRAPPLE CROSS-BUILDING','TOWER-TO-TOWER AERIAL CHAIN']
});
// Safely leave a roof/terrace overhang before vertical grappling ascent.
// For current exterior anchor landings, this points into open air ahead of
// the platform. The motor still sweeps the complete escape segment.
export function cityGrappleEscape(position,bp=CITY_BLUEPRINT){
  if(!position||![position.x,position.z,position.feetY].every(Number.isFinite))return null;
  // Elevated central transfer hub has its own second-story overhang.
  if(Math.abs(position.x)<5&&position.z>3&&position.z<7.2&&
     position.feetY>=9.8&&position.feetY<=15.2)
    return {x:position.x,z:9.2,feetY:position.feetY};
  for(const b of bp.buildings){
    const front=b.z+b.d/2;
    if(position.feetY>=4.8&&Math.abs(position.x-b.x)<4.9&&
       position.z>front-.3&&position.z<front+4.9&&
       Math.abs(position.feetY/5-Math.round(position.feetY/5))<.06){
      return {x:position.x,z:front+6.2,feetY:position.feetY};
    }
  }
  return null;
}

export const citySummary=(bp=CITY_BLUEPRINT)=>({
  buildings:bp.buildings.length,solids:bp.geometry.filter(g=>g.collidable).length,
  anchors:bp.geometry.filter(g=>g.anchor).length,roomDividers:bp.geometry.filter(g=>g.id.startsWith('room-')).length,
  stairs:bp.geometry.filter(g=>g.id.startsWith('stair-')).length,
  height:Math.max(...bp.buildings.map(b=>b.levels*5)),
  dimensions:[bp.world.xMax-bp.world.xMin,bp.world.zMax-bp.world.zMin]
});

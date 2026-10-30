// Level identity is independent from legacy Classic/Infiltration/Sandbox mode.
export const LEVELS=Object.freeze({
  station:Object.freeze({id:'station',name:'JAPANESE STATION',playable:true}),
  rooftop:Object.freeze({id:'rooftop',name:'ROOFTOP BLACKSITE / ENTRY DRILL',playable:true}),
  city:Object.freeze({id:'city',name:'VERTICAL CITY / AUTHORED GRAPPLE LEVEL',playable:true}),
  skyline:Object.freeze({id:'skyline',name:'SKYLINE FREEFLIGHT / INFINITE GRAPPLE SANDBOX',playable:true})
});
export function initialLevel(search=''){
  const q=new URLSearchParams(search);
  return q.get('skyline')==='1'||q.get('mode')==='freeflight'?'skyline':
    q.get('city')==='1'?'city':
    q.get('arena')==='1'&&q.get('circuit')!=='1'?'rooftop':'station';
}

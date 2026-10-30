// Rebuild through legacy URL-gated initialization to keep physical world state consistent.
export const GAME_MODES=Object.freeze({
  classic:Object.freeze({stealth:false,sandbox:false}),
  infiltration:Object.freeze({stealth:true,sandbox:false}),
  sandbox:Object.freeze({stealth:true,sandbox:true})
});

export function initialGameMode(search=''){
  const query=new URLSearchParams(search);
  return query.has('sandbox')?'sandbox':query.has('stealth')?'infiltration':'classic';
}

export function modeUrl(url,mode){
  if(!Object.hasOwn(GAME_MODES,mode))throw new RangeError('Unsupported game mode: '+mode);
  const target=new URL(url);
  const preset=GAME_MODES[mode];
  for(const flag of ['stealth','sandbox']){
    if(preset[flag])target.searchParams.set(flag,'1');
    else target.searchParams.delete(flag);
  }
  return target.href;
}

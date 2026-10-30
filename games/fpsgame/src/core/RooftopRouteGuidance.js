// Route-aware player guidance from the authoritative Rooftop objective.
// No coordinates, enemy state or scoring are inferred from this display.
export function formatRooftopRouteGuidance(state,{stealthEnabled=true}={}){
  if(!state?.enabled)return 'ROOFTOP / TARGET ACTIVE';
  if(state.done)return 'ROOFTOP / EXTRACTED';
  if(state.targetDown)return state.eastVaults===2?
    'EAST 2/2 / GREEN EXTRACTION':'TARGET DOWN / GREEN EXTRACTION';
  if(stealthEnabled&&state.quietIntact&&state.westPassed)return 'WEST UNSEEN / AMBER EXTRACTION';
  if(stealthEnabled&&state.quietIntact&&state.westEntered)return 'WEST UNSEEN / FOLLOW COVER';
  if(state.eastVaults>=2)return 'EAST 2/2 / FLANK THE TARGET';
  if(state.eastVaults===1)return 'EAST 1/2 / NEXT VAULT: SHIFT + SPACE';
  if(!stealthEnabled||!state.quietIntact)return 'TARGET ACTIVE / KILL THEN GREEN';
  return 'EAST VAULT / WEST UNSEEN / CENTRAL';
}

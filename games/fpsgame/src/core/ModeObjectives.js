// Per-mode objective contracts (roadmap Phase 33).
// Classic keeps its five-kill gate; Infiltration only grants victory on a
// clean completion (no one ever alerted) — a dirty killout resolves the
// mission without claiming victory; Sandbox never resolves from kills alone
// and waits for an explicit extraction objective.
export function objectiveOutcome(mode, state){
  if(typeof mode!=='string'||!['classic','infiltration','sandbox'].includes(mode))throw new RangeError('Unsupported game mode: '+mode);
  const {targetsRemaining,maxAlerted,extraction}={targetsRemaining:null,maxAlerted:null,extraction:false,...state};
  if(targetsRemaining===null||targetsRemaining===undefined||Number.isNaN(targetsRemaining)||typeof maxAlerted!=='number'||Number.isNaN(maxAlerted)||typeof extraction!=='boolean')throw new RangeError('Objective state is incomplete');
  if(mode==='sandbox')return extraction?'victory':(targetsRemaining===0?'missed':null);
  if(targetsRemaining!==0)return null;
  if(mode==='classic')return 'victory';
  return maxAlerted===0?'victory':'missed';
}

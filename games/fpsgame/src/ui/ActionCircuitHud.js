// HUD text for the original Action Circuit. All completion comes from real game events.
export function formatActionCircuit(state){
 if(!state)return '';
 const tick=value=>value?'✓':'○';
 return [
  'ACTION CIRCUIT / ORIGINAL TRAINING',
  tick(state.wallKicked)+' WALL RUN → SPACE WALL KICK',
  tick(state.targetDown)+' TAKE DOWN THE SINGLE TARGET  [1/2/3]',
  tick(state.done)+' REACH CYAN EXIT  X -3.2 / Z -33',
  state.targetDown?'EXIT ACTIVE / MOVE ON FOOT':'POSITION → ENGAGE / KEEP MOVING',
  'CTRL+W QUIET  ·  W+SHIFT LOUD  ·  WALL+SPACE KICK',
  'CYAN PARTITION BLOCKS EAST GUARD SIGHT',
  'RESTART MISSION to retry from circuit spawn'
 ].join('\n');
}

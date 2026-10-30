// Human-authored feedback only. No silent telemetry, persistent storage, or
// automatic subjective pass. Automated test action is never human evidence.
export const PLAYTEST_AXES=Object.freeze([
  'responsiveness','combatImpact','enemyLegibility',
  'traversal','routeChoice','replayDesire'
]);
export const PLAYTEST_ROUTES=Object.freeze(['stealth','loud','parkour-gadget']);
const whole=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;
export function buildHumanPlaytestReport(input,session){
  if(!input||input.consent!==true)throw new Error('Confirm you personally played this run.');
  if(!PLAYTEST_ROUTES.includes(input.route))throw new Error('Select the route you actually played.');
  const testerAlias=String(input.testerAlias??'').trim();
  if(!/^[A-Za-z0-9_]{2,24}$/.test(testerAlias))
    throw new Error('Use an anonymous code (2–24 letters, numbers or _).');
  const ratings={};
  for(const axis of PLAYTEST_AXES){
    const score=Number(input.ratings?.[axis]);
    if(!Number.isInteger(score)||score<1||score>5)throw new Error('Rate '+axis+' from 1 to 5.');
    ratings[axis]=score;
  }
  const countFields=['lostControls','confusingMoments','unfairDetections','fakeHits'];
  const incidents={};
  for(const field of countFields){
    const raw=input[field];
    if(raw===''||raw===null||raw===undefined||!/^\d{1,3}$/.test(String(raw))||!whole(Number(raw),999))
      throw new Error('Record '+field+' as a count from 0 to 999.');
    incidents[field]=Number(raw);
  }
  const comfort=Number(input.comfort);
  if(!Number.isInteger(comfort)||comfort<1||comfort>5)
    throw new Error('Rate motion comfort from 1 to 5.');
  const details=String(input.notes??'').trim().slice(0,1200);
  if(typeof session?.gameMode!=='string'||typeof session?.level!=='string')
    throw new Error('Game run context unavailable.');
  return {
    schema:'fpsgame.playtest.v1',
    provenance:'player-self-report',
    subjectiveAcceptance:'UNVERIFIED_HUMAN_REVIEW',
    testerAlias,routeClaim:input.route,
    session:{
      level:session.level,gameMode:session.gameMode,
      outcome:session.outcome==='completed'?'completed':'not-completed',
      durationSeconds:Number.isFinite(session.durationSeconds)?Math.max(0,Math.round(session.durationSeconds)):null,
      kills:whole(session.kills,9999)?session.kills:null,
      deaths:whole(session.deaths,9999)?session.deaths:null,
      shots:whole(session.shots,999999)?session.shots:null,
      hits:whole(session.hits,999999)?session.hits:null,
      peakAlerted:whole(session.peakAlerted,9999)?session.peakAlerted:null
    },
    ratings,
    motionComfort:comfort,
    incidents,
    notes:details
  };
}

// A deliberately small, opt-in gameplay progress overlay. Not a mission victory oracle.
export function mountActionDrillHud(hud){
  const node=document.createElement('section');
  node.id='actionDrillHud';
  node.setAttribute('aria-label','Action Sandbox Drill progress');
  node.setAttribute('aria-live','off');
  node.style.cssText='position:absolute;left:28px;top:153px;width:min(324px,calc(100vw - 56px));max-width:calc(100vw - 56px);padding:13px 15px;z-index:2;pointer-events:none;background:linear-gradient(110deg,rgba(8,16,23,.91),rgba(12,21,25,.65));border:1px solid rgba(87,199,199,.46);border-left:3px solid #57c7c7;border-radius:2px;color:#e1edf3;white-space:pre-line;font:700 11px/1.65 ui-monospace,Consolas,monospace;letter-spacing:.035em;text-shadow:0 1px 3px #000;';
  hud.append(node);
  return node;
}
export function formatActionDrill(snapshot){
  if(!snapshot?.enabled)return '';
  const tick=id=>snapshot.completed[id]?'✓':'○';
  const title=snapshot.done?'TRAINING LOOP CONFIRMED':'ACTION SANDBOX / S0 DRILL';
  return [
    title+'    '+snapshot.count+'/3',
    tick('mobility')+' MOVE + TRAVERSE  '+Math.floor(snapshot.distance)+'m / 6m',
    tick('combat')+' LAND REAL HIT  '+snapshot.hitCount,
    tick('tactics')+' DECOY → AI HEARS/SEARCHES  '+(snapshot.enemyHearings+snapshot.investigations),
    snapshot.chain.movementToCombat?'BONUS  MOVE → COMBAT  ✓':
      'WASD · SHIFT+CTRL · SPACE / 1-3 FIRE',
    snapshot.done?'REAL EVENTS OBSERVED / NOT MISSION VICTORY':
      'G DECOY · R RELOAD · ESC / RETRY'
  ].join('\n');
}

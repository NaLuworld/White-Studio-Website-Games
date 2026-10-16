// Phase 19: explicit pre-mission threat presets. No hidden adaptation,
// enemy sight/LOS bypass, geometry changes, spawns, or player-weapon buffs.
export const DIFFICULTY_PROFILES=Object.freeze({
  RECRUIT:Object.freeze({
    id:'RECRUIT',name:'RECRUIT',aimDelay:.76,cooldown:1.25,damage:3,
    description:'More time to react. Reduced incoming rifle damage.'
  }),
  TACTICAL:Object.freeze({
    id:'TACTICAL',name:'TACTICAL',aimDelay:.58,cooldown:1.0,damage:4,
    description:'Original encounter timing and incoming damage.'
  }),
  VETERAN:Object.freeze({
    id:'VETERAN',name:'VETERAN',aimDelay:.48,cooldown:.83,damage:5,
    description:'Shorter aim windows. Stronger enemy rifle pressure.'
  })
});
export const DEFAULT_DIFFICULTY='TACTICAL';
export const validDifficulty=id=>typeof id==='string'&&
  Object.prototype.hasOwnProperty.call(DIFFICULTY_PROFILES,id);
export function resolveDifficulty(id){
  return validDifficulty(id)?DIFFICULTY_PROFILES[id]:DIFFICULTY_PROFILES[DEFAULT_DIFFICULTY];
}
// Any actual mutation must be called by Game before the mission begins.
export function applyDifficulty(enemies,id){
  const profile=resolveDifficulty(id);
  if(!Array.isArray(enemies))return profile;
  for(const enemy of enemies){
    if(!enemy?.combat)continue;
    enemy.combat.aimDelay=profile.aimDelay;
    enemy.combat.cooldownDuration=profile.cooldown;
    enemy.combat.damage=profile.damage;
  }
  return profile;
}

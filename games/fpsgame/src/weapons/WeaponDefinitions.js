// Phase 23: immutable loadout definitions. Slot 1 deliberately preserves Phase22 combat.
export const WEAPON_DEFINITIONS=Object.freeze({
  1:Object.freeze({slot:1,id:'station-rifle',label:'RIFLE',kind:'automatic',mag:30,reserve:120,
    damage:36,headshot:90,rpm:632,reload:1.75,equip:.2}),
  2:Object.freeze({slot:2,id:'station-pistol',label:'PISTOL',kind:'semiauto',mag:15,reserve:45,
    damage:28,headshot:56,rpm:340,reload:1.35,equip:.22}),
  3:Object.freeze({slot:3,id:'station-knife',label:'KNIFE',kind:'melee',damage:55,
    reach:2.2,windup:.12,recovery:.44,equip:.16})
});
export const weaponSlotValid=value=>Number.isInteger(value)&&Object.hasOwn(WEAPON_DEFINITIONS,value);

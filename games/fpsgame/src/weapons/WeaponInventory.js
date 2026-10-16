import {WEAPON_DEFINITIONS,weaponSlotValid} from './WeaponDefinitions.js';
// Selected weapon state, equip transitions and persistent independent ammunition.
export class WeaponInventory {
  constructor(weapons){
    this.weapons=weapons;
    if(![1,2,3].every(slot=>weapons[slot]))throw Error('Three loadout slots required');
    this.selectedSlot=1;
    for(const [key,weapon] of Object.entries(weapons))weapon.setVisible(Number(key)===1);
  }
  get active(){return this.weapons[this.selectedSlot];}
  select(slot){
    if(!weaponSlotValid(slot))return false;
    if(slot===this.selectedSlot)return true;
    this.active?.stow?.();
    this.active?.setVisible(false);
    this.selectedSlot=slot;
    this.active?.draw?.();
    this.active?.setVisible(true);
    return true;
  }
  reset(reason='reset'){
    for(const weapon of Object.values(this.weapons))weapon.resetTransientState?.(reason);
  }
  snapshot(){
    return {slot:this.selectedSlot,weapons:Object.fromEntries(
      Object.entries(this.weapons).map(([key,weapon])=>[key,{
        label:WEAPON_DEFINITIONS[key].label,
        kind:WEAPON_DEFINITIONS[key].kind,
        ammo:weapon.ammo??null,reserve:weapon.reserve??null,
        shots:weapon.shots??0,hits:weapon.hits??0,
        state:weapon.state??'IDLE',visible:!!weapon.group?.visible,
        viewmodelParts:weapon.group?.children?.filter?.(child=>child.isMesh)?.length??0
      }]))};
  }
}

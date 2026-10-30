import {GADGET_DEFINITIONS,gadgetSlotValid} from './GadgetDefinitions.js';
const bounded=dt=>Number.isFinite(dt)?Math.max(0,Math.min(.033,dt)):0;
// Resource and cooldown authority; never accepts a visual-only / rejected gadget as a use.
export class GadgetInventory{
  constructor({reusableGrapple=false,rapidGrapple=false}={}){this.reusableGrapple=reusableGrapple;this.rapidGrapple=rapidGrapple;this.selectedSlot=1;this.charges={};this.cooldowns={};this.uses={};this.reset();if(reusableGrapple)this.selectedSlot=2;}
  reset(){for(const [slot,def] of Object.entries(GADGET_DEFINITIONS)){
    this.charges[slot]=def.charges;this.cooldowns[slot]=0;this.uses[slot]=0;
  }this.selectedSlot=1;}
  select(slot){if(!gadgetSlotValid(slot))return false;this.selectedSlot=slot;return true;}
  cycle(){return this.select(this.selectedSlot===1?2:1);}
  step(dt){const time=bounded(dt);for(const slot of Object.keys(this.cooldowns)){
    this.cooldowns[slot]=Math.max(0,this.cooldowns[slot]-time);
  }}
  use(action){
    const slot=this.selectedSlot,def=GADGET_DEFINITIONS[slot];
    if(!def||this.charges[slot]<=0||this.cooldowns[slot]>0)return {ok:false,reason:'unavailable'};
    const result=action(def);
    if(!result?.ok)return {ok:false,reason:result?.reason??'invalid-target'};
    if(!(this.reusableGrapple&&Number(slot)===2))this.charges[slot]--;
    this.cooldowns[slot]=this.reusableGrapple&&Number(slot)===2?(this.rapidGrapple?.45:1.55):def.cooldown;this.uses[slot]++;
    return {ok:true,slot,...result};
  }
  snapshot(){return {selectedSlot:this.selectedSlot,
    charges:{...this.charges},cooldowns:{...this.cooldowns},uses:{...this.uses}};}
}

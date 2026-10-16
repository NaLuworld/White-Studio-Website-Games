// Phase31: gadgets never replace the authoritative three weapon slots.
export const GADGET_DEFINITIONS=Object.freeze({
  1:Object.freeze({id:1,key:'DISTRACTION',label:'NOISE DECOY',charges:3,cooldown:1.8,range:15}),
  2:Object.freeze({id:2,key:'GRAPPLE',label:'ANCHOR GRAPPLE',charges:3,cooldown:2.8,range:18})
});
export const gadgetSlotValid=slot=>Number.isInteger(slot)&&Object.hasOwn(GADGET_DEFINITIONS,slot);

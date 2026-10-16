// Phase29: bounded procedural enemy hit reaction envelopes (visual only).
// Input is already-authorized DamageSystem contact; never generates hit/damage.
const finite=(value,otherwise=0)=>Number.isFinite(value)?value:otherwise;
const clip=(v,min,max)=>Math.max(min,Math.min(max,v));
export function sampleHitPose({part='torso',remaining=0,duration=.22,strength=1,side=1}={}){
 const d=clip(finite(duration,.22),.001,.6);
 const r=clip(finite(remaining),0,d);
 const progress=1-r/d;
 const envelope=progress<=0||progress>=1?0:
   Math.pow(Math.max(0,Math.sin(Math.PI*progress)),.85);
 const amount=envelope*clip(finite(strength,1),0,1.5);
 const sign=finite(side,1)<0?-1:1;
 const head=part==='head';
 return {
  torsoZ:sign*amount*(head?.12:.19),
  headZ:sign*amount*(head?.32:.095),
  torsoX:-amount*(head?.05:.12),
  armX:amount*(head?.14:.22),
  envelope
 };
}

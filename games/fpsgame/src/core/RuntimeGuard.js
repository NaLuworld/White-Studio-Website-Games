// Phase21 lightweight lifecycle control; no renderer recreation or gameplay authority.
export class RuntimeGuard {
 constructor({reducedMotion=false}={}){
  this.contextLost=false;this.contextLosses=0;this.contextRestores=0;
  this.reducedMotion=!!reducedMotion;
 }
 lose(){
  if(this.contextLost)return false;
  this.contextLost=true;this.contextLosses++;return true;
 }
 restore(){
  if(!this.contextLost)return false;
  this.contextLost=false;this.contextRestores++;return true;
 }
 setReducedMotion(next){
  this.reducedMotion=!!next;return this.reducedMotion;
 }
 snapshot(){
  return {contextLost:this.contextLost,contextLosses:this.contextLosses,
   contextRestores:this.contextRestores,reducedMotion:this.reducedMotion};
 }
}

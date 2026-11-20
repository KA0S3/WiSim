import {acSourceKinds,type Frame,type Project,type RuntimeState} from './model'
type WorkerPort=Pick<Worker,'postMessage'|'terminate'|'onmessage'|'onerror'>
type Timer=ReturnType<typeof setTimeout>
type Clock={set:(fn:()=>void,ms:number)=>Timer;clear:(timer:Timer)=>void}
export type RunnerView={frame:Frame|null;error:string;status:string;recovering:boolean;slow:boolean;time:number;running:boolean;stepSeconds:number}
export class SimulationRunner{
 private worker:WorkerPort|null=null
 private timer:Timer|undefined
 private busy=false
 private pending=true
 private request=0
 private checkpoint:RuntimeState|undefined
 private frame:Frame|null=null
 private attempts=0
 private seconds=.1
 private restore=false
 private initialised=false
 private error=''
 private status='Starting calculation engine'
 private recovering=false
 private slow=false
 private identity=''
 private project:Project
 private revision:number
 private running:boolean
 private disposed=false
 private clock:Clock
 constructor(project:Project,revision:number,running:boolean,private factory:()=>WorkerPort,private changed:(view:RunnerView)=>void,private options:{startupMs?:number;solveMs?:number;recoveries?:number;clock?:Clock}={}){
  this.project=project;this.revision=revision;this.running=running;this.identity=this.key(project);this.clock=options.clock??{set:(fn,ms)=>setTimeout(fn,ms),clear:timer=>clearTimeout(timer)}
 }
 private key(p:Project){return `${p.id}:${p.initialSoc}:${p.devices.length===0}`}
 private emit(){if(!this.disposed)this.changed({frame:this.frame,error:this.error,status:this.status,recovering:this.recovering,slow:this.slow,time:this.checkpoint?.time??0,running:this.running,stepSeconds:this.seconds})}
 private clearTimer(){if(this.timer!==undefined)this.clock.clear(this.timer);this.timer=undefined}
 private stop(){this.clearTimer();this.worker?.terminate();this.worker=null;this.busy=false;this.initialised=false}
 update(project:Project,revision:number,running:boolean){
  const reset=this.key(project)!==this.identity,edited=revision!==this.revision,resume=running&&!this.running
  this.project=project;this.revision=revision;this.running=running
  if(reset){this.identity=this.key(project);this.checkpoint=undefined;this.frame=null;this.stop()}
  if(reset||edited){if(this.busy)this.stop();this.pending=true;this.attempts=0;this.seconds=.1;this.recovering=false;this.slow=false;this.error='';this.frame=null;this.status=project.devices.length?'Recalculating circuit':'Empty workspace';this.emit()}
  else if(resume&&this.error)this.retry()
 }
 // This is a progress notice, not a kill timer. Large valid solves may take longer.
 private arm(ms:number,worker:WorkerPort,request:number){this.clearTimer();this.timer=this.clock.set(()=>{if(this.worker===worker&&this.request===request){this.slow=true;this.status=this.initialised?`Calculating ${this.project.devices.length} devices / ${this.project.wires.length} conductors — waiting for the solver result`:'Loading the electrical engine — waiting for initialisation';this.emit()}},ms)}
 private failed(reason:string){
  this.stop();this.frame=null;this.slow=false
  if(this.attempts<(this.options.recoveries??2)){
   this.attempts++;const longestCycle=Math.max(.02,...this.project.devices.filter(d=>d.on&&acSourceKinds.has(d.kind)).map(d=>1/d.spec.frequency))
   this.seconds=Math.max(Math.min(.1,longestCycle),this.attempts===1?.04:.02);this.pending=true;this.recovering=true;this.error='';this.status=`Recovering calculation · attempt ${this.attempts} of ${this.options.recoveries??2}`
  }else{
   this.pending=false;this.running=false;this.recovering=false;this.error=`Live readings are paused because the calculator could not finish this circuit. Your project and last valid simulation state are preserved. Edit the circuit to try again, or choose Retry calculation. Details: ${reason}`;this.status='Calculation needs attention'
  }
  this.emit()
 }
 tick(){
  if(this.disposed||this.busy||(!this.running&&!this.pending)||(!this.project.devices.length&&!this.pending))return
  if(!this.project.devices.length){this.stop();this.pending=false;this.checkpoint=undefined;this.frame=null;this.error='';this.status='Empty workspace';this.emit();return}
  if(!this.worker){
   try{this.worker=this.factory()}catch(e){this.failed(e instanceof Error?e.message:String(e));return}
   const worker=this.worker;this.restore=!!this.checkpoint
   worker.onmessage=({data})=>{
    if(this.disposed||worker!==this.worker||data.requestId!==this.request)return
    if(data.type==='phase'){
     if(data.phase==='solving'){this.initialised=true;this.arm(this.options.solveMs??3000,worker,this.request)}
     if(!this.frame&&!this.recovering){this.status=data.phase==='solving'?`Calculating ${this.project.devices.length} devices / ${this.project.wires.length} conductors`:data.phase==='compiling'?'Preparing the electrical network':data.phase==='reading'?'Preparing live readings':'Initialising the electrical engine';this.emit()}
     return
    }
    this.clearTimer();this.busy=false
    if(data.revision!==undefined&&data.revision!==this.revision||data.frame&&data.frame.revision!==this.revision){this.stop();this.pending=true;return}
    if(data.type==='frame'){this.frame=data.frame;this.checkpoint=data.state??this.checkpoint;this.attempts=0;this.recovering=false;this.slow=false;this.error='';this.status=this.running?'Live calculation':'Simulation paused';this.emit()}
    else if(data.type==='error')this.failed(data.error??'The solver could not produce a valid result.')
   }
   worker.onerror=event=>{if(worker===this.worker&&!this.disposed)this.failed(event.message||'The calculation worker stopped unexpectedly.')}
  }
  this.pending=false;this.busy=true;this.slow=false;const request=++this.request,worker=this.worker
  this.arm(this.initialised?(this.options.solveMs??3000):(this.options.startupMs??5000),worker,request)
  try{worker.postMessage({type:'run',project:this.project,revision:this.revision,requestId:request,seconds:this.seconds,checkpoint:this.restore?this.checkpoint:undefined});this.restore=false}catch(e){this.failed(e instanceof Error?e.message:String(e))}
 }
 retry(){this.stop();this.pending=true;this.error='';this.attempts=0;this.recovering=false;this.slow=false;this.seconds=.1;this.status='Retrying calculation';this.emit()}
 cancel(){this.stop();this.pending=false;this.running=false;this.slow=false;this.recovering=false;this.error='';this.status='Calculation cancelled; project stays editable';this.emit()}
 clearTrips(){if(this.checkpoint){this.checkpoint={...this.checkpoint,trips:[],tripCauses:{},overloadSeconds:{}};this.frame=null;this.retry()}}
 reset(){this.checkpoint=undefined;this.frame=null;this.retry()}
 step(){this.running=false;this.pending=!this.busy;this.emit()}
 dispose(){this.disposed=true;this.stop()}
}

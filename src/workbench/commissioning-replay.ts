import {blankProject, connect, makeDevice, type Frame, type Project, type RuntimeState} from './model'

export function commissioningFixture() {
  const project = blankProject()
  project.name = 'DC branch commissioning'
  const source = makeDevice('battery',0,0,'12.8 V source')
  const fuse = makeDevice('fuse',0,0,'Branch protection')
  const base = makeDevice('dc-load',0,0,'Essential load')
  const extra = makeDevice('dc-load',0,0,'Staged load')
  Object.assign(source.spec,{voltage:12.8,capacityAh:100})
  fuse.spec.rating=2
  Object.assign(base.spec,{voltage:12.8,watts:12.8})
  Object.assign(extra.spec,{voltage:12.8,watts:100})
  extra.on=false
  project.devices=[source,fuse,base,extra]
  project.wires=[connect(source,'p',fuse,'p'),connect(fuse,'n',base,'p'),connect(fuse,'n',extra,'p'),connect(base,'n',source,'n'),connect(extra,'n',source,'n')]
  return {project,source,fuse,base,extra}
}

export async function runCommissioning(worker: Worker, signal: AbortSignal) {
  const {project,source,fuse,base,extra}=commissioningFixture()
  let checkpoint: RuntimeState|undefined
  let requestId=0
  const trace: {stage:string;seconds:number;sourceV:number;loadV:number;currentA:number;tripped:boolean;cause?:string}[]=[]
  const stages=[
    {name:'Baseline',sourceOn:true,extraOn:false,steps:2,reset:false},
    {name:'Start staged load',sourceOn:true,extraOn:true,steps:7,reset:false},
    {name:'Remove staged load and reset protection',sourceOn:true,extraOn:false,steps:2,reset:true},
    {name:'Isolate the source',sourceOn:false,extraOn:false,steps:2,reset:false},
    {name:'Restore the source',sourceOn:true,extraOn:false,steps:2,reset:false}
  ]
  for(const stage of stages){
    const circuit:Project={...project,devices:project.devices.map(d=>d.id===source.id?{...d,on:stage.sourceOn}:d.id===extra.id?{...d,on:stage.extraOn}:d)}
    if(stage.reset&&checkpoint)checkpoint={...checkpoint,trips:[],overloadSeconds:{},tripCauses:{}}
    for(let step=0;step<stage.steps;step++){
      signal.throwIfAborted()
      const id=++requestId
      const result=await new Promise<{frame:Frame;state:RuntimeState}>((resolve,reject)=>{
        const complete=(action:()=>void)=>{
          signal.removeEventListener('abort',abort)
          worker.onmessage=null;worker.onerror=null
          action()
        }
        const abort=()=>complete(()=>reject(signal.reason))
        signal.addEventListener('abort',abort,{once:true})
        worker.onerror=event=>complete(()=>reject(Error(event.message || 'Replay worker failed.')))
        worker.onmessage=({data})=>{
          if(data.requestId!==id)return
          if(data.type==='frame')complete(()=>resolve(data))
          if(data.type==='error')complete(()=>reject(Error(data.error)))
        }
        worker.postMessage({type:'run',project:circuit,requestId:id,revision:0,seconds:.1,checkpoint})
      })
      checkpoint=result.state
      const {frame}=result
      trace.push({stage:stage.name,seconds:frame.time,sourceV:frame.devices[source.id].voltage,loadV:frame.devices[base.id].voltage,currentA:frame.devices[fuse.id].current,tripped:checkpoint.trips.includes(fuse.id),cause:checkpoint.tripCauses?.[fuse.id]})
    }
  }
  return {scenario:project.name,stages,trace}
}

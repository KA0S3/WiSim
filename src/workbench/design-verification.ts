import type {Frame,Project} from './model'
import {emptyState} from './model'

/** Check generated equipment under sunlight and battery-only startup before opening it. */
export async function verifyDesignedProject(project:Project):Promise<void>{
 const worker=new Worker(new URL('./simulation.worker.ts',import.meta.url),{type:'module'})
 try{
  for(const [index,sun] of [100,0].entries()){
   const frame=await new Promise<Frame>((resolve,reject)=>{
    worker.onmessage=({data})=>{
     if(data.requestId!==index+1)return
     if(data.type==='frame')resolve(data.frame)
     if(data.type==='error')reject(new Error(`Design calculation failed: ${data.error}`))
    }
    worker.onerror=event=>reject(new Error(event.message||'Design calculation worker failed.'))
    worker.postMessage({type:'run',project:{...project,sun},revision:0,requestId:index+1,checkpoint:emptyState(),seconds:.1})
   })
   const failures=frame.findings.filter(f=>f.severity==='fault'||f.id.startsWith('overload-')||f.id.startsWith('battery-limit-'))
   if(failures.length)throw new Error(`Design needs revision (${sun?'full sunlight':'battery-only startup'}): ${failures.map(f=>`${f.title}: ${f.detail}`).join(' ')}`)
  }
 }finally{worker.terminate()}
}

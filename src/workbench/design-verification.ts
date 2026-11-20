import type {Frame,Project,Requirements} from './model'
import {emptyState} from './model'
import {designSystem} from './templates'
import {arrayOptions} from './design-options'
import {resolvedRequirements} from './appliances'

/** Retry with complete, newly sized designs. Preserve user-selected equipment and limits. */
export async function buildVerifiedDesign(requirements:Requirements):Promise<Project>{
 let failure:unknown
 try{const first=designSystem(requirements);await verifyDesignedProject(first);return first}
 catch(error){failure=error}
 const resolved=resolvedRequirements(requirements)
 const alternatives:Requirements[]=[]
 if(resolved.priority!=='headroom')alternatives.push({...resolved,priority:'headroom'})
 if(!resolved.arrayOptionId){
  try{for(const option of arrayOptions(resolved).slice(1,4))alternatives.push({...resolved,arrayOptionId:option.id})}
  catch{throw failure}
 }
 for(const candidate of alternatives){
  try{
   const project=designSystem(candidate)
   await verifyDesignedProject(project)
   project.designNotes?.push('Auto design adjusted equipment sizing or string layout and verified the replacement under the same operating checks.')
   return project
  }catch(error){failure=error}
 }
 throw new Error(`Auto design could not produce a fault-free proposal within these requirements. ${failure instanceof Error?failure.message:String(failure)}`)
}

/** Check generated equipment under sunlight and battery-only startup before opening it. */
export async function verifyDesignedProject(project:Project):Promise<void>{
 const worker=new Worker(new URL('./simulation.worker.ts',import.meta.url),{type:'module'})
 try{
  const source=project.devices.find(d=>d.kind==='generator'||d.kind==='grid')
  const scenarios=[
   {name:'full sunlight',sun:100,input:true},
   {name:'battery-only startup',sun:0,input:false},
   ...(source?[{name:'AC input without sunlight',sun:0,input:true}]:[]),
  ]
  for(const [index,scenario] of scenarios.entries()){
   const {sun,input}=scenario
   const frame=await new Promise<Frame>((resolve,reject)=>{
    worker.onmessage=({data})=>{
     if(data.requestId!==index+1)return
     if(data.type==='frame')resolve(data.frame)
     if(data.type==='error')reject(new Error(`Design calculation failed: ${data.error}`))
    }
    worker.onerror=event=>reject(new Error(event.message||'Design calculation worker failed.'))
    const devices=input?project.devices:project.devices.map(d=>d.id===source?.id?{...d,on:false}:d)
    worker.postMessage({type:'run',project:{...project,sun,devices},revision:0,requestId:index+1,checkpoint:emptyState(),seconds:.1})
   })
   const failures=frame.findings.filter(f=>f.severity==='fault'||f.id.startsWith('overload-')||f.id.startsWith('battery-limit-'))
   if(failures.length)throw new Error(`Design needs revision (${scenario.name}): ${failures.map(f=>`${f.title}: ${f.detail}`).join(' ')}`)
   if(source&&input&&sun===0){
    const charger=project.devices.find(d=>d.kind==='charger')
    if(!charger||(frame.devices[charger.id]?.inputPower??0)<=0||(frame.devices[charger.id]?.power??0)<=0)
     throw new Error('The auxiliary AC source failed to deliver charging power. Review the input and battery connections.')
   }
  }
 }finally{worker.terminate()}
}

import {useEffect, useState} from 'react'
import type {Finding, Project} from './model'

export function useElectricalFingerprint(project: Project) {
  const [result,setResult]=useState<{project:Project;value:string}>()
  useEffect(()=>{
    let live=true
    const inputs = {
      devices: project.devices.map(({id,kind,model,spec,on,ports,schedule,batteryLimits,protection}) =>
        ({id,kind,model,spec,on,ports,schedule,batteryLimits,protection})),
      wires: project.wires.map(({color,reference,...wire})=>wire),
      engineering:project.engineering,ambient:project.ambient,sun:project.sun,initialSoc:project.initialSoc,
      solarSite:project.solarSite,scheduleHour:project.scheduleHour
    }
    if (globalThis.crypto?.subtle) {
      void crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(inputs))).then(buffer=>{
        if(live)setResult({project,value:Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('')})
      }).catch(()=>{})
    }
    return ()=>{live=false}
  },[project])
  return result?.project===project ? result.value : ''
}

export function ReviewNote({project,finding,fingerprint,onChange}:{project:Project;finding:Finding;fingerprint:string;onChange:(p:Project)=>void}) {
  const existing=project.diagnosticReviews?.find(r=>r.findingId===finding.id)
  const [note,setNote]=useState(existing?.note??'')
  useEffect(()=>setNote(existing?.note??''),[existing?.note])
  if(finding.severity==='fault')return null
  const current=!!existing && existing.fingerprint===fingerprint
  function save(remove:boolean) {
    const reviews=(project.diagnosticReviews??[]).filter(r=>r.findingId!==finding.id)
    if(!remove)reviews.push({findingId:finding.id,note:note.trim(),fingerprint})
    onChange({...project,diagnosticReviews:reviews})
  }
  return <details><summary>{existing?(current?'Reviewed advisory':'Review reopened'):'Add review note'}</summary>
    <label className="field">Review note<textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <button disabled={!note.trim()||!fingerprint} onClick={()=>save(false)}>Save review</button>
    {existing&&<button onClick={()=>save(true)}>Remove review</button>}
  </details>
}

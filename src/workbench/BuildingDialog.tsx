import {useState} from 'react'
import {BuildingEditor} from './BuildingEditor'
import {defaultBuilding} from './building-plan'
import type {BuildingLayout} from './building-model'
import type {Project} from './model'

export function BuildingDialog({project,onApply}:{project:Project;onApply:(layout:BuildingLayout,refit:boolean)=>void}) {
  const [layout,setLayout]=useState(()=>structuredClone(project.building??defaultBuilding(project.requirements?.context==='mobile'))),[refit,setRefit]=useState(false),[error,setError]=useState('')
  return <><h2>Design home/compartment</h2><BuildingEditor equipmentChoices={project.devices.filter(d=>d.kind!=='pv').map(d=>({key:d.applianceId?`appliance:${d.applianceId}`:d.id,label:d.name}))} value={layout} onChange={setLayout}/><label className="building-enable"><input type="checkbox" checked={refit} onChange={event=>setRefit(event.target.checked)}/>Refit existing equipment into the selected room and roof</label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="primary-button design-submit" onClick={()=>{try{onApply(layout,refit)}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}}}>Apply building{refit?' and refit equipment':''}</button></>
}

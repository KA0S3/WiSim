import { useEffect, useState } from 'react'
import type { Project, StructureKind, Triple } from './model'
import { makeStructure, mountDevice, removeStructure, rotateDevice, updateStructure } from './spatial'
import {ProfileNote} from './ProfileNote'

export function Value({label,value,onChange,min=-Infinity,max=Infinity}:{label:string;value:number;onChange:(v:number)=>void;min?:number;max?:number}) {
  const [text,setText]=useState(String(value))
  useEffect(()=>setText(String(Math.round(value*1e6)/1e6)),[value])
  return <label className="space-value"><span>{label}</span><input type="number" aria-label={label} min={Number.isFinite(min)?min:undefined} max={Number.isFinite(max)?max:undefined} step="any" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}} onBlur={()=>{const n=Number(text);if(text.trim()&&Number.isFinite(n)&&n>=min&&n<=max){if(Math.abs(n-value)>1e-10)onChange(n)}else setText(String(value))}}/></label>
}
const axisNames=['X','Y','Z']
function Coordinates({label,values,onChange,degrees=false,min}:{label:string;values:Triple;onChange:(p:Triple)=>void;degrees?:boolean;min?:number}) {
  return <div className="space-coordinates">{values.map((n,i)=><Value key={i} label={`${label} ${axisNames[i]}${degrees?' degrees':' metres'}`} value={degrees?n*180/Math.PI:n} min={min} onChange={v=>{const p=[...values] as Triple;p[i]=degrees?v*Math.PI/180:v;onChange(p)}}/>)}</div>
}
export function SpaceEditor({project,selected,onChange,onSelect}:{project:Project;selected:string|null;onChange:(p:Project)=>void;onSelect:(id:string|null)=>void}) {
  const structure=project.structures?.find(s=>s.id===selected),device=project.devices.find(d=>d.id===selected)
  return <><div className="physical-axes">{(['wall','roof','rail','box'] as StructureKind[]).map(kind=><button key={kind} title={`Add a ${kind}, then set its dimensions, angle and placement.`} onClick={()=>{const s=makeStructure(kind);onChange({...project,structures:[...(project.structures??[]),s]});onSelect(s.id)}}>Add {kind}</button>)}</div><details className="space-editor" open={!!structure}>
    <summary title="Attach equipment to a surface, set clearances, or edit the workspace geometry.">Workspace & mounting</summary>
    {structure&&<>
      <label>Name<input aria-label="Structure name" value={structure.name} onChange={e=>onChange(updateStructure(project,structure.id,{name:e.target.value}))}/></label>
      <p>Size X = width, Y = height, Z = depth. Position is the centre. Rotations use degrees.</p>
      <Coordinates label="Structure size" values={structure.size} min={.001} onChange={size=>onChange(updateStructure(project,structure.id,{size}))}/>
      <Coordinates label="Structure position" values={structure.position} onChange={position=>onChange(updateStructure(project,structure.id,{position}))}/>
      <Coordinates label="Structure rotation" values={structure.rotation} degrees onChange={rotation=>onChange(updateStructure(project,structure.id,{rotation}))}/>
      <button onClick={()=>{onChange(removeStructure(project,structure.id));onSelect(null)}}>Remove structure; keep equipment</button>
    </>}
    {device&&<>
      <ProfileNote device={device}/>
      <label>Mount to<select aria-label="Mount equipment to" value={device.mount?.structureId??''} onChange={e=>onChange(mountDevice(project,device.id,e.target.value||null))}><option value="">Freestanding</option>{project.structures?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {device.mount&&<>
        {project.structures?.find(s=>s.id===device.mount!.structureId)?.kind==='box'&&<label>Mount face<select aria-label="Mount face" value={device.mount.face} onChange={e=>onChange(mountDevice(project,device.id,device.mount!.structureId,e.target.value as 'front'|'inside'))}><option value="front">Front face</option><option value="inside">Inside back plane</option></select></label>}
        <p>Offsets are horizontal, vertical and clearance along the mounting face. Moving mounted equipment updates these offsets.</p>
        <Coordinates label="Mount offset" values={device.mount.offset} onChange={offset=>onChange({...project,devices:project.devices.map(d=>d.id===device.id?{...d,mount:{...device.mount!,offset}}:d)})}/>
      </>}
      <Coordinates label="Equipment rotation" degrees values={device.rotation??[0,0,0]} onChange={rotation=>onChange(rotateDevice(project,device.id,rotation))}/>
    </>}
    {!device&&!structure&&<p>Select equipment to attach it, or select a structure to edit dimensions and placement.</p>}
  </details></>
}

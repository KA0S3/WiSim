import { useId } from 'react'
import type { Frame, Project } from './model'
export function Scope({ frame, project, selected }: { frame: Frame | null; project: Project; selected: string | null }) {
  const clip=useId().replace(/:/g,'')
  const target = selected && frame?.waveforms[selected] ? selected : project.devices.find(d=>d.kind==='inverter')?.id ?? project.devices[0]?.id
  const values = frame?.waveforms[target] ?? [], times=frame?.times ?? [], min=Math.min(0,...values), max=Math.max(1,...values), range=max-min, span=(times[times.length-1]??.1)-(times[0]??0)
  const path=Array.from(values,(v,i)=>`${i?'L':'M'}${(12+((times[i]??0)-(times[0]??0))/span*506).toFixed(2)},${(12+(max-v)/range*66).toFixed(2)}`).join(' ')
  const wire=project.wires.find(w=>w.id===target), device=project.devices.find(d=>d.id===target),measurement=frame?.measurements?.[target]
  return <div className="scope"><div className="scope-head"><span><i/> LIVE TRACE</span><span>{device?.name ?? (wire ? 'Conductor current' : 'Select a device')} · {wire?'A':'V'}</span></div><svg viewBox="0 0 530 92" role="img" aria-label={`Calculated waveform for ${device?.name ?? 'selected conductor'}`} preserveAspectRatio="none"><defs><clipPath id={clip}><rect x="10" y="8" width="510" height="75"/></clipPath></defs>{[12,34,56,78].map(y=><path key={y} d={`M10 ${y}H520`} stroke="#dce2d9" strokeDasharray="2 5"/>)}{[12,112,212,312,412,518].map(x=><path key={x} d={`M${x} 10V80`} stroke="#e4e8e0"/>)}<path d={path} clipPath={`url(#${clip})`} stroke="#347b68" strokeWidth="1.6" fill="none"/><text x="16" y="20" fill="#8a9589" fontSize="8">{max.toFixed(0)}</text><text x="16" y="76" fill="#8a9589" fontSize="8">{min.toFixed(0)}</text></svg><div className="scope-foot"><span>{frame?'Solved transient samples':'Waiting for engine'}</span><span>{(span*1000).toFixed(0)} ms window{measurement?.ac?measurement.frequency?` / ${measurement.frequency} Hz`:' / mixed frequencies':''}</span></div></div>
}

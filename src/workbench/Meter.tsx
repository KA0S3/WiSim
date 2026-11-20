import { useMemo, useRef, useState } from 'react'
import { Gauge, GripHorizontal, X } from 'lucide-react'
import type { Frame, Project } from './model'
import { readMeter, type MeterMode, type Probe } from './instruments'

const modes: Array<[MeterMode, string]> = [
  ['voltage', 'Voltage · auto AC/DC'], ['dc-voltage', 'Voltage · DC'], ['ac-voltage', 'Voltage · AC component'],
  ['current', 'Conductor current · auto'], ['dc-current', 'Conductor current · DC'], ['ac-current', 'Conductor current · AC component'],
  ['frequency', 'Frequency'], ['power', 'Equipment power'], ['resistance', 'Resistance'], ['continuity', 'Continuity'],
]

type MeterPosition = {left:number;top:number}

export function Meter({ project, frame, probes, selected, onClose, onClear, onMeasure, position, onMove, concealed }: { project: Project; frame: Frame | null; probes: Probe[]; selected: string | null; onClose: () => void; onClear: () => void; onMeasure:(probes:Probe[])=>void; position: MeterPosition|null; onMove: (position: MeterPosition) => void; concealed: boolean }) {
  const [mode, setMode] = useState<MeterMode>('voltage')
  const [positive,setPositive]=useState('')
  const [negative,setNegative]=useState('')
  const terminals=useMemo(()=>project.devices.flatMap(device=>device.ports.map(port=>({
    key:JSON.stringify([device.id,port.id]),
    probe:{id:device.id,port:port.id},
    label:[device.reference,device.name,port.label].filter(Boolean).join(' / ')
  }))),[project.devices])
  const plus=terminals.find(terminal=>terminal.key===positive)
  const minus=terminals.find(terminal=>terminal.key===negative)
  const usesProbes=!mode.endsWith('current')&&mode!=='power'
  const result = useMemo(() => readMeter(project, frame, probes, selected, mode), [project, frame, probes, selected, mode])
  const panel=useRef<HTMLElement>(null)
  const drag=useRef<{x:number;y:number;rect:DOMRect}|null>(null)
  const move=(left:number,top:number)=>{
    const rect=panel.current?.getBoundingClientRect()
    if(rect)onMove({left:Math.max(0,Math.min(left,innerWidth-rect.width)),top:Math.max(0,Math.min(top,innerHeight-rect.height))})
  }
  return <section ref={panel} hidden={concealed} className={`meter-popover ${position?'meter-floating':'meter-docked'}`} style={position??undefined} aria-label="Multimeter">
    <div><Gauge size={17}/><strong>Multimeter</strong><button className="icon-button meter-grip" aria-label="Move multimeter" title="Drag to detach and move the multimeter" onPointerDown={event=>{if(event.button!==0||!panel.current)return;drag.current={x:event.clientX,y:event.clientY,rect:panel.current.getBoundingClientRect()};event.currentTarget.setPointerCapture(event.pointerId)}} onPointerMove={event=>{const start=drag.current;if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.hypot(dx,dy)>=4||position)move(start.rect.left+dx,start.rect.top+dy)}} onLostPointerCapture={()=>{drag.current=null}} onKeyDown={event=>{const offset:Record<string,[number,number]>={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]};const delta=offset[event.key],rect=panel.current?.getBoundingClientRect();if(delta&&rect){event.preventDefault();move(rect.left+delta[0],rect.top+delta[1])}}}><GripHorizontal size={17}/></button>{position&&<button className="icon-button" aria-label="Close voltmeter" onClick={onClose}><X size={14}/></button>}</div>
    {!position&&<button className="meter-probe-button secondary-button" onClick={()=>move(52,innerHeight)}>Place probes on schematic</button>}
    <label>Mode<select aria-label="Meter mode" value={mode} onChange={event => setMode(event.target.value as MeterMode)}>{modes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <output aria-live="off">{result.value === undefined ? '— — —' : result.value === Infinity ? 'OL' : `${result.value.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${result.unit}`}<small>{result.label}</small></output>
    <p>{result.detail}</p>
    {probes.map((probe, i) => <span key={i} className="probe-line"><i className={i ? 'negative' : ''}/>{project.devices.find(device => device.id === probe.id)?.name ?? 'Removed terminal'} · {probe.port}</span>)}
    {!!probes.length && <button className="text-link" onClick={onClear}>Clear probes</button>}
    {!position&&usesProbes&&<details>
      <summary>Choose probe terminals</summary>
      <label>Positive probe<select aria-label="Positive probe" value={plus?.key??''} onChange={event=>setPositive(event.target.value)}>
        <option value="">Choose a terminal</option>
        {terminals.map(terminal=><option key={terminal.key} value={terminal.key}>{terminal.label}</option>)}
      </select></label>
      <label>Negative probe<select aria-label="Negative probe" value={minus?.key??''} onChange={event=>setNegative(event.target.value)}>
        <option value="">Choose a terminal</option>
        {terminals.map(terminal=><option key={terminal.key} value={terminal.key}>{terminal.label}</option>)}
      </select></label>
      <button className="secondary-button" disabled={!plus||!minus||positive===negative} onClick={()=>{if(plus&&minus)onMeasure([plus.probe,minus.probe])}}>Measure selected terminals</button>
    </details>}
  </section>
}

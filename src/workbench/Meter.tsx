import { useMemo, useState } from 'react'
import { Gauge, X } from 'lucide-react'
import type { Frame, Project } from './model'
import { readMeter, type MeterMode, type Probe } from './instruments'

const modes: Array<[MeterMode, string]> = [
  ['voltage', 'Voltage · auto AC/DC'], ['dc-voltage', 'Voltage · DC'], ['ac-voltage', 'Voltage · AC component'],
  ['current', 'Conductor current · auto'], ['dc-current', 'Conductor current · DC'], ['ac-current', 'Conductor current · AC component'],
  ['frequency', 'Frequency'], ['power', 'Equipment power'], ['resistance', 'Resistance'], ['continuity', 'Continuity'],
]

export function Meter({ project, frame, probes, selected, onClose, onClear }: { project: Project; frame: Frame | null; probes: Probe[]; selected: string | null; onClose: () => void; onClear: () => void }) {
  const [mode, setMode] = useState<MeterMode>('voltage')
  const result = useMemo(() => readMeter(project, frame, probes, selected, mode), [project, frame, probes, selected, mode])
  return <section className="meter-popover" aria-label="Multimeter">
    <div><Gauge size={17}/><strong>Multimeter</strong><button className="icon-button" aria-label="Close voltmeter" onClick={onClose}><X size={14}/></button></div>
    <label>Mode<select aria-label="Meter mode" value={mode} onChange={event => setMode(event.target.value as MeterMode)}>{modes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <output aria-live="off">{result.value === undefined ? '— — —' : result.value === Infinity ? 'OL' : `${result.value.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${result.unit}`}<small>{result.label}</small></output>
    <p>{result.detail}</p>
    {probes.map((probe, i) => <span key={i} className="probe-line"><i className={i ? 'negative' : ''}/>{project.devices.find(device => device.id === probe.id)?.name ?? 'Removed terminal'} · {probe.port}</span>)}
    {!!probes.length && <button className="text-link" onClick={onClear}>Clear probes</button>}
  </section>
}

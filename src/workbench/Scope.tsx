import type { Frame, Project } from './model'

const tick = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 3 })

export function Scope({ frame, project, selected, running, onBack, onMinimize }: {
  frame: Frame | null
  project: Project
  selected: string | null
  onBack: () => void
  onMinimize?: () => void
  running: boolean
}) {
  const target = selected ?? project.devices.find(d => d.kind === 'inverter')?.id ?? project.devices[0]?.id
  const wire = project.wires.find(w => w.id === target)
  const device = project.devices.find(d => d.id === target)
  const unit = wire ? 'A' : 'V'
  const source = wire ? 'Conductor current' : device?.name ?? 'Select a device or cable'
  const values = target ? frame?.waveforms[target] : undefined
  const times = frame?.times
  const count = Math.min(values?.length ?? 0, times?.length ?? 0)
  const span = count ? times![count - 1] - times![0] : 0
  const plotted = count > 1 && span > 0
  let low = 0, high = 0
  for (let i = 0; i < count; i++) {
    low = Math.min(low, values![i])
    high = Math.max(high, values![i])
  }
  if (high === low) { high = 1; low = -1 }
  const y = (value: number) => 4 + 92 * (high - value) / (high - low)
  const points: string[] = []
  if (plotted) {
    for (let i = 0; i < count; i++) {
      points.push(`${(100 * (times![i] - times![0]) / span).toFixed(3)},${y(values![i]).toFixed(3)}`)
    }
  }
  const measurement = target ? frame?.measurements?.[target] : undefined
  return <div className="scope">
    <div className="scope-head"><span><i/>{running ? 'LIVE TRACE' : 'PAUSED TRACE'}</span><button className="trace-toggle" onClick={onBack}>Summary</button><span title={source}>{source}{(wire || device) && ` · ${unit}`}</span>{onMinimize&&<button className="scope-minimize" aria-label="Minimize waveform" title="Minimize waveform" onClick={onMinimize}>&minus;</button>}</div>
    <div className="trace-body">
      {plotted ? <>
        <div className="trace-scale"><span>{tick.format(high)}</span><span>{tick.format(low)}</span></div>
        <div className="trace-grid">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Calculated waveform for ${source}, axis ${tick.format(low)} to ${tick.format(high)} ${unit}`}>
            <path d={`M0 ${y(0)}H100`} className="trace-zero"/>
            <polyline points={points.join(' ')} className="trace-line"/>
          </svg>
        </div>
      </> : <span className="trace-empty">{frame ? 'Select equipment or a conductor to see its trace.' : 'Collecting samples…'}</span>}
    </div>
    <div className="scope-foot"><span>{plotted ? `${running ? 'Sampling' : 'Paused'} · ${frame!.time.toFixed(1)} s` : 'Waveform monitor'}</span>{plotted && <span>{tick.format(span * 1000)} ms window{measurement?.ac && (measurement.frequency ? ` / ${measurement.frequency} Hz` : ' / mixed frequencies')}</span>}{!frame && <span>Waiting for engine</span>}</div>
  </div>
}

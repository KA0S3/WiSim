import { measurementKey, measurementStart, measureBetween, timeAverage } from './measurements'
import { wireResistance, type Frame, type Project } from './model'

export type Probe = { id: string; port: string }
export type MeterMode = 'voltage' | 'dc-voltage' | 'ac-voltage' | 'current' | 'dc-current' | 'ac-current' | 'frequency' | 'power' | 'resistance' | 'continuity'
export type MeterResult = { value?: number; unit: string; label: string; detail: string }
type Edge = { a: string; b: string; resistance: number }
const probeKey = (probe: Probe) => measurementKey(probe.id, probe.port)
const sourceKinds = new Set(['battery', 'pv', 'grid', 'generator', 'three-phase', 'inverter', 'mppt', 'charger'])

/** A zero-mean AC component, retaining DC offset separately. */
export function acComponent(values: ArrayLike<number>, times: Frame['times'], begin: number): number {
  const samples = Array.from(values)
  const dc = timeAverage(samples, times, begin)
  return timeAverage(samples.map(value => value - dc), times, begin, true)
}

function reachable(edges: Edge[], start: string): Set<string> {
  const adjacency = new Map<string, string[]>()
  for (const { a, b } of edges) {
    adjacency.set(a, [...(adjacency.get(a) ?? []), b])
    adjacency.set(b, [...(adjacency.get(b) ?? []), a])
  }
  const seen = new Set([start]), queue = [start]
  for (let i = 0; i < queue.length; i++) for (const next of adjacency.get(queue[i]) ?? []) {
    if (!seen.has(next)) { seen.add(next); queue.push(next) }
  }
  return seen
}

/** Sparse, diagonally preconditioned DC nodal solve with a one-volt test source. */
function equivalentResistance(edges: Edge[], positive: string, negative: string): number | null {
  if (positive === negative) return 0
  const connected = reachable(edges, positive)
  if (!connected.has(negative)) return Infinity
  const nodes = [...connected].filter(key => key !== positive && key !== negative)
  const index = new Map(nodes.map((key, i) => [key, i]))
  const diagonal = new Float64Array(nodes.length), rhs = new Float64Array(nodes.length)
  const links: Array<{ a: number; b: number; conductance: number }> = []
  const relevant = edges.filter(edge => connected.has(edge.a) && connected.has(edge.b) && edge.a !== edge.b)
  for (const edge of relevant) {
    const conductance = 1 / Math.max(1e-7, edge.resistance), a = index.get(edge.a), b = index.get(edge.b)
    if (a !== undefined) { diagonal[a] += conductance; if (edge.b === positive) rhs[a] += conductance }
    if (b !== undefined) { diagonal[b] += conductance; if (edge.a === positive) rhs[b] += conductance }
    if (a !== undefined && b !== undefined) links.push({ a, b, conductance })
  }
  const multiply = (values: Float64Array) => {
    const result = diagonal.map((value, i) => value * values[i])
    for (const { a, b, conductance } of links) { result[a] -= conductance * values[b]; result[b] -= conductance * values[a] }
    return result
  }
  const dot = (a: Float64Array, b: Float64Array) => a.reduce((sum, value, i) => sum + value * b[i], 0)
  const voltage = new Float64Array(nodes.length), residual = rhs.slice()
  let preconditioned = residual.map((value, i) => value / diagonal[i]), direction = preconditioned.slice()
  let product = dot(residual, preconditioned)
  const threshold = Math.max(1e-24, dot(rhs, rhs) * 1e-24)
  let iterations = 0
  while (dot(residual, residual) > threshold && iterations++ < Math.max(100, nodes.length * 20)) {
    const action = multiply(direction), denominator = dot(direction, action)
    if (!(denominator > 0)) return null
    const step = product / denominator
    for (let i = 0; i < nodes.length; i++) { voltage[i] += step * direction[i]; residual[i] -= step * action[i] }
    preconditioned = residual.map((value, i) => value / diagonal[i])
    const next = dot(residual, preconditioned), beta = next / product
    direction = preconditioned.map((value, i) => value + beta * direction[i]); product = next
  }
  const error = multiply(voltage).map((value, i) => value - rhs[i])
  if (dot(error, error) > Math.max(1e-18, dot(rhs, rhs) * 1e-18)) return null
  const potential = (key: string) => key === positive ? 1 : key === negative ? 0 : voltage[index.get(key)!]
  let current = 0
  for (const edge of relevant) {
    if (edge.a === positive) current += (1 - potential(edge.b)) / Math.max(1e-7, edge.resistance)
    else if (edge.b === positive) current += (1 - potential(edge.a)) / Math.max(1e-7, edge.resistance)
  }
  return current > 0 && Number.isFinite(current) ? 1 / current : null
}

export function resistanceBetween(project: Project, probes: Probe[], frame: Frame | null): MeterResult {
  const unavailable = (detail: string): MeterResult => ({ unit: 'Ω', label: 'RESISTANCE UNAVAILABLE', detail })
  if (probes.length !== 2) return unavailable('Select two terminals on a de-energised circuit.')
  if (probes.some(probe => !project.devices.find(device => device.id === probe.id)?.ports.some(port => port.id === probe.port))) return unavailable('A probe terminal was removed. Select two terminals again.')
  const edges: Edge[] = project.wires.map(wire => ({ a: measurementKey(wire.from, wire.fromPort), b: measurementKey(wire.to, wire.toPort), resistance: wireResistance(wire, project.ambient) }))
  const grounds = project.devices.filter(device => device.kind === 'ground' && device.on)
  for (const ground of grounds.slice(1)) edges.push({ a: measurementKey(grounds[0].id, 'p'), b: measurementKey(ground.id, 'p'), resistance: 1e-7 })
  const hazards = [...edges]
  for (const device of project.devices) {
    const ports = device.ports.filter(p=>p.domain!=='earth'||device.kind==='ground').map(port => measurementKey(device.id, port.id))
    // All equipment sides participate in hazard discovery, including nonlinear
    // elements. An open switch remains an actual isolation point.
    if (device.on || ['capacitor', 'inductor', 'motor', 'charger'].includes(device.kind)) {
      for (const port of ports.slice(1)) hazards.push({ a: ports[0], b: port, resistance: 1 })
    }
    if (!device.on || frame?.devices[device.id]?.state === 'tripped') continue
    const pair = (resistance: number) => edges.push({ a: ports[0], b: ports[1], resistance })
    if (['resistor', 'switch', 'fuse', 'inductor'].includes(device.kind)) pair(Math.max(1e-6, device.spec.resistance))
    if (['load', 'dc-load'].includes(device.kind)) pair(Math.max(.001, device.spec.voltage ** 2 / Math.max(1, device.spec.watts)))
    if (device.kind === 'bus') for (const port of ports.slice(1)) edges.push({ a: ports[0], b: port, resistance: Math.max(1e-6, device.spec.resistance) })
  }
  const affected = new Set([...reachable(hazards, probeKey(probes[0])), ...reachable(hazards, probeKey(probes[1]))])
  for (const device of project.devices) {
    if (!device.ports.some(port => affected.has(measurementKey(device.id, port.id)))) continue
    if (device.on && frame?.devices[device.id]?.state !== 'tripped' && sourceKinds.has(device.kind)) return unavailable(`Isolate ${device.name} before using resistance or continuity. Pausing simulation leaves sources connected.`)
    if (['capacitor', 'inductor', 'motor', 'charger'].includes(device.kind)) {
      const reading = frame?.devices[device.id]
      if (!reading) return unavailable(`Stored energy in ${device.name} is unverified. Obtain a current solved frame after isolating and discharging it.`)
      if (reading.storedEnergyJ === undefined || reading.storedEnergyJ > 1e-9) return unavailable(`Discharge and verify stored energy in ${device.name} before measuring resistance.`)
    }
    if (device.on && ['diode', 'motor'].includes(device.kind)) return unavailable(`${device.name} has a nonlinear or dynamic path. Isolate it to measure the linear DC network.`)
  }
  const value = equivalentResistance(edges, probeKey(probes[0]), probeKey(probes[1]))
  if (value === null) return unavailable('The passive network could not be resolved within numerical tolerance.')
  return { value, unit: 'Ω', label: value === Infinity ? 'OPEN CIRCUIT' : 'DC TEST RESISTANCE', detail: 'Includes saved conductor/contact resistance, linear loads, closed switches/fuses and inductor winding resistance. Discharged capacitors are open at DC.' }
}

export function readMeter(project: Project, frame: Frame | null, probes: Probe[], selected: string | null, mode: MeterMode): MeterResult {
  if (mode === 'resistance' || mode === 'continuity') {
    const result = resistanceBetween(project, probes, frame)
    if (mode === 'continuity' && result.value !== undefined) return { ...result, label: result.value <= 30 ? 'CONTINUITY ≤ 30 Ω' : 'NO CONTINUITY > 30 Ω' }
    return result
  }
  if (!frame) return { unit: '', label: 'WAITING FOR SOLUTION', detail: 'A current solved frame is needed for this reading.' }
  if (['current', 'dc-current', 'ac-current'].includes(mode)) {
    const wire = project.wires.find(item => item.id === selected), values = wire && frame.waveforms[wire.id]
    if (!wire || !values) return { unit: 'A', label: 'SELECT CONDUCTOR', detail: 'Select a conductor in the workbench. Signed DC current follows its saved From → To direction.' }
    const measurement = frame.measurements?.[wire.id] ?? { ac: false, frequency: null }, begin = measurementStart(frame.times, measurement)
    const ac = mode === 'ac-current' || mode === 'current' && measurement.ac
    const value = mode === 'ac-current' ? acComponent(values, frame.times, begin) : timeAverage(values, frame.times, begin, ac)
    return { value, unit: 'A', label: ac ? 'AC RMS' : 'SIGNED DC', detail: `${wire.reference ?? wire.id} · From → To. ${mode === 'ac-current' ? 'DC offset removed.' : 'Measured branch current.'}` }
  }
  if (mode === 'power') {
    const device = project.devices.find(item => item.id === selected), reading = device && frame.devices[device.id]
    if (!device || !reading) return { unit: 'W', label: 'SELECT EQUIPMENT', detail: 'Select equipment to measure average instantaneous voltage × current at its primary measured side.' }
    return { value: reading.power, unit: 'W', label: 'ACTIVE POWER', detail: `${device.name}. Positive values indicate source output or load absorption. Converter primary readings use their output side. Input power is available in Live readings.` }
  }
  if (probes.length !== 2) return { unit: mode === 'frequency' ? 'Hz' : 'V', label: 'SELECT TERMINALS', detail: 'Choose two terminals in Schematic or Terminal detail.' }
  const [left, right] = probes.map(probeKey), a = frame.waveforms[left], b = frame.waveforms[right]
  if (!a || !b) return { unit: '', label: 'SELECT TERMINALS', detail: 'A probe terminal was removed or has no solved samples.' }
  const lm = frame.measurements?.[left] ?? { ac: false, frequency: null }, rm = frame.measurements?.[right] ?? { ac: false, frequency: null }
  const measured = measureBetween(a, b, frame.times, lm, rm)
  const delta = a.map((value, i) => value - b[i])
  const begin = measured.begin
  if (mode === 'frequency') {
    const frequencyBegin = frame.times[0] ?? 0
    const crossings: number[] = [], mean = timeAverage(delta, frame.times, frequencyBegin)
    const amplitude = acComponent(delta, frame.times, begin)
    if (amplitude > .01) for (let i = 1; i < delta.length; i++) {
      if (frame.times[i - 1] >= frequencyBegin && delta[i - 1] < mean && delta[i] >= mean) crossings.push(frame.times[i - 1] + (mean - delta[i - 1]) / (delta[i] - delta[i - 1]) * (frame.times[i] - frame.times[i - 1]))
    }
    const period = crossings.length >= 2 ? (crossings.at(-1)! - crossings[0]) / (crossings.length - 1) : 0
    const stable = period > 0 && crossings.slice(1).every((crossing, i) => Math.abs(crossing - crossings[i] - period) < period * .02)
    const value = stable ? 1 / period : undefined
    return { value, unit: 'Hz', label: value === undefined ? 'NO RESOLVED PERIOD' : 'MEASURED FREQUENCY', detail: 'Interpolated rising zero crossings after removing DC offset. Requires two crossings. Distortion or mixed sources can prevent a stable reading.' }
  }
  const value = mode === 'dc-voltage' ? timeAverage(delta, frame.times, begin) : mode === 'ac-voltage' ? acComponent(delta, frame.times, begin) : measured.value
  return { value, unit: 'V', label: mode === 'dc-voltage' ? 'SIGNED DC' : mode === 'ac-voltage' || measured.ac ? 'AC RMS' : 'SIGNED DC', detail: mode === 'ac-voltage' ? 'AC component with DC offset removed.' : 'Voltage between the first and reference probe.' }
}

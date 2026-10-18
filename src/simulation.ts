export type SimulationNode = {
  id: string
  kind: 'pv' | 'battery' | 'mppt' | 'inverter' | 'load' | 'cable' | 'fuse' | 'bus' | 'ac-source' | 'transfer'
  name: string
  watts?: number
  voltage?: number
  capacity?: number
  area?: number
  length?: number
  surge?: number
  chargeLimit?: number
  dischargeLimit?: number
  chemistry?: 'LiFePO4' | 'lead-acid'
  powerFactor?: number
  x: number
  y: number
  modelId?: string
  terminals?: Terminal[]
  acProfile?: ACProfileId
  enabled?: boolean
  tripped?: boolean
  resettable?: boolean
  switchState?: 'open' | 'closed'
}

export type TerminalDomain = 'dc' | 'ac' | 'data' | 'earth'
export type TerminalRole = 'positive' | 'negative' | 'pv' | 'ac-line' | 'ac-neutral' | 'ac-earth' | 'phase-a' | 'phase-b' | 'phase-c' | 'control'
export type Terminal = { id: string; label: string; domain: TerminalDomain; role: TerminalRole; direction?: 'source' | 'sink' | 'bidirectional'; x?: number; y?: number }
export type ACProfileId = '120v-60hz' | '230v-50hz' | 'split-120-240v-60hz' | 'three-phase-400v-50hz'
export type ACProfile = { id: ACProfileId; label: string; voltage: number; frequency: number; phases: 1 | 2 | 3; terminals: TerminalRole[] }
export const AC_PROFILES: Record<ACProfileId, ACProfile> = {
  '120v-60hz': { id: '120v-60hz', label: '120 V / 60 Hz single-phase', voltage: 120, frequency: 60, phases: 1, terminals: ['ac-line', 'ac-neutral', 'ac-earth'] },
  '230v-50hz': { id: '230v-50hz', label: '230 V / 50 Hz single-phase', voltage: 230, frequency: 50, phases: 1, terminals: ['ac-line', 'ac-neutral', 'ac-earth'] },
  'split-120-240v-60hz': { id: 'split-120-240v-60hz', label: '120/240 V / 60 Hz split-phase', voltage: 240, frequency: 60, phases: 2, terminals: ['phase-a', 'phase-b', 'ac-neutral', 'ac-earth'] },
  'three-phase-400v-50hz': { id: 'three-phase-400v-50hz', label: '400 V / 50 Hz three-phase', voltage: 400, frequency: 50, phases: 3, terminals: ['phase-a', 'phase-b', 'phase-c', 'ac-neutral', 'ac-earth'] },
}

export type SimulationProject = {
  nodes: SimulationNode[]
  wires: Array<{ id: string; from: string; to: string; fromTerminal?: string; toTerminal?: string; domain?: TerminalDomain; gauge?: number; material?: 'copper' | 'aluminium'; length?: number; parallel?: number; insulation?: string; color?: string; label?: string; lugFrom?: string; lugTo?: string; points?: Array<{ x: number; y: number }> }>
  irradiance: number
  temperature: number
  ambientTemperature?: number
  acSourceVoltage?: number
  acSourceFrequency?: number
  acProfile?: ACProfileId
  probes?: Array<{ id: string; positive: { nodeId: string; terminalId: string }; negative?: { nodeId: string; terminalId: string }; mode: 'voltage' | 'current' | 'resistance' | 'continuity' }>
  scenario?: { id: string; baseProjectId?: string }
  lesson?: { id: string; baseProjectId?: string }
  events?: Array<{ id: string; signature: string; timestamp: number; severity: 'info' | 'warning' | 'fault'; title: string; evidence: string; remedy: string }>
}

export type ModelValidation = { valid: boolean; errors: string[]; warnings: string[] }

export function defaultTerminals(kind: SimulationNode['kind']): Terminal[] {
  const terminal = (id: string, label: string, domain: TerminalDomain, role: TerminalRole, direction?: Terminal['direction']): Terminal => ({ id, label, domain, role, direction })
  switch (kind) {
    case 'pv': return [terminal('pv+', 'PV +', 'dc', 'pv', 'source'), terminal('pv-', 'PV −', 'dc', 'negative', 'source')]
    case 'battery': return [terminal('bat+', 'BAT +', 'dc', 'positive', 'bidirectional'), terminal('bat-', 'BAT −', 'dc', 'negative', 'bidirectional')]
    case 'mppt': return [terminal('pv+', 'PV +', 'dc', 'pv', 'sink'), terminal('pv-', 'PV −', 'dc', 'negative', 'sink'), terminal('bat+', 'BAT +', 'dc', 'positive', 'source'), terminal('bat-', 'BAT −', 'dc', 'negative', 'source')]
    case 'inverter': return [terminal('dc+', 'DC +', 'dc', 'positive', 'bidirectional'), terminal('dc-', 'DC −', 'dc', 'negative', 'bidirectional'), terminal('ac-in-l', 'AC IN L', 'ac', 'ac-line', 'sink'), terminal('ac-in-n', 'AC IN N', 'ac', 'ac-neutral', 'sink'), terminal('ac-in-a', 'AC IN A', 'ac', 'phase-a', 'sink'), terminal('ac-in-b', 'AC IN B', 'ac', 'phase-b', 'sink'), terminal('ac-in-c', 'AC IN C', 'ac', 'phase-c', 'sink'), terminal('ac-out-l', 'AC OUT L', 'ac', 'ac-line', 'source'), terminal('ac-out-n', 'AC OUT N', 'ac', 'ac-neutral', 'source'), terminal('ac-out-a', 'AC OUT A', 'ac', 'phase-a', 'source'), terminal('ac-out-b', 'AC OUT B', 'ac', 'phase-b', 'source'), terminal('ac-out-c', 'AC OUT C', 'ac', 'phase-c', 'source'), terminal('pe', 'PE', 'earth', 'ac-earth', 'bidirectional'), terminal('control', 'Control', 'data', 'control', 'bidirectional')]
    case 'load': return [terminal('line', 'L', 'ac', 'ac-line', 'sink'), terminal('neutral', 'N', 'ac', 'ac-neutral', 'sink'), terminal('phase-a', 'Phase A', 'ac', 'phase-a', 'sink'), terminal('phase-b', 'Phase B', 'ac', 'phase-b', 'sink'), terminal('phase-c', 'Phase C', 'ac', 'phase-c', 'sink'), terminal('earth', 'PE', 'earth', 'ac-earth', 'sink')]
    case 'cable': return [terminal('in', 'IN', 'dc', 'positive', 'bidirectional'), terminal('out', 'OUT', 'dc', 'positive', 'bidirectional')]
    case 'fuse': return [terminal('line-in', 'LINE IN', 'dc', 'positive', 'sink'), terminal('line-out', 'LINE OUT', 'dc', 'positive', 'source')]
    case 'bus': return [terminal('bus+', 'BUS +', 'dc', 'positive', 'bidirectional'), terminal('bus-', 'BUS −', 'dc', 'negative', 'bidirectional')]
    case 'ac-source': return [terminal('line', 'SOURCE L', 'ac', 'ac-line', 'source'), terminal('neutral', 'SOURCE N', 'ac', 'ac-neutral', 'source'), terminal('earth', 'PE', 'earth', 'ac-earth', 'bidirectional')]
    case 'transfer': return [terminal('in-line', 'IN L', 'ac', 'ac-line', 'sink'), terminal('in-neutral', 'IN N', 'ac', 'ac-neutral', 'sink'), terminal('out-line', 'OUT L', 'ac', 'ac-line', 'source'), terminal('out-neutral', 'OUT N', 'ac', 'ac-neutral', 'source'), terminal('earth', 'PE', 'earth', 'ac-earth', 'bidirectional')]
  }
}

export function validateProjectModel(project: SimulationProject): ModelValidation {
  const errors: string[] = [], warnings: string[] = [], terminalKeys = new Set<string>()
  const nodes = new Map(project.nodes.map(node => [node.id, node]))
  for (const node of project.nodes) {
    const terminals = node.terminals ?? defaultTerminals(node.kind)
    for (const terminal of terminals) {
      const key = `${node.id}:${terminal.id}`
      if (terminalKeys.has(key)) errors.push(`Duplicate terminal ID ${key}`)
      terminalKeys.add(key)
    }
  }
  const openNodes = new Set(project.nodes.filter(node => (node.kind === 'transfer' && node.switchState === 'open') || (node.kind === 'fuse' && node.tripped)).map(node => node.id))
  for (const wire of project.wires) {
    if (!nodes.has(wire.from) || !nodes.has(wire.to) || wire.from === wire.to) { errors.push(`Wire ${wire.id} has invalid endpoints`); continue }
    if (!wire.fromTerminal && !wire.toTerminal) continue
    const fromNode = nodes.get(wire.from)!, toNode = nodes.get(wire.to)!
    if (openNodes.has(fromNode.id) || openNodes.has(toNode.id)) { warnings.push(`Wire ${wire.id} is behind an open protection or transfer device`); continue }
    const from = (fromNode.terminals ?? defaultTerminals(fromNode.kind)).find(t => t.id === (wire.fromTerminal ?? (fromNode.kind === 'pv' ? 'pv+' : 'out')))
    const to = (toNode.terminals ?? defaultTerminals(toNode.kind)).find(t => t.id === (wire.toTerminal ?? (toNode.kind === 'load' ? 'line' : 'in')))
    if (!from || !to) { errors.push(`Wire ${wire.id} references a missing terminal`); continue }
    if (from.domain !== to.domain && !(from.domain === 'earth' && to.domain === 'ac')) errors.push(`Wire ${wire.id} joins ${from.domain} to ${to.domain}`)
    const samePolarity = (from.role === 'positive' || from.role === 'pv') && (to.role === 'positive' || to.role === 'pv') || from.role === 'negative' && to.role === 'negative' || from.role === 'ac-line' && ['ac-line', 'phase-a', 'phase-b', 'phase-c'].includes(to.role) || ['phase-a', 'phase-b', 'phase-c'].includes(from.role) && to.role === 'ac-line' || ['phase-a', 'phase-b', 'phase-c'].includes(from.role) && from.role === to.role || from.role === 'ac-neutral' && to.role === 'ac-neutral' || from.role === 'ac-earth' && to.role === 'ac-earth'
    const dcPolarityShort = from.domain === 'dc' && to.domain === 'dc' && (((from.role === 'positive' || from.role === 'pv') && to.role === 'negative') || (from.role === 'negative' && (to.role === 'positive' || to.role === 'pv')))
    const acPolarityShort = from.domain === 'ac' && to.domain === 'ac' && ((from.role === 'ac-line' && ['ac-neutral', 'phase-a', 'phase-b', 'phase-c'].includes(to.role)) || (to.role === 'ac-line' && ['ac-neutral', 'phase-a', 'phase-b', 'phase-c'].includes(from.role)) || (['phase-a', 'phase-b', 'phase-c'].includes(from.role) && ['ac-neutral', 'phase-a', 'phase-b', 'phase-c'].includes(to.role) && from.role !== to.role))
    if (dcPolarityShort) errors.push(`Wire ${wire.id} creates a DC polarity short: incompatible terminal roles ${from.role} and ${to.role}`)
    else if (acPolarityShort) errors.push(`Wire ${wire.id} creates an AC conductor short: incompatible terminal roles ${from.role} and ${to.role}`)
    else if (from.domain === to.domain && from.domain !== 'data' && !samePolarity) errors.push(`Wire ${wire.id} connects incompatible terminal roles ${from.role} and ${to.role}`)
    if (from.direction === 'sink' && to.direction === 'sink') warnings.push(`Wire ${wire.id} joins two sink terminals`)
    if (from.direction === 'source' && to.direction === 'source') warnings.push(`Wire ${wire.id} joins two source terminals`)
    if (from.role === 'control' || to.role === 'control') warnings.push(`Wire ${wire.id} is a control/data link; no power is calculated`)
  }
  if (project.acProfile && !AC_PROFILES[project.acProfile]) errors.push(`Unsupported AC profile ${project.acProfile}`)
  return { valid: errors.length === 0, errors, warnings }
}

export type DiagnosticEvent = {
  id: string
  severity: 'info' | 'warning' | 'fault'
  title: string
  evidence: string
  remedy: string
}

export type SimulationResult = {
  runtimeSeconds: number
  pvPower: number
  demand: number
  inputPower: number
  batteryCurrent: number
  coldVoc: number
  voltageDrop: number
  cableLoss: number
  soc: number
  overload: boolean
  charging: boolean
  controllerLimited: boolean
  topologyValid: boolean
  surgeDemand: number
  thermalEstimate: number
  protectionTripped: boolean
  protectionTripSeconds: number | null
  batteryLimited: boolean
  chargingLimited: boolean
  chargeCurrent: number
  acPowerFactor: number
  apparentPower: number
  acCurrent: number
  acSourceCompatible: boolean
  branchCurrents: Record<string, number>
  busCurrents: Record<string, { total: number; branches: Record<string, number> }>
  diagnostics: DiagnosticEvent[]
  network: TerminalNetworkResult
}

export type TerminalReading = { voltage: number; current: number; state: 'energized' | 'open' | 'fault' | 'unsupported' }
export type TerminalNetworkResult = { activePaths: string[]; openTerminals: string[]; terminalReadings: Record<string, TerminalReading>; deviceStates: Record<string, 'idle' | 'charging' | 'inverting' | 'overload' | 'low-voltage' | 'fault' | 'unsupported'>; unsupported: string[] }

function solveTerminalNetwork(project: SimulationProject, values: { batteryVoltage: number; batteryCurrent: number; acVoltage: number; acCurrent: number; overload: boolean }): TerminalNetworkResult {
  const nodeMap = new Map(project.nodes.map(node => [node.id, node])); const terminals = new Map<string, Terminal>(); const adjacent = new Map<string, string[]>(); const activePaths: string[] = []; const openTerminals: string[] = []; const unsupported: string[] = []
  const openNodes = new Set(project.nodes.filter(node => (node.kind === 'transfer' && node.switchState === 'open') || (node.kind === 'fuse' && node.tripped)).map(node => node.id))
  for (const node of project.nodes) for (const terminal of node.terminals ?? defaultTerminals(node.kind)) { const key = `${node.id}:${terminal.id}`; terminals.set(key, terminal); adjacent.set(key, []) }
  const endpoint = (nodeId: string, terminalId: string | undefined, fallback: string) => `${nodeId}:${terminalId ?? fallback}`
  for (const wire of project.wires) {
    if (!wire.fromTerminal && !wire.toTerminal) continue
    const fromKey = endpoint(wire.from, wire.fromTerminal, 'out'), toKey = endpoint(wire.to, wire.toTerminal, 'in')
    if (!terminals.has(fromKey) || !terminals.has(toKey)) continue
    if (openNodes.has(wire.from) || openNodes.has(wire.to)) continue
    adjacent.get(fromKey)!.push(toKey); adjacent.get(toKey)!.push(fromKey); activePaths.push(wire.id)
  }
  for (const [key, terminal] of terminals) if (!adjacent.get(key)?.length) openTerminals.push(key)
  const profile = project.acProfile ? AC_PROFILES[project.acProfile] : undefined
  if (profile && profile.phases > 1) for (const node of project.nodes.filter(node => node.kind === 'inverter' || node.kind === 'load')) {
    const roles = new Map<TerminalRole, string[]>(); for (const terminal of node.terminals ?? defaultTerminals(node.kind)) roles.set(terminal.role, [...(roles.get(terminal.role) ?? []), `${node.id}:${terminal.id}`])
    const attached = (role: TerminalRole) => (roles.get(role) ?? []).some(key => Boolean(adjacent.get(key)?.length))
    if (profile.phases === 2 && (!attached('phase-a') || !attached('phase-b'))) unsupported.push(`${node.name} needs wired split-phase A/B terminals`)
    if (profile.phases === 3 && (!attached('phase-a') || !attached('phase-b') || !attached('phase-c'))) unsupported.push(`${node.name} needs wired three-phase A/B/C terminals`)
  }
  const terminalReadings: Record<string, TerminalReading> = {}
  for (const [key, terminal] of terminals) {
    const energized = (terminal.domain === 'dc' && terminal.role !== 'negative') || (terminal.domain === 'ac' && terminal.role !== 'ac-neutral')
    const voltage = terminal.domain === 'ac' ? (terminal.role === 'ac-neutral' ? 0 : profile?.phases === 2 ? 120 : profile?.phases === 3 && ['phase-a', 'phase-b', 'phase-c'].includes(terminal.role) ? Number((profile.voltage / Math.sqrt(3)).toFixed(1)) : values.acVoltage) : terminal.role === 'negative' ? 0 : values.batteryVoltage
    terminalReadings[key] = { voltage, current: terminal.domain === 'ac' ? values.acCurrent : values.batteryCurrent, state: unsupported.length ? 'unsupported' : energized && !openTerminals.includes(key) ? 'energized' : 'open' }
  }
  const deviceStates: TerminalNetworkResult['deviceStates'] = {}
  for (const node of project.nodes) {
    const nodeReadings = Object.entries(terminalReadings).filter(([key]) => key.startsWith(`${node.id}:`))
    const hasFault = nodeReadings.some(([, reading]) => reading.state === 'fault')
    deviceStates[node.id] = openNodes.has(node.id) ? 'fault' : hasFault ? 'fault' : unsupported.length && (node.kind === 'inverter' || node.kind === 'load') ? 'unsupported' : node.kind === 'inverter' && values.overload ? 'overload' : node.kind === 'inverter' && values.batteryVoltage < 11 ? 'low-voltage' : node.kind === 'inverter' ? 'inverting' : node.kind === 'battery' && values.batteryCurrent < 0 ? 'charging' : 'idle'
  }
  return { activePaths, openTerminals, terminalReadings, deviceStates, unsupported }
}

export type ProbeReading = { supported: boolean; value: number | null; unit: 'V' | 'A' | 'Ω' | 'continuity'; polarity: 'positive' | 'negative' | 'ambiguous'; explanation: string }

export function measureProbe(project: SimulationProject, result: SimulationResult, probe: NonNullable<SimulationProject['probes']>[number]): ProbeReading {
  const positiveNode = project.nodes.find(node => node.id === probe.positive.nodeId)
  const negativeNode = probe.negative ? project.nodes.find(node => node.id === probe.negative!.nodeId) : undefined
  const positiveTerminal = positiveNode && (positiveNode.terminals ?? defaultTerminals(positiveNode.kind)).find(terminal => terminal.id === probe.positive.terminalId)
  const negativeTerminal = negativeNode && probe.negative && (negativeNode.terminals ?? defaultTerminals(negativeNode.kind)).find(terminal => terminal.id === probe.negative!.terminalId)
  if (!positiveNode || !positiveTerminal || (probe.negative && (!negativeNode || !negativeTerminal))) return { supported: false, value: null, unit: probe.mode === 'continuity' ? 'continuity' : probe.mode === 'resistance' ? 'Ω' : probe.mode === 'current' ? 'A' : 'V', polarity: 'ambiguous', explanation: 'The probe references a missing node or terminal.' }
  const unit = probe.mode === 'continuity' ? 'continuity' : probe.mode === 'resistance' ? 'Ω' : probe.mode === 'current' ? 'A' : 'V'
  if (probe.mode === 'continuity') {
    const connected = project.wires.some(wire => (wire.from === probe.positive.nodeId && wire.fromTerminal === probe.positive.terminalId) || (wire.to === probe.positive.nodeId && wire.toTerminal === probe.positive.terminalId))
    return { supported: true, value: connected ? 1 : 0, unit, polarity: 'ambiguous', explanation: connected ? 'The selected terminal participates in a modeled connection.' : 'The selected terminal is open.' }
  }
  if (probe.mode === 'resistance') return { supported: true, value: result.cableLoss > 0 ? result.voltageDrop / Math.max(result.batteryCurrent, 0.001) : 0, unit, polarity: 'ambiguous', explanation: 'Resistance is the modeled positive/return conductor resistance, not a physical meter reading.' }
  if (probe.mode === 'current') return { supported: true, value: positiveTerminal.domain === 'ac' ? result.acCurrent : result.batteryCurrent, unit, polarity: 'positive', explanation: positiveTerminal.domain === 'ac' ? 'Current uses the live AC apparent-power estimate.' : 'Current uses the live DC constant-power estimate.' }
  const voltage = positiveTerminal.domain === 'ac' ? (project.acSourceVoltage ?? 230) : positiveNode.kind === 'battery' ? (positiveNode.voltage ?? 12.8) : positiveNode.kind === 'pv' ? (positiveNode.voltage ?? 36) : positiveTerminal.role === 'negative' ? 0 : (positiveNode.voltage ?? 12.8)
  const reference = negativeTerminal?.role === 'negative' || negativeTerminal?.role === 'ac-neutral' || negativeTerminal?.role === 'ac-earth' ? 0 : 0
  return { supported: true, value: voltage - reference, unit, polarity: voltage >= 0 ? 'positive' : 'negative', explanation: 'Voltage is calculated from the same live terminal model used by the inspector.' }
}

const find = (project: SimulationProject, kind: SimulationNode['kind']) => project.nodes.find(node => node.kind === kind)
const findMany = (project: SimulationProject, kind: SimulationNode['kind']) => project.nodes.filter(node => node.kind === kind)

/** A deterministic educational model. It intentionally reports assumptions via diagnostics. */
export function calculateSimulation(project: SimulationProject, runtimeSeconds = 0): SimulationResult {
  const modelValidation = validateProjectModel(project)
  const pvs = findMany(project, 'pv')
  const battery = find(project, 'battery')
  const inverter = find(project, 'inverter')
  const loads = findMany(project, 'load')
  const controller = find(project, 'mppt')
  const cable = find(project, 'cable')
  const fuse = find(project, 'fuse')
  const pvPower = pvs.reduce((total, pv) => total + (pv.watts ?? 0) * (project.irradiance / 100) * Math.max(0.55, 1 - (project.temperature - 25) * 0.003), 0)
  const demand = loads.reduce((total, load) => total + (load.watts ?? 0), 0)
  const inputPower = demand / 0.91
  const acPowerFactor = Math.min(1, Math.max(0.5, loads.length ? (loads.reduce((total, load) => total + (load.powerFactor ?? 0.95), 0) / loads.length) : 0.95))
  const apparentPower = demand / acPowerFactor
  const acSourceVoltage = project.acSourceVoltage ?? 230
  const acSourceFrequency = project.acSourceFrequency ?? 50
  const acCurrent = apparentPower / Math.max(1, acSourceVoltage)
  const profile = project.acProfile ? AC_PROFILES[project.acProfile] : undefined
  const acSourceCompatible = profile ? Math.abs(acSourceVoltage - profile.voltage) <= profile.voltage * 0.1 && acSourceFrequency === profile.frequency : acSourceVoltage >= 207 && acSourceVoltage <= 253 && (acSourceFrequency === 50 || acSourceFrequency === 60)
  const batteryVoltage = Math.max(10.5, battery?.voltage ?? 12.8)
  const conductorArea = Math.max(1, cable?.area ?? 16)
  const conductorLength = Math.max(1, cable?.length ?? 5)
  const baseResistance = 0.0171 * (conductorLength * 2) / conductorArea
  const lugCount = project.wires.reduce((count, wire) => count + (wire.lugFrom ? 1 : 0) + (wire.lugTo ? 1 : 0), 0)
  const lugResistance = lugCount * 0.0005
  const parallelConductors = Math.max(1, ...project.wires.map(wire => Math.floor(wire.parallel ?? 1)))
  const resistance = baseResistance / parallelConductors + lugResistance
  // Small bounded fixed-point solve: constant-power loads draw more current as
  // cable voltage sags, without pretending to be a full circuit solver.
  let batteryCurrent = inputPower / batteryVoltage
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const operatingVoltage = Math.max(10.5, batteryVoltage - batteryCurrent * resistance)
    batteryCurrent = inputPower / operatingVoltage
  }
  const voltageDrop = batteryCurrent * resistance
  const cableLoss = batteryCurrent * batteryCurrent * resistance
  const coldVoc = pvs.reduce((highest, pv) => Math.max(highest, (pv.voltage ?? 36) * (1 + -0.0029 * (project.temperature - 25))), 0)
  const controllerLimited = pvPower > (controller?.watts ?? 760) && Boolean(controller)
  const usableSolar = controllerLimited ? (controller?.watts ?? pvPower) : pvPower
  const chargeCurrent = usableSolar / batteryVoltage
  const chargeLimit = battery?.chargeLimit ?? 50
  const chargingLimited = usableSolar > inputPower && chargeCurrent > chargeLimit
  const effectiveSolar = chargingLimited ? Math.min(usableSolar, chargeLimit * batteryVoltage) : usableSolar
  const baseSoc = 68 + (effectiveSolar - inputPower) / 90
  const batteryCapacityWh = Math.max(1, (battery?.capacity ?? 200) * batteryVoltage)
  const runtimeSocChange = ((effectiveSolar - inputPower) * runtimeSeconds / 3600) / batteryCapacityWh * 100
  const soc = Math.min(100, Math.max(8, baseSoc + runtimeSocChange))
  const overload = demand > (inverter?.watts ?? 0)
  const surgeDemand = loads.reduce((highest, load) => Math.max(highest, (load.watts ?? 0) * (load.surge ?? 1.5)), demand)
  const surgeOverload = surgeDemand > (inverter?.surge ?? (inverter?.watts ?? 0) * 2)
  const ambientTemperature = project.ambientTemperature ?? 25
  const thermalRise = cableLoss * 4 * (1 - Math.exp(-Math.max(0, runtimeSeconds) / 30))
  const thermalEstimate = ambientTemperature + thermalRise
  const protectionRating = fuse?.watts ?? 0
  const protectionRatio = protectionRating > 0 ? batteryCurrent / protectionRating : 0
  const protectionTripSeconds = protectionRatio > 1 ? Math.max(0.1, 10 / (protectionRatio * protectionRatio)) : null
  const protectionTripped = Boolean(fuse && (fuse.tripped || protectionRatio >= 1.25))
  const batteryLimit = battery?.dischargeLimit ?? 150
  const batteryLimited = batteryCurrent > batteryLimit
  const diagnostics: DiagnosticEvent[] = [
    { id: 'educational', severity: 'info', title: 'Educational model active', evidence: 'Values come from the same live terminal-aware bounded model; waveform and code compliance are out of scope.', remedy: 'Verify real installations against current manufacturer documentation and standards.' },
  ]
  if (modelValidation.errors.length) diagnostics.unshift({ id: 'terminal-validation', severity: 'fault', title: 'Terminal connection needs repair', evidence: modelValidation.errors[0], remedy: 'Select the wire or component and reconnect compatible labeled terminals.' })
  if (modelValidation.warnings.length) diagnostics.unshift({ id: 'model-boundary', severity: 'warning', title: 'Model boundary', evidence: modelValidation.warnings[0], remedy: 'Treat control/data links as evidence only; they do not energize a power path.' })
  if (lugCount) diagnostics.unshift({ id: 'lug-resistance', severity: 'info', title: 'Lug termination included', evidence: `${lugCount} modeled lug termination${lugCount === 1 ? '' : 's'} add ${lugResistance.toFixed(4)} Ω to the educational cable path.`, remedy: 'Use the documented lug range and installation torque for a real build; this is not a certification result.' })
  const linkedIds = new Set(project.wires.flatMap(wire => [wire.from, wire.to]))
  const disconnected = project.nodes.filter(node => project.nodes.length > 1 && !linkedIds.has(node.id))
  const nodeIds = new Set(project.nodes.map(node => node.id))
  const invalidWires = project.wires.filter(wire => wire.from === wire.to || !nodeIds.has(wire.from) || !nodeIds.has(wire.to))
  const adjacency = new Map<string, string[]>()
  project.nodes.forEach(node => adjacency.set(node.id, []))
  const openPathNodes = new Set(project.nodes.filter(node => (node.kind === 'transfer' && node.switchState === 'open') || (node.kind === 'fuse' && node.tripped)).map(node => node.id))
  project.wires.forEach(wire => { if (openPathNodes.has(wire.from) || openPathNodes.has(wire.to)) return; adjacency.get(wire.from)?.push(wire.to); adjacency.get(wire.to)?.push(wire.from) })
  const sourceIds = project.nodes.filter(node => node.kind === 'pv' || node.kind === 'battery' || node.kind === 'ac-source').map(node => node.id)
  const reachable = new Set<string>(sourceIds)
  const queue = [...sourceIds]
  while (queue.length) { const current = queue.shift()!; for (const next of adjacency.get(current) ?? []) if (!reachable.has(next)) { reachable.add(next); queue.push(next) } }
  const unreachableLoads = loads.filter(load => !reachable.has(load.id))
  const topologyValid = modelValidation.valid && disconnected.length === 0 && unreachableLoads.length === 0 && invalidWires.length === 0
  if (invalidWires.length) diagnostics.unshift({ id: 'invalid-wire', severity: 'fault', title: 'Unsupported wire connection', evidence: `A wire references ${invalidWires[0].from === invalidWires[0].to ? 'the same component at both ends' : 'a missing component endpoint'}.`, remedy: 'Remove the invalid wire and reconnect the intended terminals.' })
  if (disconnected.length) diagnostics.unshift({ id: 'disconnected-topology', severity: 'warning', title: 'Disconnected component', evidence: `${disconnected[0].name} is not part of an active wire network.`, remedy: 'Connect the component to the intended power or data path before trusting the estimate.' })
  if (unreachableLoads.length) diagnostics.unshift({ id: 'no-source-path', severity: 'fault', title: 'Load has no source path', evidence: `${unreachableLoads[0].name} is wired but cannot be reached from a PV or battery source.`, remedy: 'Connect the load through the intended DC/AC conversion path.' })
  const branchCurrents = Object.fromEntries(loads.map(load => [load.id, (load.watts ?? 0) / 0.91 / batteryVoltage]))
  const busCurrents: Record<string, { total: number; branches: Record<string, number> }> = {}
  for (const bus of project.nodes.filter(node => node.kind === 'bus')) {
    const branches: Record<string, number> = {}
    for (const wire of project.wires.filter(wire => wire.from === bus.id || wire.to === bus.id)) {
      const other = wire.from === bus.id ? wire.to : wire.from
      const seen = new Set<string>([bus.id]); const queue = [other]; let watts = 0
      while (queue.length) { const current = queue.shift()!; if (seen.has(current)) continue; seen.add(current); const currentNode = project.nodes.find(node => node.id === current); if (currentNode?.kind === 'load') watts += currentNode.watts ?? 0; for (const next of adjacency.get(current) ?? []) if (!seen.has(next) && next !== bus.id) queue.push(next) }
      branches[wire.id] = watts / 0.91 / batteryVoltage
    }
    busCurrents[bus.id] = { total: Object.values(branches).reduce((sum, current) => sum + current, 0), branches }
  }
  if (overload) diagnostics.unshift({ id: 'inverter-overload', severity: 'fault', title: 'Inverter overload', evidence: `Load demand is ${Math.round(demand)} W versus ${Math.round(inverter?.watts ?? 0)} W continuous rating.`, remedy: 'Reduce the load, choose a larger inverter, or model startup surge separately.' })
  if (surgeOverload) diagnostics.unshift({ id: 'startup-surge', severity: 'warning', title: 'Startup surge exceeds modeled capability', evidence: `Estimated startup demand is ${Math.round(surgeDemand)} W versus ${Math.round(inverter?.surge ?? (inverter?.watts ?? 0) * 2)} W surge capability.`, remedy: 'Check the load startup multiplier and the inverter surge rating.' })
  if (voltageDrop > batteryVoltage * 0.03) diagnostics.unshift({ id: 'cable-drop', severity: 'warning', title: 'High cable voltage drop', evidence: `${voltageDrop.toFixed(2)} V is lost across the simplified positive/return path.`, remedy: 'Increase conductor area or shorten the complete current path.' })
  if (protectionTripped) diagnostics.unshift({ id: 'protection-current', severity: 'fault', title: fuse?.tripped ? 'Breaker is tripped' : 'Protection current exceeded', evidence: fuse?.tripped ? 'This protection device is latched open in the project state.' : `Estimated ${batteryCurrent.toFixed(1)} A is ${protectionRatio.toFixed(1)}× the configured ${protectionRating} A protection value; simplified trip estimate is ${protectionTripSeconds?.toFixed(1)} s.`, remedy: fuse?.tripped ? 'Reset the breaker only after reducing the modeled fault current.' : 'Review the load and protection selection; this is not a code-compliance result.' })
  else if (fuse && protectionRatio > 1) diagnostics.unshift({ id: 'protection-overcurrent', severity: 'warning', title: 'Protection overcurrent', evidence: `Estimated ${batteryCurrent.toFixed(1)} A is above ${protectionRating} A; simplified trip estimate is ${protectionTripSeconds?.toFixed(1)} s.`, remedy: 'Treat this as an illustrative time-current warning, not a certified trip curve.' })
  if (batteryLimited) diagnostics.unshift({ id: 'battery-current-limit', severity: 'fault', title: 'Battery discharge limit exceeded', evidence: `Estimated ${batteryCurrent.toFixed(1)} A exceeds the modeled ${batteryLimit} A battery limit.`, remedy: 'Reduce demand, increase battery capability, or use a model with a documented higher limit.' })
  if (chargingLimited) diagnostics.unshift({ id: 'battery-charge-limit', severity: 'warning', title: 'Battery charge current limited', evidence: `Available charge current is ${chargeCurrent.toFixed(1)} A versus the modeled ${chargeLimit} A limit.`, remedy: 'Use a compatible charge profile or reduce available charging power; this is an educational limit.' })
  if (controllerLimited) diagnostics.unshift({ id: 'controller-limit', severity: 'warning', title: 'Controller output capped', evidence: `Available PV power is about ${Math.round(pvPower)} W, above the modeled controller cap.`, remedy: 'Check controller sizing and manufacturer-specific clipping behaviour.' })
  if (!acSourceCompatible) diagnostics.unshift({ id: 'ac-source-mismatch', severity: 'fault', title: 'AC source profile mismatch', evidence: `Configured source is ${acSourceVoltage} V at ${acSourceFrequency} Hz${profile ? `, but ${profile.label} requires ${profile.voltage} V at ${profile.frequency} Hz.` : '.'}`, remedy: 'Choose a supported source profile or edit the source settings; no silent phase conversion is applied.' })
  const network = solveTerminalNetwork(project, { batteryVoltage, batteryCurrent, acVoltage: acSourceVoltage, acCurrent, overload })
  const openDevices = project.nodes.filter(node => (node.kind === 'transfer' && node.switchState === 'open') || (node.kind === 'fuse' && node.tripped))
  if (openDevices.length) diagnostics.unshift({ id: 'open-device', severity: 'warning', title: 'Path is open', evidence: `${openDevices[0].name} is open, so downstream terminals are not energized.`, remedy: openDevices[0].kind === 'fuse' ? 'Reduce the fault current, then reset the protection device.' : 'Close the transfer or isolator only when the intended source path is safe.' })
  if (network.unsupported.length) diagnostics.unshift({ id: 'unsupported-phase-topology', severity: 'fault', title: 'AC topology is not supported by the placed terminals', evidence: network.unsupported[0], remedy: 'Use a single-phase profile or place a device template with the required phase terminals; the model will not fabricate phase readings.' })
  if (network.openTerminals.length) diagnostics.unshift({ id: 'open-terminal', severity: 'warning', title: 'Open terminal', evidence: `${network.openTerminals[0]} has no wire endpoint.`, remedy: 'Connect the labeled terminal or leave it intentionally open and treat readings as incomplete.' })
  const priority = { fault: 0, warning: 1, info: 2 }
  diagnostics.sort((a, b) => priority[a.severity] - priority[b.severity])
  return { runtimeSeconds, pvPower, demand, inputPower, batteryCurrent, coldVoc, voltageDrop, cableLoss, soc, overload, charging: usableSolar > inputPower, controllerLimited, topologyValid: topologyValid && network.unsupported.length === 0, surgeDemand, thermalEstimate, protectionTripped, protectionTripSeconds, batteryLimited, chargingLimited, chargeCurrent, acPowerFactor, apparentPower, acCurrent, acSourceCompatible, branchCurrents, busCurrents, diagnostics, network }
}

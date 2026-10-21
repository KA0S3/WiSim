export type SimulationNode = {
  id: string
  kind: 'pv' | 'battery' | 'mppt' | 'inverter' | 'load' | 'cable' | 'fuse' | 'bus' | 'ac-source' | 'transfer'
  name: string
  watts?: number
  powerLimitByVoltage?: Record<string, number>
  supportedBatteryVoltages?: number[]
  voltage?: number
  acVoltage?: number
  acFrequency?: number
  capacity?: number
  area?: number
  length?: number
  surge?: number
  currentLimitA?: number
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
export type Terminal = { id: string; label: string; domain: TerminalDomain; role: TerminalRole; direction?: 'source' | 'sink' | 'bidirectional'; side?: 'top' | 'bottom' | 'left' | 'right'; order?: number; x?: number; y?: number }
export type ACProfileId = '120v-60hz' | '230v-50hz' | 'split-120-240v-60hz' | 'three-phase-400v-50hz'
export type ACProfile = { id: ACProfileId; label: string; voltage: number; frequency: number; phases: 1 | 2 | 3; terminals: TerminalRole[] }
export const AC_PROFILES: Record<ACProfileId, ACProfile> = {
  '120v-60hz': { id: '120v-60hz', label: '120 V / 60 Hz single-phase', voltage: 120, frequency: 60, phases: 1, terminals: ['ac-line', 'ac-neutral', 'ac-earth'] },
  '230v-50hz': { id: '230v-50hz', label: '230 V / 50 Hz single-phase', voltage: 230, frequency: 50, phases: 1, terminals: ['ac-line', 'ac-neutral', 'ac-earth'] },
  'split-120-240v-60hz': { id: 'split-120-240v-60hz', label: '120/240 V / 60 Hz split-phase', voltage: 240, frequency: 60, phases: 2, terminals: ['phase-a', 'phase-b', 'ac-neutral', 'ac-earth'] },
  'three-phase-400v-50hz': { id: 'three-phase-400v-50hz', label: '400 V / 50 Hz three-phase', voltage: 400, frequency: 50, phases: 3, terminals: ['phase-a', 'phase-b', 'phase-c', 'ac-neutral', 'ac-earth'] },
}
const batteryVoltageClass = (voltage: number) => voltage <= 16 ? 12 : voltage <= 32 ? 24 : 48

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

export type WireTerminalIssue = { kind: 'domain' | 'polarity' | 'role' | 'direction'; message: string }

export function getWireTerminalIssue(project: SimulationProject, wire: SimulationProject['wires'][number]): WireTerminalIssue | null {
  if (!wire.fromTerminal && !wire.toTerminal) return null
  const fromNode = project.nodes.find(node => node.id === wire.from)
  const toNode = project.nodes.find(node => node.id === wire.to)
  if (!fromNode || !toNode) return null
  const from = (fromNode.terminals ?? defaultTerminals(fromNode.kind)).find(terminal => terminal.id === (wire.fromTerminal ?? (fromNode.kind === 'pv' ? 'pv+' : 'out')))
  const to = (toNode.terminals ?? defaultTerminals(toNode.kind)).find(terminal => terminal.id === (wire.toTerminal ?? (toNode.kind === 'load' ? 'line' : 'in')))
  if (!from || !to) return null
  if (from.domain !== to.domain && !(from.domain === 'earth' && to.domain === 'ac')) {
    return { kind: 'domain', message: `Wire ${wire.id} joins ${from.domain} to ${to.domain}` }
  }
  const samePolarity = ((from.role === 'positive' || from.role === 'pv') && (to.role === 'positive' || to.role === 'pv'))
    || (from.role === 'negative' && to.role === 'negative')
    || (from.role === 'ac-line' && ['ac-line', 'phase-a', 'phase-b', 'phase-c'].includes(to.role))
    || (['phase-a', 'phase-b', 'phase-c'].includes(from.role) && to.role === 'ac-line')
    || (['phase-a', 'phase-b', 'phase-c'].includes(from.role) && from.role === to.role)
    || (from.role === 'ac-neutral' && to.role === 'ac-neutral')
    || (from.role === 'ac-earth' && to.role === 'ac-earth')
  const dcPolarityShort = from.domain === 'dc' && to.domain === 'dc' && (((from.role === 'positive' || from.role === 'pv') && to.role === 'negative') || (from.role === 'negative' && (to.role === 'positive' || to.role === 'pv')))
  const acPolarityShort = from.domain === 'ac' && to.domain === 'ac' && ((from.role === 'ac-line' && ['ac-neutral', 'phase-a', 'phase-b', 'phase-c'].includes(to.role)) || (to.role === 'ac-line' && ['ac-neutral', 'phase-a', 'phase-b', 'phase-c'].includes(from.role)) || (['phase-a', 'phase-b', 'phase-c'].includes(from.role) && ['ac-neutral', 'phase-a', 'phase-b', 'phase-c'].includes(to.role) && from.role !== to.role))
  if (dcPolarityShort) return { kind: 'polarity', message: `Wire ${wire.id} creates a DC polarity short: incompatible terminal roles ${from.role} and ${to.role}` }
  if (acPolarityShort) return { kind: 'polarity', message: `Wire ${wire.id} creates an AC conductor short: incompatible terminal roles ${from.role} and ${to.role}` }
  if (from.domain === to.domain && from.domain !== 'data' && !samePolarity) {
    return { kind: 'role', message: `Wire ${wire.id} connects incompatible terminal roles ${from.role} and ${to.role}` }
  }
  if (from.direction === 'sink' && to.direction === 'sink') return { kind: 'direction', message: `Wire ${wire.id} joins two sink terminals` }
  if (from.direction === 'source' && to.direction === 'source') return { kind: 'direction', message: `Wire ${wire.id} joins two source terminals` }
  return null
}

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
  return []
}

export function validateProjectModel(project: SimulationProject): ModelValidation {
  const errors: string[] = [], warnings: string[] = [], terminalKeys = new Set<string>()
  if (!Number.isFinite(project.irradiance) || project.irradiance < 0 || project.irradiance > 100) errors.push('Sunlight percentage must be a finite value from 0 to 100')
  if (!Number.isFinite(project.temperature) || project.temperature < -273.15) errors.push('Panel temperature must be finite and at or above absolute zero')
  if (project.ambientTemperature !== undefined && (!Number.isFinite(project.ambientTemperature) || project.ambientTemperature < -273.15)) errors.push('Ambient temperature must be finite and at or above absolute zero')
  if (project.acSourceVoltage !== undefined && (!Number.isFinite(project.acSourceVoltage) || project.acSourceVoltage <= 0)) errors.push('AC source voltage must be finite and greater than 0 V')
  if (project.acSourceFrequency !== undefined && (!Number.isFinite(project.acSourceFrequency) || project.acSourceFrequency <= 0)) errors.push('AC source frequency must be finite and greater than 0 Hz')
  const nodes = new Map(project.nodes.map(node => [node.id, node]))
  const nodeIds = project.nodes.map(node => node.id)
  for (const node of project.nodes) if (typeof node.id !== 'string' || !node.id.trim()) errors.push('Each device needs a non-empty string ID')
  for (const id of nodeIds.filter((value, index) => nodeIds.indexOf(value) !== index)) errors.push(`Duplicate node ID ${id}`)
  const wireIds = project.wires.map(wire => wire.id)
  for (const wire of project.wires) if (typeof wire.id !== 'string' || !wire.id.trim()) errors.push('Each connection wire needs a non-empty string ID')
  for (const id of wireIds.filter((value, index) => wireIds.indexOf(value) !== index)) errors.push(`Duplicate wire ID ${id}`)
  for (const node of project.nodes) {
    if (typeof node.name !== 'string' || !node.name.trim()) errors.push(`Device ${String(node.id)} needs a non-empty name`)
    if (!['pv', 'battery', 'mppt', 'inverter', 'load', 'cable', 'fuse', 'bus', 'ac-source', 'transfer'].includes(node.kind)) {
      errors.push(`${node.name || node.id || 'Device'} has unsupported component kind ${String(node.kind)}`)
      continue
    }
    if (node.terminals != null && !Array.isArray(node.terminals)) { errors.push(`${node.name || node.id} terminal layout must be a list`); continue }
    if ((node.x !== undefined && !Number.isFinite(node.x)) || (node.y !== undefined && !Number.isFinite(node.y))) errors.push(`${node.name || node.id} canvas position must use finite coordinates`)
    if (node.chemistry !== undefined && node.kind !== 'battery') errors.push(`${node.name} chemistry is only modeled for batteries`)
    else if (node.chemistry !== undefined && !['LiFePO4', 'lead-acid'].includes(node.chemistry)) errors.push(`${node.name} battery chemistry must be LiFePO4 or lead-acid`)
    if (node.acProfile !== undefined && node.kind !== 'inverter') errors.push(`${node.name} AC output profile is only modeled for inverters`)
    else if (node.acProfile !== undefined && !Object.prototype.hasOwnProperty.call(AC_PROFILES, node.acProfile)) errors.push(`${node.name} has an unsupported AC output profile`)
    if (node.switchState !== undefined && node.kind !== 'transfer') errors.push(`${node.name} switch state is only modeled for transfer switches`)
    else if (node.switchState !== undefined && node.switchState !== 'open' && node.switchState !== 'closed') errors.push(`${node.name} switch state must be open or closed`)
    if (node.enabled !== undefined) errors.push(`${node.name} enabled flag has no modeled behavior; use a transfer-switch or protection state where applicable`)
    for (const field of ['tripped', 'resettable'] as const) {
      if (node[field] !== undefined && node.kind !== 'fuse') errors.push(`${node.name} ${field} state is only modeled for protection devices`)
      else if (node[field] !== undefined && typeof node[field] !== 'boolean') errors.push(`${node.name} ${field} state must be true or false`)
    }
    const terminals = node.terminals ?? defaultTerminals(node.kind)
    for (const [field, value] of Object.entries({ watts: node.watts, voltage: node.voltage, acVoltage: node.acVoltage, acFrequency: node.acFrequency, capacity: node.capacity, area: node.area, length: node.length, surge: node.surge, currentLimitA: node.currentLimitA, chargeLimit: node.chargeLimit, dischargeLimit: node.dischargeLimit })) {
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) errors.push(`${node.name} ${field} must be a finite value greater than 0`)
    }
    if (node.powerLimitByVoltage != null && (typeof node.powerLimitByVoltage !== 'object' || Array.isArray(node.powerLimitByVoltage))) errors.push(`${node.name} PV power limits must be a voltage-to-watts table`)
    else if (node.powerLimitByVoltage && Object.entries(node.powerLimitByVoltage).some(([voltage, power]) => ![12, 24, 48].includes(Number(voltage)) || !Number.isFinite(power) || power <= 0)) errors.push(`${node.name} PV power limits must use supported 12 V, 24 V, or 48 V classes and positive finite watts`)
    if (node.supportedBatteryVoltages != null && !Array.isArray(node.supportedBatteryVoltages)) errors.push(`${node.name} supported battery voltages must be a list`)
    else if (node.supportedBatteryVoltages?.some(voltage => ![12, 24, 48].includes(voltage))) errors.push(`${node.name} supported battery voltages must be 12 V, 24 V, or 48 V system classes`)
    if (node.powerFactor !== undefined && (!Number.isFinite(node.powerFactor) || node.powerFactor <= 0 || node.powerFactor > 1)) errors.push(`${node.name} power factor must be greater than 0 and at most 1`)
    const terminalPositions = new Set<string>()
    for (const terminal of terminals) {
      if (!terminal || typeof terminal !== 'object' || Array.isArray(terminal)) { errors.push(`${node.name} has a malformed terminal record`); continue }
      const key = `${node.id}:${terminal.id}`
      if (terminalKeys.has(key)) errors.push(`Duplicate terminal ID ${key}`)
      terminalKeys.add(key)
      if (typeof terminal.id !== 'string' || !terminal.id.trim() || typeof terminal.label !== 'string' || !terminal.label.trim()) errors.push(`${node.name} has a terminal with a missing or invalid ID/label`)
      if (terminal.side !== undefined && !['top', 'bottom', 'left', 'right'].includes(terminal.side)) errors.push(`${node.name} terminal ${terminal.label} has an unsupported display side`)
      if (!['dc', 'ac', 'data', 'earth'].includes(terminal.domain)) errors.push(`${node.name} terminal ${terminal.label} has an unsupported electrical domain`)
      if (!['positive', 'negative', 'pv', 'ac-line', 'ac-neutral', 'ac-earth', 'phase-a', 'phase-b', 'phase-c', 'control'].includes(terminal.role)) errors.push(`${node.name} terminal ${terminal.label} has an unsupported electrical role`)
      if (terminal.direction !== undefined && !['source', 'sink', 'bidirectional'].includes(terminal.direction)) errors.push(`${node.name} terminal ${terminal.label} has an unsupported direction`)
      if (terminal.order !== undefined && (!Number.isInteger(terminal.order) || terminal.order < 1)) errors.push(`${node.name} terminal ${terminal.label} order must be a positive whole number`)
      if (terminal.side && terminal.order !== undefined) {
        const position = `${terminal.side}:${terminal.order}`
        if (terminalPositions.has(position)) errors.push(`${node.name} has multiple terminals at ${terminal.side} order ${terminal.order}`)
        terminalPositions.add(position)
      }
      if ((terminal.x !== undefined && !Number.isFinite(terminal.x)) || (terminal.y !== undefined && !Number.isFinite(terminal.y))) errors.push(`${node.name} terminal ${terminal.label} position must be finite`)
    }
  }
  for (const controller of project.nodes.filter(node => node.kind === 'mppt' && node.supportedBatteryVoltages?.length)) {
    const battery = project.nodes.find(node => node.kind === 'battery')
    if (battery) {
      const systemClass = (battery.voltage ?? 12.8) <= 16 ? 12 : (battery.voltage ?? 12.8) <= 32 ? 24 : 48
      if (!controller.supportedBatteryVoltages!.includes(systemClass)) errors.push(`${controller.name} is documented for ${controller.supportedBatteryVoltages!.join(' V / ')} V battery systems; the configured battery is ${systemClass} V`)
    }
  }
  const openNodes = new Set(project.nodes.filter(node => (node.kind === 'transfer' && node.switchState === 'open') || (node.kind === 'fuse' && node.tripped)).map(node => node.id))
  for (const wire of project.wires) {
    if (wire.domain !== undefined && !['dc', 'ac', 'data', 'earth'].includes(wire.domain)) warnings.push(`Wire ${wire.id} has an unsupported display-domain tag; terminal domains still determine its modeled connection`)
    if (wire.color !== undefined && !['red', 'black', 'blue', 'brown', 'orange', 'green-yellow', 'grey', 'white'].includes(wire.color)) warnings.push(`Wire ${wire.id} has a saved display color outside the current palette`)
    if (typeof wire.from !== 'string' || typeof wire.to !== 'string' || !nodes.has(wire.from) || !nodes.has(wire.to) || wire.from === wire.to) { errors.push(`Wire ${wire.id} has invalid endpoints`); continue }
    if (wire.gauge !== undefined && (!Number.isFinite(wire.gauge) || wire.gauge <= 0)) errors.push(`Wire ${wire.id} conductor size must be greater than 0 mm²`)
    if (wire.length !== undefined && (!Number.isFinite(wire.length) || wire.length <= 0)) errors.push(`Wire ${wire.id} length must be greater than 0 m`)
    if (wire.material !== undefined && wire.material !== 'copper' && wire.material !== 'aluminium') errors.push(`Wire ${wire.id} material must be copper or aluminium`)
    if (wire.parallel !== undefined && (!Number.isInteger(wire.parallel) || wire.parallel < 1)) errors.push(`Wire ${wire.id} parallel conductor count must be a positive whole number`)
    if (wire.points?.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) errors.push(`Wire ${wire.id} route points must have finite coordinates`)
    if (!wire.fromTerminal && !wire.toTerminal) continue
    const fromNode = nodes.get(wire.from)!, toNode = nodes.get(wire.to)!
    if (openNodes.has(fromNode.id) || openNodes.has(toNode.id)) { warnings.push(`Wire ${wire.id} is behind an open protection or transfer device`); continue }
    const from = (fromNode.terminals ?? defaultTerminals(fromNode.kind)).find(t => t.id === (wire.fromTerminal ?? (fromNode.kind === 'pv' ? 'pv+' : 'out')))
    const to = (toNode.terminals ?? defaultTerminals(toNode.kind)).find(t => t.id === (wire.toTerminal ?? (toNode.kind === 'load' ? 'line' : 'in')))
    if (!from || !to) { errors.push(`Wire ${wire.id} references a missing terminal`); continue }
    const terminalIssue = getWireTerminalIssue(project, wire)
    if (terminalIssue && terminalIssue.kind !== 'direction') errors.push(terminalIssue.message)
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
    if (getWireTerminalIssue(project, wire)) continue
    if (openNodes.has(wire.from) || openNodes.has(wire.to)) continue
    adjacent.get(fromKey)!.push(toKey); adjacent.get(toKey)!.push(fromKey); activePaths.push(wire.id)
  }
  for (const [key, terminal] of terminals) if (!adjacent.get(key)?.length) openTerminals.push(key)
  const profile = project.acProfile ? AC_PROFILES[project.acProfile] : undefined
  const outputProfile = profile ?? { voltage: project.acSourceVoltage ?? 230, frequency: project.acSourceFrequency ?? 50 }
  const battery = project.nodes.find(node => node.kind === 'battery')
  const batteryClass = batteryVoltageClass(battery?.voltage ?? 12.8)
  const mismatchedAcInverters = new Set(project.nodes.filter(node => node.kind === 'inverter' && (node.acVoltage != null && Math.abs(node.acVoltage - outputProfile.voltage) > 0.01 || node.acFrequency != null && node.acFrequency !== outputProfile.frequency)).map(node => node.id))
  const mismatchedDcInverters = new Set(project.nodes.filter(node => node.kind === 'inverter' && node.voltage != null && battery && batteryVoltageClass(node.voltage) !== batteryClass).map(node => node.id))
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
    const ownerNodeId = key.slice(0, key.indexOf(':'))
    const state = unsupported.length || terminal.domain === 'ac' && mismatchedAcInverters.has(ownerNodeId) || terminal.domain === 'dc' && mismatchedDcInverters.has(ownerNodeId) ? 'unsupported' : energized && !openTerminals.includes(key) ? 'energized' : 'open'
    terminalReadings[key] = { voltage, current: terminal.domain === 'ac' ? values.acCurrent : values.batteryCurrent, state }
  }
  const deviceStates: TerminalNetworkResult['deviceStates'] = {}
  for (const node of project.nodes) {
    const nodeReadings = Object.entries(terminalReadings).filter(([key]) => key.startsWith(`${node.id}:`))
    const hasFault = nodeReadings.some(([, reading]) => reading.state === 'fault')
    const hasUnsupported = nodeReadings.some(([, reading]) => reading.state === 'unsupported')
    deviceStates[node.id] = openNodes.has(node.id) ? 'fault' : hasFault ? 'fault' : hasUnsupported || unsupported.length && (node.kind === 'inverter' || node.kind === 'load') ? 'unsupported' : node.kind === 'inverter' && values.overload ? 'overload' : node.kind === 'inverter' && values.batteryVoltage < 11 ? 'low-voltage' : node.kind === 'inverter' ? 'inverting' : node.kind === 'battery' && values.batteryCurrent < 0 ? 'charging' : 'idle'
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
    if (!probe.negative || !negativeNode || !negativeTerminal) return { supported: false, value: null, unit, polarity: 'ambiguous', explanation: 'Continuity needs both meter leads attached to terminals.' }
    if (positiveTerminal.domain !== negativeTerminal.domain) return { supported: false, value: null, unit, polarity: 'ambiguous', explanation: 'The selected terminals use different electrical domains; this model cannot compare them.' }
    const key = (nodeId: string, terminalId: string) => `${nodeId}:${terminalId}`
    const adjacency = new Map<string, string[]>()
    for (const wire of project.wires.filter(item => result.network.activePaths.includes(item.id))) {
      if (!wire.fromTerminal || !wire.toTerminal) continue
      const from = key(wire.from, wire.fromTerminal), to = key(wire.to, wire.toTerminal)
      adjacency.set(from, [...(adjacency.get(from) ?? []), to]); adjacency.set(to, [...(adjacency.get(to) ?? []), from])
    }
    const start = key(probe.positive.nodeId, probe.positive.terminalId), end = key(probe.negative.nodeId, probe.negative.terminalId)
    const visited = new Set([start]), queue = [start]
    while (queue.length) for (const next of adjacency.get(queue.shift()!) ?? []) if (!visited.has(next)) { visited.add(next); queue.push(next) }
    const connected = visited.has(end)
    return { supported: true, value: connected ? 1 : 0, unit, polarity: 'ambiguous', explanation: connected ? 'The selected leads have a continuous path through active modeled wires. Device internals are not included.' : 'There is no continuous path through active modeled wires between these leads.' }
  }
  if (!probe.negative || !negativeNode || !negativeTerminal) return { supported: false, value: null, unit, polarity: 'ambiguous', explanation: 'This measurement needs both probe leads attached to terminals.' }
  if (positiveTerminal.domain !== negativeTerminal.domain) return { supported: false, value: null, unit, polarity: 'ambiguous', explanation: 'The selected terminals use different electrical domains; this model cannot compare them.' }
  const directWire = project.wires.find(wire => wire.from === probe.positive.nodeId && wire.fromTerminal === probe.positive.terminalId && wire.to === probe.negative!.nodeId && wire.toTerminal === probe.negative!.terminalId || wire.to === probe.positive.nodeId && wire.toTerminal === probe.positive.terminalId && wire.from === probe.negative!.nodeId && wire.fromTerminal === probe.negative!.terminalId)
  if (probe.mode === 'current' && (!directWire || !result.network.activePaths.includes(directWire.id))) return { supported: false, value: null, unit, polarity: 'ambiguous', explanation: 'Current is available here only when both leads span the same active modeled connection.' }
  if (probe.mode === 'resistance') {
    if (!directWire || !result.network.activePaths.includes(directWire.id)) return { supported: false, value: null, unit, polarity: 'ambiguous', explanation: 'No active modeled wire connects these probe endpoints directly.' }
    if (directWire.material !== undefined && directWire.material !== 'copper' && directWire.material !== 'aluminium') return { supported: false, value: null, unit, polarity: 'ambiguous', explanation: 'This wire has an unsupported conductor material, so its resistance cannot be estimated.' }
    const gauge = directWire.gauge, length = directWire.length
    if (gauge === undefined || length === undefined || !Number.isFinite(gauge) || gauge <= 0 || !Number.isFinite(length) || length <= 0 || !Number.isInteger(directWire.parallel ?? 1) || (directWire.parallel ?? 1) <= 0) return { supported: false, value: null, unit, polarity: 'ambiguous', explanation: 'This wire is missing a usable conductor size, length, or positive whole-number parallel count.' }
    const resistivityAt20C = directWire.material === 'aluminium' ? 0.0287 : 0.0175
    const resistance = resistivityAt20C * length / (gauge * (directWire.parallel ?? 1))
    return { supported: true, value: resistance, unit, polarity: 'ambiguous', explanation: `Calculated conductor resistance at 20 °C using ${directWire.material ?? 'default copper'}, the saved wire length, area, and parallel count. It excludes terminals, temperature rise, AC reactance, and real meter effects.` }
  }
  if (probe.mode === 'current') {
    if (positiveTerminal.domain === 'dc') {
      const branchCurrent = Object.values(result.busCurrents).map(bus => bus.branches[directWire!.id]).find(value => value !== undefined)
      if (branchCurrent !== undefined) return { supported: true, value: branchCurrent, unit, polarity: 'ambiguous', explanation: 'This is the bounded DC bus-branch estimate from connected downstream load watts, divided by the model efficiency and battery voltage. It does not solve Kirchhoff current distribution, conductor drop by branch, or lead direction.' }
      return { supported: true, value: result.batteryCurrent, unit, polarity: 'ambiguous', explanation: 'This is the live system DC constant-power current estimate; this connection is not a directly modeled bus branch, and lead direction is not solved.' }
    }
    return { supported: true, value: result.acCurrent, unit, polarity: 'ambiguous', explanation: 'This is the live system AC apparent-power current estimate; individual AC branch currents and lead direction are not solved.' }
  }
  const positiveReading = result.network.terminalReadings[`${probe.positive.nodeId}:${probe.positive.terminalId}`]
  const negativeReading = result.network.terminalReadings[`${probe.negative.nodeId}:${probe.negative.terminalId}`]
  if (!positiveReading || !negativeReading || positiveReading.state === 'unsupported' || negativeReading.state === 'unsupported') return { supported: false, value: null, unit, polarity: 'ambiguous', explanation: 'A terminal reading is unavailable in this topology.' }
  const voltage = positiveReading.voltage - negativeReading.voltage
  return { supported: true, value: voltage, unit, polarity: voltage >= 0 ? 'positive' : 'negative', explanation: 'Voltage is the difference between the live modeled readings at the selected terminals.' }
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
  const batterySystemVoltage = battery?.voltage ?? 12.8
  const batterySystemClass = batterySystemVoltage <= 16 ? 12 : batterySystemVoltage <= 32 ? 24 : 48
  const controllerPowerLimit = controller?.powerLimitByVoltage?.[String(batterySystemClass)] ?? controller?.watts ?? 760
  const controllerLimited = pvPower > controllerPowerLimit && Boolean(controller)
  const usableSolar = controllerLimited ? controllerPowerLimit : pvPower
  const chargeCurrent = usableSolar / batteryVoltage
  const batteryChargeLimit = battery?.chargeLimit ?? 50
  const controllerChargeLimit = controller?.chargeLimit
  const chargeLimit = Math.min(batteryChargeLimit, controllerChargeLimit ?? Number.POSITIVE_INFINITY)
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
  const protectionRating = fuse?.currentLimitA ?? fuse?.watts ?? 0
  const protectionRatio = protectionRating > 0 ? batteryCurrent / protectionRating : 0
  const protectionTripSeconds = protectionRatio > 1 ? Math.max(0.1, 10 / (protectionRatio * protectionRatio)) : null
  const protectionTripped = Boolean(fuse && (fuse.tripped || protectionRatio >= 1.25))
  const batteryLimit = battery?.dischargeLimit ?? 150
  const batteryLimited = batteryCurrent > batteryLimit
  const diagnostics: DiagnosticEvent[] = [
    { id: 'educational', severity: 'info', title: 'Educational model active', evidence: 'Values come from the same live terminal-aware bounded model; waveform and code compliance are out of scope.', remedy: 'Verify real installations against current manufacturer documentation and standards.' },
  ]
  const wireIssues = project.wires.flatMap(wire => {
    const issue = getWireTerminalIssue(project, wire)
    if (!issue) return []
    const fromNode = project.nodes.find(node => node.id === wire.from)
    const toNode = project.nodes.find(node => node.id === wire.to)
    const from = fromNode && (fromNode.terminals ?? defaultTerminals(fromNode.kind)).find(terminal => terminal.id === wire.fromTerminal)
    const to = toNode && (toNode.terminals ?? defaultTerminals(toNode.kind)).find(terminal => terminal.id === wire.toTerminal)
    return [{ wire, issue, evidence: `${wire.id}: ${fromNode?.name ?? wire.from} / ${from?.label ?? wire.fromTerminal} → ${toNode?.name ?? wire.to} / ${to?.label ?? wire.toTerminal}. ${issue.message}` }]
  })
  const wireIssueMessages = new Set(wireIssues.map(item => item.issue.message))
  const otherValidationErrors = modelValidation.errors.filter(error => !wireIssueMessages.has(error))
  const otherValidationWarnings = modelValidation.warnings.filter(warning => !wireIssueMessages.has(warning))
  if (otherValidationErrors.length) diagnostics.unshift({ id: 'terminal-validation', severity: 'fault', title: 'Project configuration needs repair', evidence: otherValidationErrors[0], remedy: 'Review the named device or connection setting, then correct it before interpreting the live estimates.' })
  for (const { wire, issue, evidence } of wireIssues) diagnostics.unshift({
    id: `wire-terminal-issue:${wire.id}`,
    severity: issue.kind === 'polarity' ? 'fault' : 'warning',
    title: issue.kind === 'domain' ? 'Connection joins different electrical domains' : issue.kind === 'polarity' ? 'Connection has a polarity conflict' : issue.kind === 'direction' ? 'Connection direction needs review' : 'Connection uses incompatible terminal roles',
    evidence,
    remedy: 'Select this wire to see its endpoints. You can keep it for the learning example or delete it and connect matching terminals.',
  })
  if (otherValidationWarnings.length) diagnostics.unshift(...otherValidationWarnings.map((warning, index) => {
    const controlLink = warning.includes('control/data link')
    const directionMismatch = warning.includes('sink terminals') || warning.includes('source terminals')
    const openDevicePath = warning.includes('behind an open protection or transfer device')
    const displayMetadata = warning.includes('display')
    return {
      id: `model-boundary-${index + 1}`,
      severity: 'warning' as const,
      title: controlLink ? 'Control/data link; no power is modeled' : directionMismatch ? 'Connection direction needs review' : openDevicePath ? 'Wire is behind an open device' : displayMetadata ? 'Saved wire display setting needs review' : 'Connection model note',
      evidence: warning,
      remedy: controlLink ? 'Treat this as a signal path; the current power model does not calculate energy on control/data links.' : directionMismatch ? 'Review the terminals to see whether their modeled source and sink roles match the intended learning example.' : openDevicePath ? 'The wire is preserved, but the open protection or transfer device interrupts the modeled path.' : displayMetadata ? 'Choose a supported display color or domain tag in the wire inspector; terminal roles and domains continue to define the electrical connection.' : 'Review the named wire and terminal roles before interpreting readings.',
    }
  }))
  if (lugCount) diagnostics.unshift({ id: 'lug-resistance', severity: 'info', title: 'Lug termination included', evidence: `${lugCount} modeled lug termination${lugCount === 1 ? '' : 's'} add ${lugResistance.toFixed(4)} Ω to the educational cable path.`, remedy: 'Use the documented lug range and installation torque for a real build; this is not a certification result.' })
  const linkedIds = new Set(project.wires.flatMap(wire => [wire.from, wire.to]))
  const disconnected = project.nodes.filter(node => project.nodes.length > 1 && !linkedIds.has(node.id))
  const nodeIds = new Set(project.nodes.map(node => node.id))
  const invalidWires = project.wires.filter(wire => wire.from === wire.to || !nodeIds.has(wire.from) || !nodeIds.has(wire.to))
  const adjacency = new Map<string, string[]>()
  project.nodes.forEach(node => adjacency.set(node.id, []))
  const openPathNodes = new Set(project.nodes.filter(node => (node.kind === 'transfer' && node.switchState === 'open') || (node.kind === 'fuse' && node.tripped)).map(node => node.id))
  const powerPathWires = project.wires.filter(wire => {
    if (!wire.fromTerminal || !wire.toTerminal || openPathNodes.has(wire.from) || openPathNodes.has(wire.to)) return false
    const fromNode = project.nodes.find(node => node.id === wire.from), toNode = project.nodes.find(node => node.id === wire.to)
    if (!fromNode || !toNode) return false
    const from = (fromNode.terminals ?? defaultTerminals(fromNode.kind)).find(terminal => terminal.id === wire.fromTerminal)
    const to = (toNode.terminals ?? defaultTerminals(toNode.kind)).find(terminal => terminal.id === wire.toTerminal)
    return Boolean(from && to && !getWireTerminalIssue(project, wire) && from.role !== 'control' && to.role !== 'control' && from.domain === to.domain && (from.domain === 'dc' || from.domain === 'ac'))
  })
  powerPathWires.forEach(wire => { adjacency.get(wire.from)?.push(wire.to); adjacency.get(wire.to)?.push(wire.from) })
  const sourceIds = project.nodes.filter(node => node.kind === 'pv' || node.kind === 'battery' || node.kind === 'ac-source').map(node => node.id)
  const reachable = new Set<string>(sourceIds)
  const queue = [...sourceIds]
  while (queue.length) { const current = queue.shift()!; for (const next of adjacency.get(current) ?? []) if (!reachable.has(next)) { reachable.add(next); queue.push(next) } }
  const unreachableLoads = loads.filter(load => !reachable.has(load.id))
  const topologyValid = modelValidation.valid && wireIssues.length === 0 && disconnected.length === 0 && unreachableLoads.length === 0 && invalidWires.length === 0
  if (invalidWires.length) diagnostics.unshift({ id: 'invalid-wire', severity: 'fault', title: 'Unsupported wire connection', evidence: `A wire references ${invalidWires[0].from === invalidWires[0].to ? 'the same component at both ends' : 'a missing component endpoint'}.`, remedy: 'Remove the invalid wire and reconnect the intended terminals.' })
  if (disconnected.length) diagnostics.unshift({ id: 'disconnected-topology', severity: 'warning', title: 'Disconnected component', evidence: `${disconnected[0].name} is not part of an active wire network.`, remedy: 'Connect the component to the intended power or data path before trusting the estimate.' })
  if (unreachableLoads.length) diagnostics.unshift({ id: 'no-source-path', severity: 'fault', title: 'Load has no source path', evidence: `${unreachableLoads[0].name} is wired but cannot be reached from a PV or battery source.`, remedy: 'Connect the load through the intended DC/AC conversion path.' })
  const branchCurrents = Object.fromEntries(loads.map(load => [load.id, (load.watts ?? 0) / 0.91 / batteryVoltage]))
  const busCurrents: Record<string, { total: number; branches: Record<string, number> }> = {}
  for (const bus of project.nodes.filter(node => node.kind === 'bus')) {
    const branches: Record<string, number> = {}
    for (const wire of powerPathWires.filter(wire => wire.from === bus.id || wire.to === bus.id)) {
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
  if (chargingLimited) diagnostics.unshift({ id: 'battery-charge-limit', severity: 'warning', title: 'Charging current limited', evidence: `Available charge current is ${chargeCurrent.toFixed(1)} A versus the active modeled ${chargeLimit} A limit${controllerChargeLimit != null && controllerChargeLimit <= batteryChargeLimit ? ` on ${controller?.name ?? 'the charge controller'}` : ` on ${battery?.name ?? 'the battery bank'}`}.`, remedy: 'Compare the controller and battery ratings, then adjust this learning system. This simplified limit is not an installation check.' })
  if (controllerLimited) diagnostics.unshift({ id: 'controller-limit', severity: 'warning', title: 'Controller output capped', evidence: `Available PV power is about ${Math.round(pvPower)} W, above the modeled controller cap.`, remedy: 'Check controller sizing and manufacturer-specific clipping behaviour.' })
  if (!acSourceCompatible) diagnostics.unshift({ id: 'ac-source-mismatch', severity: 'fault', title: 'AC source profile mismatch', evidence: `Configured source is ${acSourceVoltage} V at ${acSourceFrequency} Hz${profile ? `, but ${profile.label} requires ${profile.voltage} V at ${profile.frequency} Hz.` : '.'}`, remedy: 'Choose a supported source profile or edit the source settings; no silent phase conversion is applied.' })
  const outputProfile = profile ?? { voltage: acSourceVoltage, frequency: acSourceFrequency }
  const mismatchedInverter = project.nodes.find(node => node.kind === 'inverter' && (node.acVoltage != null && Math.abs(node.acVoltage - outputProfile.voltage) > 0.01 || node.acFrequency != null && node.acFrequency !== outputProfile.frequency))
  if (mismatchedInverter) diagnostics.unshift({ id: 'inverter-ac-mismatch', severity: 'fault', title: 'Inverter AC rating does not match profile', evidence: `${mismatchedInverter.name} is configured for ${mismatchedInverter.acVoltage ?? outputProfile.voltage} V at ${mismatchedInverter.acFrequency ?? outputProfile.frequency} Hz; the active AC profile is ${outputProfile.voltage} V at ${outputProfile.frequency} Hz.`, remedy: 'Compare the inverter output rating with the chosen system profile. Editing the profile or an assumed rating does not verify real equipment compatibility.' })
  const mismatchedDcInverter = project.nodes.find(node => node.kind === 'inverter' && node.voltage != null && battery && batteryVoltageClass(node.voltage) !== batteryVoltageClass(battery.voltage ?? 12.8))
  if (mismatchedDcInverter) diagnostics.unshift({ id: 'inverter-dc-mismatch', severity: 'fault', title: 'Inverter DC input class does not match battery', evidence: `${mismatchedDcInverter.name} has a ${batteryVoltageClass(mismatchedDcInverter.voltage!)} V nominal DC input setting, while the configured battery is ${batteryVoltageClass(battery?.voltage ?? 12.8)} V class.`, remedy: 'Compare the inverter DC input class with the battery system class; this model does not convert between DC voltage classes.' })
  const network = solveTerminalNetwork(project, { batteryVoltage, batteryCurrent, acVoltage: acSourceVoltage, acCurrent, overload })
  const openDevices = project.nodes.filter(node => (node.kind === 'transfer' && node.switchState === 'open') || (node.kind === 'fuse' && node.tripped))
  if (openDevices.length) diagnostics.unshift({ id: 'open-device', severity: 'warning', title: 'Path is open', evidence: `${openDevices[0].name} is open, so downstream terminals are not energized.`, remedy: openDevices[0].kind === 'fuse' ? 'Reduce the fault current, then reset the protection device.' : 'Close the transfer or isolator only when the intended source path is safe.' })
  if (network.unsupported.length) diagnostics.unshift({ id: 'unsupported-phase-topology', severity: 'fault', title: 'AC topology is not supported by the placed terminals', evidence: network.unsupported[0], remedy: 'Use a single-phase profile or place a device template with the required phase terminals; the model will not fabricate phase readings.' })
  if (network.openTerminals.length) diagnostics.unshift({ id: 'open-terminal', severity: 'warning', title: 'Open terminal', evidence: `${network.openTerminals[0]} has no wire endpoint.`, remedy: 'Connect the labeled terminal or leave it intentionally open and treat readings as incomplete.' })
  const priority = { fault: 0, warning: 1, info: 2 }
  diagnostics.sort((a, b) => priority[a.severity] - priority[b.severity])
  return { runtimeSeconds, pvPower, demand, inputPower, batteryCurrent, coldVoc, voltageDrop, cableLoss, soc, overload, charging: usableSolar > inputPower, controllerLimited, topologyValid: topologyValid && network.unsupported.length === 0, surgeDemand, thermalEstimate, protectionTripped, protectionTripSeconds, batteryLimited, chargingLimited, chargeCurrent, acPowerFactor, apparentPower, acCurrent, acSourceCompatible, branchCurrents, busCurrents, diagnostics, network }
}

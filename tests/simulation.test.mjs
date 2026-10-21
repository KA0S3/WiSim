import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSimulation, validateProjectModel } from '../src/simulation.ts'
import { evaluateScenario, SCENARIOS } from '../src/scenarios.ts'

const project = {
  irradiance: 100,
  temperature: 25,
  nodes: [
    { id: 'pv', kind: 'pv', name: 'PV', watts: 800, voltage: 36 },
    { id: 'battery', kind: 'battery', name: 'Battery', voltage: 12.8, capacity: 200 },
    { id: 'inverter', kind: 'inverter', name: 'Inverter', watts: 1000 },
    { id: 'load', kind: 'load', name: 'Load', watts: 180 },
    { id: 'cable', kind: 'cable', name: 'Cable', area: 16, length: 5 },
  ],
  wires: [],
}

test('project validation rejects invalid environment and supplied canvas coordinates', () => {
  assert.equal(validateProjectModel({ ...project, irradiance: 0, temperature: -273.15 }).valid, true)
  assert.match(validateProjectModel({ ...project, irradiance: 100.1 }).errors.join(' '), /Sunlight percentage/)
  assert.match(validateProjectModel({ ...project, temperature: Number.NaN }).errors.join(' '), /Panel temperature/)
  assert.match(validateProjectModel({ ...project, ambientTemperature: -300 }).errors.join(' '), /Ambient temperature/)
  assert.match(validateProjectModel({ ...project, acSourceFrequency: 0 }).errors.join(' '), /AC source frequency/)
  assert.match(validateProjectModel({ ...project, nodes: [{ id: 'bad-position', kind: 'pv', name: 'Bad position', x: Number.POSITIVE_INFINITY, y: 0 }] }).errors.join(' '), /canvas position/)
})

test('project validation rejects malformed device operating states and model selections', () => {
  const switched = { ...project, nodes: [...project.nodes, { id: 'transfer', kind: 'transfer', name: 'Transfer', x: 0, y: 0, switchState: 'maybe' }] }
  assert.match(validateProjectModel(switched).errors.join(' '), /switch state must be open or closed/)
  const tripped = { ...project, nodes: [...project.nodes, { id: 'fuse', kind: 'fuse', name: 'Fuse', x: 0, y: 0, tripped: 'yes' }] }
  assert.match(validateProjectModel(tripped).errors.join(' '), /tripped state must be true or false/)
  const chemistry = { ...project, nodes: project.nodes.map(node => node.kind === 'battery' ? { ...node, chemistry: 'unknown' } : node) }
  assert.match(validateProjectModel(chemistry).errors.join(' '), /battery chemistry must be LiFePO4 or lead-acid/)
  const profile = { ...project, nodes: project.nodes.map(node => node.kind === 'inverter' ? { ...node, acProfile: 'worldwide' } : node) }
  assert.match(validateProjectModel(profile).errors.join(' '), /unsupported AC output profile/)
})

test('device-specific settings cannot be silently attached to a component that ignores them', () => {
  const enabled = { ...project, nodes: project.nodes.map(node => node.kind === 'load' ? { ...node, enabled: true } : node) }
  assert.match(validateProjectModel(enabled).errors.join(' '), /enabled flag has no modeled behavior/)
  const misplacedTrip = { ...project, nodes: project.nodes.map(node => node.kind === 'load' ? { ...node, tripped: false } : node) }
  assert.match(validateProjectModel(misplacedTrip).errors.join(' '), /tripped state is only modeled for protection devices/)
  const misplacedChemistry = { ...project, nodes: project.nodes.map(node => node.kind === 'inverter' ? { ...node, chemistry: 'LiFePO4' } : node) }
  assert.match(validateProjectModel(misplacedChemistry).errors.join(' '), /chemistry is only modeled for batteries/)
})

test('terminal order is validated even without a side, and placed slots remain unique', () => {
  const baseTerminalProject = { irradiance: 50, temperature: 20, nodes: [{ id: 'node', kind: 'bus', name: 'Bus', x: 0, y: 0, terminals: [] }], wires: [] }
  assert.match(validateProjectModel({ ...baseTerminalProject, nodes: [{ ...baseTerminalProject.nodes[0], terminals: [{ id: 'a', label: 'A', domain: 'dc', role: 'positive', order: 0 }] }] }).errors.join(' '), /order must be a positive whole number/)
  assert.match(validateProjectModel({ ...baseTerminalProject, nodes: [{ ...baseTerminalProject.nodes[0], terminals: [{ id: 'a', label: 'A', domain: 'dc', role: 'positive', side: 'top', order: 1 }, { id: 'b', label: 'B', domain: 'dc', role: 'negative', side: 'top', order: 1 }] }] }).errors.join(' '), /multiple terminals at top order 1/)
})

test('project validation rejects unknown conductor materials instead of treating them as copper', () => {
  const invalid = { irradiance: 50, temperature: 20, nodes: [{ id: 'a', kind: 'battery', name: 'Battery' }, { id: 'b', kind: 'inverter', name: 'Inverter' }], wires: [{ id: 'w', from: 'a', to: 'b', material: 'steel' }] }
  assert.match(validateProjectModel(invalid).errors.join(' '), /material must be copper or aluminium/)
})

test('unknown component kinds remain diagnosable without crashing the bounded solver', () => {
  const unknown = { irradiance: 50, temperature: 20, nodes: [{ id: 'mystery', kind: 'mystery-device', name: 'Imported device', x: 0, y: 0 }], wires: [] }
  assert.match(validateProjectModel(unknown).errors.join(' '), /unsupported component kind mystery-device/)
  assert.doesNotThrow(() => calculateSimulation(unknown))
})

test('project validation rejects unsupported terminal directions and wire display values', () => {
  const baseShape = { irradiance: 50, temperature: 20, nodes: [{ id: 'a', kind: 'battery', name: 'Battery', x: 0, y: 0, terminals: [{ id: 'out', label: 'OUT', domain: 'dc', role: 'positive', direction: 'sideways' }] }, { id: 'b', kind: 'inverter', name: 'Inverter', x: 100, y: 0 }], wires: [{ id: 'w', from: 'a', to: 'b', color: 'purple' }] }
  const validation = validateProjectModel(baseShape)
  const errors = validation.errors.join(' ')
  assert.match(errors, /unsupported direction/)
  assert.equal(validation.valid, false)
  assert.match(validation.warnings.join(' '), /saved display color outside the current palette/)
})

test('legacy display colors warn without invalidating the electrical model', () => {
  const project = { irradiance: 50, temperature: 20, nodes: [{ id: 'a', kind: 'battery', name: 'Battery' }, { id: 'b', kind: 'inverter', name: 'Inverter' }], wires: [{ id: 'w', from: 'a', to: 'b', color: 'purple' }] }
  const validation = validateProjectModel(project)
  assert.equal(validation.valid, true)
  assert.match(validation.warnings.join(' '), /saved display color outside the current palette/)
  assert.ok(calculateSimulation(project).diagnostics.some(event => event.title === 'Saved wire display setting needs review'))
})

test('simulation output is deterministic and includes evidence', () => {
  const first = calculateSimulation(project)
  const second = calculateSimulation(project)
  assert.deepEqual(first, second)
  assert.equal(first.overload, false)
  assert.ok(first.pvPower > 0)
  assert.ok(first.diagnostics.some(event => event.id === 'educational'))
})

test('constant-power input current rises when cable sag reduces operating voltage', () => {
  const shortCable = calculateSimulation(project)
  const longThinCable = calculateSimulation({ ...project, nodes: project.nodes.map(node => node.kind === 'cable' ? { ...node, area: 2, length: 25 } : node) })
  assert.ok(longThinCable.voltageDrop > shortCable.voltageDrop)
  assert.ok(longThinCable.batteryCurrent > shortCable.batteryCurrent)
})

test('modeled lug terminations add bounded resistance and evidence', () => {
  const plain = calculateSimulation(project)
  const lugged = calculateSimulation({ ...project, wires: [{ id: 'lugged', from: 'battery', to: 'inverter', lugFrom: 'M8', lugTo: 'M8' }] })
  assert.ok(lugged.voltageDrop > plain.voltageDrop)
  assert.ok(lugged.diagnostics.some(event => event.id === 'lug-resistance'))
})

test('parallel conductors reduce the bounded cable path resistance', () => {
  const single = calculateSimulation({ ...project, wires: [{ id: 'single', from: 'battery', to: 'inverter', parallel: 1 }] })
  const parallel = calculateSimulation({ ...project, wires: [{ id: 'parallel', from: 'battery', to: 'inverter', parallel: 2 }] })
  assert.ok(parallel.voltageDrop < single.voltageDrop)
})

test('inverter overload creates a fault diagnostic', () => {
  const result = calculateSimulation({ ...project, nodes: project.nodes.map(node => node.kind === 'load' ? { ...node, watts: 1400 } : node) })
  assert.equal(result.overload, true)
  assert.equal(result.diagnostics[0].id, 'inverter-overload')
})

test('disconnected components are reported instead of being treated as active topology', () => {
  const result = calculateSimulation({ ...project, nodes: [...project.nodes, { id: 'loose', kind: 'load', name: 'Loose load', watts: 50 }] })
  assert.equal(result.topologyValid, false)
  assert.ok(result.diagnostics.some(event => event.id === 'disconnected-topology'))
})

test('invalid wire endpoints are reported instead of silently ignored', () => {
  const result = calculateSimulation({ ...project, wires: [{ id: 'bad', from: 'load', to: 'missing' }] })
  assert.equal(result.topologyValid, false)
  assert.ok(result.diagnostics.some(event => event.id === 'invalid-wire'))
})

test('every Fault Lab scenario has an executable evaluation rule', () => {
  const result = calculateSimulation(project)
  assert.equal(SCENARIOS.length, 15)
  assert.equal(new Set(SCENARIOS.map(scenario => scenario.track)).size, 4)
  for (const scenario of SCENARIOS) {
    const evaluation = evaluateScenario(scenario.id, result)
    assert.equal(typeof evaluation.passed, 'boolean')
    assert.ok(evaluation.evidence.length > 0)
    assert.ok(scenario.hint.length > 0 && scenario.success.length > 0)
  }
})

test('multiple branches aggregate and startup surge is distinct from continuous demand', () => {
  const result = calculateSimulation({ ...project, nodes: [...project.nodes, { id: 'pv-2', kind: 'pv', name: 'Second PV', watts: 400, voltage: 36 }, { id: 'pump', kind: 'load', name: 'Pump', watts: 400, surge: 4 }] })
  assert.ok(result.pvPower > 800)
  assert.ok(result.demand > 180)
  assert.ok(result.surgeDemand > result.demand)
  assert.ok(result.thermalEstimate >= 25)
})

test('AC apparent power and current respond to power factor', () => {
  const result = calculateSimulation({ ...project, nodes: project.nodes.map(node => node.kind === 'load' ? { ...node, powerFactor: 0.8 } : node) })
  assert.equal(result.acPowerFactor, 0.8)
  assert.ok(result.apparentPower > result.demand)
  assert.ok(result.acCurrent > 0)
})

test('parallel load branches expose current shares and source reachability', () => {
  const branchProject = {
    ...project,
    nodes: [...project.nodes, { id: 'load-2', kind: 'load', name: 'Second load', watts: 90 }],
    wires: [
      { id: 'w1', from: 'pv', fromTerminal: 'pv+', to: 'battery', toTerminal: 'bat+', domain: 'dc' },
      { id: 'w2', from: 'battery', fromTerminal: 'bat+', to: 'inverter', toTerminal: 'dc+', domain: 'dc' },
      { id: 'w3', from: 'inverter', fromTerminal: 'ac-out-l', to: 'load', toTerminal: 'line', domain: 'ac' },
      { id: 'w4', from: 'inverter', fromTerminal: 'ac-out-l', to: 'load-2', toTerminal: 'line', domain: 'ac' },
      { id: 'w5', from: 'inverter', fromTerminal: 'dc+', to: 'cable', toTerminal: 'in', domain: 'dc' },
    ],
  }
  const result = calculateSimulation(branchProject)
  assert.equal(result.topologyValid, true)
  assert.ok(result.branchCurrents['load-2'] > 0)
  const unreachable = { ...branchProject, nodes: [...branchProject.nodes, { id: 'orphan', kind: 'load', name: 'Orphan load', watts: 40 }, { id: 'orphan-bus', kind: 'bus', name: 'Orphan bus' }], wires: [...branchProject.wires, { id: 'w6', from: 'orphan', to: 'orphan-bus' }] }
  const unreachableResult = calculateSimulation(unreachable)
  assert.equal(unreachableResult.topologyValid, false)
  assert.equal(unreachableResult.diagnostics[0].id, 'no-source-path')
})

test('protection model distinguishes warning overcurrent from sustained trip', () => {
  const mildlyOver = calculateSimulation({ ...project, nodes: [...project.nodes, { id: 'fuse', kind: 'fuse', name: '13 A fuse', watts: 13 }] })
  assert.equal(mildlyOver.protectionTripped, false)
  assert.ok((mildlyOver.protectionTripSeconds ?? 0) > 0)
  assert.ok(mildlyOver.diagnostics.some(event => event.id === 'protection-overcurrent'))
  const sustained = calculateSimulation({ ...project, nodes: [...project.nodes, { id: 'fuse', kind: 'fuse', name: '10 A fuse', watts: 10 }] })
  assert.equal(sustained.protectionTripped, true)
  assert.ok(sustained.diagnostics.some(event => event.id === 'protection-current'))
})

test('battery SOC moves over fixed simulation time', () => {
  const chargingProject = { ...project, nodes: project.nodes.map(node => node.kind === 'load' ? { ...node, watts: 20 } : node) }
  const initial = calculateSimulation(chargingProject, 0)
  const afterHour = calculateSimulation(chargingProject, 3600)
  assert.ok(afterHour.soc > initial.soc)
})

test('thermal estimate follows ambient temperature baseline', () => {
  const cool = calculateSimulation({ ...project, ambientTemperature: 10 })
  const warm = calculateSimulation({ ...project, ambientTemperature: 35 })
  assert.equal(warm.thermalEstimate - cool.thermalEstimate, 25)
})

test('battery charge limit caps available charging current', () => {
  const result = calculateSimulation({ ...project, nodes: project.nodes.map(node => node.kind === 'battery' ? { ...node, chargeLimit: 10 } : node) })
  assert.equal(result.chargingLimited, true)
  assert.ok(result.chargeCurrent > 10)
  assert.ok(result.diagnostics.some(event => event.id === 'battery-charge-limit'))
})

test('AC source compatibility reports unsupported voltage or frequency', () => {
  const result = calculateSimulation({ ...project, acSourceVoltage: 110, acSourceFrequency: 60 })
  assert.equal(result.acSourceCompatible, false)
  assert.ok(result.diagnostics.some(event => event.id === 'ac-source-mismatch'))
})

test('AC current uses the configured source voltage', () => {
  const at230 = calculateSimulation({ ...project, acSourceVoltage: 230 })
  const at115 = calculateSimulation({ ...project, acSourceVoltage: 115 })
  assert.ok(at115.acCurrent > at230.acCurrent)
})

test('thermal rise approaches over time instead of appearing instantly', () => {
  const initial = calculateSimulation(project, 0)
  const later = calculateSimulation(project, 120)
  assert.equal(initial.thermalEstimate, 25)
  assert.ok(later.thermalEstimate > initial.thermalEstimate)
})

test('charge limiting affects time-based SOC change', () => {
  const limited = { ...project, nodes: project.nodes.map(node => node.kind === 'battery' ? { ...node, chargeLimit: 10 } : node) }
  const initial = calculateSimulation(limited, 0)
  const afterHour = calculateSimulation(limited, 3600)
  const unlimitedAfterHour = calculateSimulation(project, 3600)
  assert.ok(afterHour.soc < unlimitedAfterHour.soc)
  assert.ok(afterHour.soc >= initial.soc - 100)
})

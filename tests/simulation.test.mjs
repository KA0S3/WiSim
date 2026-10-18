import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSimulation } from '../src/simulation.ts'
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
    wires: [{ id: 'w1', from: 'pv', to: 'battery' }, { id: 'w2', from: 'battery', to: 'inverter' }, { id: 'w3', from: 'inverter', to: 'load' }, { id: 'w4', from: 'inverter', to: 'load-2' }, { id: 'w5', from: 'inverter', to: 'cable' }],
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

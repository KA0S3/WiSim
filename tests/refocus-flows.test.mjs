import assert from 'node:assert/strict'
import test from 'node:test'
import { CATALOG_RECORDS } from '../src/catalog.ts'
import { applyRecordToNode, compareRecord } from '../src/compatibility.ts'
import { createScenarioProject } from '../src/scenarios.ts'
import { calculateSimulation, measureProbe } from '../src/simulation.ts'

const base = {
  irradiance: 82, temperature: 25, acProfile: '230v-50hz', acSourceVoltage: 230, acSourceFrequency: 50,
  nodes: [
    { id: 'bat', kind: 'battery', name: 'Battery', x: 0, y: 0, voltage: 12.8, capacity: 200 },
    { id: 'inv', kind: 'inverter', name: 'Inverter', x: 200, y: 0, watts: 1000, surge: 2000 },
    { id: 'load', kind: 'load', name: 'Load', x: 400, y: 0, watts: 180 },
  ],
  wires: [
    { id: 'dc', from: 'bat', fromTerminal: 'bat+', to: 'inv', toTerminal: 'dc+', domain: 'dc', gauge: 16, length: 3 },
    { id: 'ac', from: 'inv', fromTerminal: 'ac-out-l', to: 'load', toTerminal: 'line', domain: 'ac', gauge: 2.5, length: 5 },
  ],
}

test('contextual model matching exposes pass/fail/unknown and applying preserves placement', () => {
  const node = base.nodes[1]
  const record = CATALOG_RECORDS.find(item => item.id === 'victron-multiplus-12-1200')
  const match = compareRecord(record, node)
  assert.ok(['pass', 'needs verification', 'fail'].includes(match.status))
  const applied = applyRecordToNode(node, record)
  assert.equal(applied.modelId, record.id)
  assert.equal(applied.x, node.x)
  assert.equal(applied.terminals.length, 8)
})

test('meter probe reads the same live solution and identifies open continuity', () => {
  const project = { ...base, probes: [{ id: 'p1', positive: { nodeId: 'bat', terminalId: 'bat+' }, negative: { nodeId: 'inv', terminalId: 'dc+' }, mode: 'voltage' }] }
  const result = calculateSimulation(project)
  const reading = measureProbe(project, result, project.probes[0])
  assert.equal(reading.supported, true)
  assert.equal(reading.unit, 'V')
  const continuity = measureProbe(project, result, { id: 'p2', positive: { nodeId: 'load', terminalId: 'neutral' }, mode: 'continuity' })
  assert.equal(continuity.value, 0)
})

test('scenario copies alter only the challenge project and carry scenario identity', () => {
  const copy = createScenarioProject('pump-surge', base)
  assert.equal(copy.scenario.id, 'pump-surge')
  assert.notEqual(copy.nodes.find(node => node.id === 'load').surge, base.nodes.find(node => node.id === 'load').surge)
  assert.equal(base.scenario, undefined)
})

test('phase profiles refuse silent multi-phase behavior when device terminals do not support it', () => {
  const project = { ...base, acProfile: 'three-phase-400v-50hz', acSourceVoltage: 400, acSourceFrequency: 50 }
  const result = calculateSimulation(project)
  assert.ok(result.network.unsupported.length > 0)
  assert.equal(result.topologyValid, false)
  assert.ok(result.diagnostics.some(event => event.id === 'unsupported-phase-topology'))
})

test('split and three-phase profiles expose their modeled terminal voltages', () => {
  const project = { ...base, nodes: [...base.nodes, { id: 'shore', kind: 'ac-source', name: 'Shore', x: -200, y: 0 }], acProfile: 'split-120-240v-60hz', acSourceVoltage: 240, acSourceFrequency: 60 }
  const split = calculateSimulation(project)
  assert.equal(split.network.terminalReadings['shore:line'].voltage, 120)
  assert.equal(split.network.terminalReadings['inv:ac-in-a'].voltage, 120)
  const threePhase = calculateSimulation({ ...project, acProfile: 'three-phase-400v-50hz', acSourceVoltage: 400, acSourceFrequency: 50 })
  assert.equal(threePhase.network.terminalReadings['inv:ac-in-a'].voltage, 230.9)
})

test('latched protection remains a visible fault until the project resets it', () => {
  const project = { ...base, nodes: [...base.nodes, { id: 'fuse', kind: 'fuse', name: 'Breaker', x: 5, y: 5, watts: 40, tripped: true, resettable: true }] }
  const result = calculateSimulation(project)
  assert.equal(result.protectionTripped, true)
  assert.ok(result.diagnostics.some(event => event.title === 'Breaker is tripped'))
  const reset = calculateSimulation({ ...project, nodes: project.nodes.map(node => node.id === 'fuse' ? { ...node, tripped: false } : node) })
  assert.equal(reset.protectionTripped, false)
})

test('AC source and transfer state control reachability instead of acting as labels', () => {
  const project = { ...base, nodes: [...base.nodes, { id: 'shore', kind: 'ac-source', name: 'Shore', x: -200, y: 0 }, { id: 'transfer', kind: 'transfer', name: 'Transfer', x: -50, y: 0, switchState: 'closed' }], wires: [...base.wires, { id: 'shore-l', from: 'shore', fromTerminal: 'line', to: 'transfer', toTerminal: 'in-line', domain: 'ac' }, { id: 'transfer-l', from: 'transfer', fromTerminal: 'out-line', to: 'inv', toTerminal: 'ac-in-l', domain: 'ac' }] }
  const closed = calculateSimulation(project)
  assert.ok(closed.network.activePaths.includes('transfer-l'))
  const open = calculateSimulation({ ...project, nodes: project.nodes.map(node => node.id === 'transfer' ? { ...node, switchState: 'open' } : node) })
  assert.ok(open.network.unsupported.length === 0)
  assert.ok(open.diagnostics.some(event => event.id === 'open-device' || event.id === 'no-source-path'))
})

test('bus current sharing reports each downstream branch and the summed total', () => {
  const project = {
    ...base,
    nodes: [
      { id: 'bat', kind: 'battery', name: 'Battery', x: 0, y: 0, voltage: 12.8, capacity: 200 },
      { id: 'bus', kind: 'bus', name: 'DC bus', x: 180, y: 0 },
      { id: 'load-a', kind: 'load', name: 'Load A', x: 360, y: -80, watts: 100 },
      { id: 'load-b', kind: 'load', name: 'Load B', x: 360, y: 80, watts: 200 },
    ],
    wires: [
      { id: 'feed', from: 'bat', fromTerminal: 'bat+', to: 'bus', toTerminal: 'positive', domain: 'dc', gauge: 16, length: 2 },
      { id: 'branch-a', from: 'bus', fromTerminal: 'positive', to: 'load-a', toTerminal: 'line', domain: 'dc', gauge: 6, length: 3 },
      { id: 'branch-b', from: 'bus', fromTerminal: 'positive', to: 'load-b', toTerminal: 'line', domain: 'dc', gauge: 6, length: 3 },
    ],
  }
  const result = calculateSimulation(project)
  const sharing = result.busCurrents.bus
  assert.ok(sharing)
  assert.ok(sharing.branches['branch-a'] > 0)
  assert.ok(sharing.branches['branch-b'] > sharing.branches['branch-a'])
  assert.equal(sharing.total, sharing.branches['branch-a'] + sharing.branches['branch-b'])
})

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
  const node = { id: 'mppt', kind: 'mppt', name: 'Controller', x: 200, y: 40, watts: 200, voltage: 12 }
  const record = CATALOG_RECORDS.find(item => item.id === 'victron-smartsolar-75-15')
  const match = compareRecord(record, node)
  assert.ok(['pass', 'needs verification', 'fail'].includes(match.status))
  const applied = applyRecordToNode(node, record)
  assert.equal(applied.modelId, record.id)
  assert.equal(applied.x, node.x)
  assert.equal(applied.terminals.length, 6)
  assert.equal(applied.terminals[0].side, 'bottom')
})

test('inverter catalogue matches compare sourced AC ratings with the selected output profile', () => {
  const record = CATALOG_RECORDS.find(item => item.id === 'victron-phoenix-12-1200-230v')
  const node = { id: 'inv', kind: 'inverter', name: 'Inverter', x: 0, y: 0 }
  const match230 = compareRecord(record, node, '230v-50hz').checks.find(check => check.label === 'AC profile')
  const mismatch120 = compareRecord(record, node, '120v-60hz').checks.find(check => check.label === 'AC profile')
  const incomplete = compareRecord({ ...record, acVoltage: undefined, acFrequency: undefined }, node, '230v-50hz').checks.find(check => check.label === 'AC profile')
  assert.equal(match230.status, 'pass')
  assert.match(match230.evidence, /matches selected/)
  assert.equal(mismatch120.status, 'fail')
  assert.match(mismatch120.evidence, /does not match selected/)
  assert.equal(incomplete.status, 'needs verification')
})

test('inverter source ratings apply to editable AC/DC settings and mismatches stay unsupported', () => {
  const record = CATALOG_RECORDS.find(item => item.id === 'victron-phoenix-12-1200-230v')
  const applied = applyRecordToNode({ id: 'inv', kind: 'inverter', name: 'Inverter', x: 200, y: 0 }, record)
  assert.equal(applied.voltage, 12)
  assert.equal(applied.acVoltage, 230)
  assert.equal(applied.acFrequency, 50)
  const matching = calculateSimulation({ ...base, nodes: base.nodes.map(node => node.id === 'inv' ? { ...node, ...applied } : node) })
  assert.equal(matching.diagnostics.some(event => event.id === 'inverter-ac-mismatch' || event.id === 'inverter-dc-mismatch'), false)
  const mismatched = calculateSimulation({ ...base, nodes: base.nodes.map(node => node.id === 'inv' ? { ...node, voltage: 24, acVoltage: 120, acFrequency: 60 } : node) })
  assert.ok(mismatched.diagnostics.some(event => event.id === 'inverter-ac-mismatch'))
  assert.ok(mismatched.diagnostics.some(event => event.id === 'inverter-dc-mismatch'))
  assert.equal(mismatched.network.terminalReadings['inv:ac-out-l'].state, 'unsupported')
  assert.equal(mismatched.network.terminalReadings['inv:dc+'].state, 'unsupported')
})

test('meter probe reads the same live solution and distinguishes missing leads from open continuity', () => {
  const project = { ...base, probes: [{ id: 'p1', positive: { nodeId: 'bat', terminalId: 'bat+' }, negative: { nodeId: 'inv', terminalId: 'dc+' }, mode: 'voltage' }] }
  const result = calculateSimulation(project)
  const reading = measureProbe(project, result, project.probes[0])
  assert.equal(reading.supported, true)
  assert.equal(reading.unit, 'V')
  const missingLead = measureProbe(project, result, { id: 'p2', positive: { nodeId: 'load', terminalId: 'neutral' }, mode: 'continuity' })
  assert.equal(missingLead.supported, false)
  assert.equal(missingLead.value, null)
  assert.match(missingLead.explanation, /both meter leads/)
  const continuity = measureProbe(project, result, { id: 'p3', positive: { nodeId: 'inv', terminalId: 'ac-out-n' }, negative: { nodeId: 'load', terminalId: 'neutral' }, mode: 'continuity' })
  assert.equal(continuity.supported, true)
  assert.equal(continuity.value, 0)
})

test('resistance meter uses the declared conductor material and refuses unknown materials', () => {
  const wire = { ...base.wires[0], material: 'copper', gauge: 16, length: 3, parallel: 1 }
  const project = { ...base, wires: [wire, ...base.wires.slice(1)] }
  const result = calculateSimulation(project)
  const probe = { id: 'resistance', positive: { nodeId: 'bat', terminalId: 'bat+' }, negative: { nodeId: 'inv', terminalId: 'dc+' }, mode: 'resistance' }
  const copper = measureProbe(project, result, probe)
  assert.equal(copper.supported, true)
  assert.ok(Math.abs(copper.value - 0.0175 * 3 / 16) < 1e-12)
  const unknownWire = { ...wire, material: 'unknown' }
  const unknownProject = { ...project, wires: [unknownWire, ...project.wires.slice(1)] }
  const unknown = measureProbe(unknownProject, calculateSimulation(unknownProject), probe)
  assert.equal(unknown.supported, false)
  assert.match(unknown.explanation, /unsupported conductor material/)
})

test('MPPT sourced PV power table and charge-current limit follow the selected battery system class', () => {
  const project = {
    irradiance: 100, temperature: 25,
    nodes: [
      { id: 'pv', kind: 'pv', name: 'PV', x: 0, y: 0, watts: 1000, voltage: 36 },
      { id: 'mppt', kind: 'mppt', name: 'Controller', x: 180, y: 0, watts: 220, powerLimitByVoltage: { '12': 220, '24': 440 }, supportedBatteryVoltages: [12, 24], chargeLimit: 15 },
      { id: 'bat', kind: 'battery', name: 'Battery', x: 360, y: 0, voltage: 25.6, capacity: 200, chargeLimit: 60 },
    ],
    wires: [],
  }
  const result = calculateSimulation(project)
  assert.equal(result.controllerLimited, true)
  assert.equal(result.chargingLimited, true)
  assert.ok(result.diagnostics.some(event => event.id === 'battery-charge-limit' && event.evidence.includes('15 A')))
  const incompatible = { ...project, nodes: project.nodes.map(node => node.id === 'bat' ? { ...node, voltage: 51.2 } : node) }
  assert.ok(calculateSimulation(incompatible).diagnostics.some(event => event.evidence.includes('configured battery is 48 V')))
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

test('data and earth links do not create powered load reachability', () => {
  for (const domain of ['data', 'earth']) {
    const role = domain === 'data' ? 'control' : 'ac-earth'
    const project = {
      irradiance: 50, temperature: 20,
      nodes: [
        { id: 'signal-source', kind: 'ac-source', name: 'Signal source', x: 0, y: 0, terminals: [{ id: 'signal', label: 'Signal', domain, role, direction: 'source' }] },
        { id: 'load', kind: 'load', name: 'Signal-only load', x: 180, y: 0, watts: 60, terminals: [{ id: 'signal', label: 'Signal', domain, role, direction: 'sink' }] },
      ],
      wires: [{ id: 'non-power-link', from: 'signal-source', fromTerminal: 'signal', to: 'load', toTerminal: 'signal', domain }],
    }
    const result = calculateSimulation(project)
    assert.equal(result.topologyValid, false, `${domain} link must not energize a load`)
    assert.ok(result.diagnostics.some(event => event.id === 'no-source-path'))
    if (domain === 'data') assert.ok(result.diagnostics.some(event => event.evidence.includes('control/data link')))
  }
  const busProject = {
    irradiance: 50, temperature: 20,
    nodes: [
      { id: 'battery', kind: 'battery', name: 'Battery', x: 0, y: 0, terminals: [{ id: 'bat+', label: 'BAT +', domain: 'dc', role: 'positive' }] },
      { id: 'bus', kind: 'bus', name: 'DC bus', x: 180, y: 0, terminals: [
        { id: 'bus+', label: 'BUS +', domain: 'dc', role: 'positive' },
        { id: 'signal', label: 'Signal', domain: 'data', role: 'control' },
      ] },
      { id: 'load', kind: 'load', name: 'Signal-only load', x: 360, y: 0, watts: 60, terminals: [{ id: 'signal', label: 'Signal', domain: 'data', role: 'control' }] },
    ],
    wires: [
      { id: 'feed', from: 'battery', fromTerminal: 'bat+', to: 'bus', toTerminal: 'bus+', domain: 'dc' },
      { id: 'signal-branch', from: 'bus', fromTerminal: 'signal', to: 'load', toTerminal: 'signal', domain: 'data' },
    ],
  }
  assert.equal(calculateSimulation(busProject).busCurrents.bus.branches['signal-branch'], undefined)
})

test('legacy endpoint-only wires remain saved but do not imply a guessed powered path', () => {
  const project = {
    irradiance: 50, temperature: 20,
    nodes: [
      { id: 'battery', kind: 'battery', name: 'Battery', x: 0, y: 0 },
      { id: 'load', kind: 'load', name: 'Load', x: 180, y: 0, watts: 60 },
    ],
    wires: [{ id: 'legacy-link', from: 'battery', to: 'load', domain: 'dc' }],
  }
  const result = calculateSimulation(project)
  assert.equal(result.topologyValid, false)
  assert.ok(result.diagnostics.some(event => event.id === 'no-source-path'))
  assert.equal(project.wires.length, 1)
  assert.equal(project.wires[0].fromTerminal, undefined)
})

test('bus current sharing reports each downstream branch and the summed total', () => {
  const project = {
    ...base,
    nodes: [
      { id: 'bat', kind: 'battery', name: 'Battery', x: 0, y: 0, voltage: 12.8, capacity: 200 },
      { id: 'bus', kind: 'bus', name: 'DC bus', x: 180, y: 0 },
      { id: 'load-a', kind: 'load', name: 'Load A', x: 360, y: -80, watts: 100, terminals: [{ id: 'line', label: 'DC +', domain: 'dc', role: 'positive', direction: 'sink' }] },
      { id: 'load-b', kind: 'load', name: 'Load B', x: 360, y: 80, watts: 200, terminals: [{ id: 'line', label: 'DC +', domain: 'dc', role: 'positive', direction: 'sink' }] },
    ],
    wires: [
      { id: 'feed', from: 'bat', fromTerminal: 'bat+', to: 'bus', toTerminal: 'bus+', domain: 'dc', gauge: 16, length: 2 },
      { id: 'branch-a', from: 'bus', fromTerminal: 'bus+', to: 'load-a', toTerminal: 'line', domain: 'dc', gauge: 6, length: 3 },
      { id: 'branch-b', from: 'bus', fromTerminal: 'bus+', to: 'load-b', toTerminal: 'line', domain: 'dc', gauge: 6, length: 3 },
    ],
  }
  const result = calculateSimulation(project)
  const sharing = result.busCurrents.bus
  assert.ok(sharing)
  assert.ok(sharing.branches['branch-a'] > 0)
  assert.ok(sharing.branches['branch-b'] > sharing.branches['branch-a'])
  assert.equal(sharing.total, sharing.branches['branch-a'] + sharing.branches['branch-b'])
  const branchProbe = measureProbe(project, result, { id: 'branch-meter', positive: { nodeId: 'bus', terminalId: 'bus+' }, negative: { nodeId: 'load-a', terminalId: 'line' }, mode: 'current' })
  assert.equal(branchProbe.supported, true)
  assert.equal(branchProbe.value, sharing.branches['branch-a'])
  assert.match(branchProbe.explanation, /DC bus-branch estimate/)
})

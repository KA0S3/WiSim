import assert from 'node:assert/strict'
import test from 'node:test'
import { AC_PROFILES, defaultTerminals, validateProjectModel } from '../src/simulation.ts'

const node = (id, kind) => ({ id, kind, name: id, x: 0, y: 0 })

test('default device layouts preserve distinct inverter power and control ports', () => {
  const terminals = defaultTerminals('inverter')
  assert.deepEqual(terminals.map(terminal => terminal.id), ['dc+', 'dc-', 'ac-in-l', 'ac-in-n', 'ac-in-a', 'ac-in-b', 'ac-in-c', 'ac-out-l', 'ac-out-n', 'ac-out-a', 'ac-out-b', 'ac-out-c', 'pe', 'control'])
  assert.equal(terminals.find(terminal => terminal.id === 'control').domain, 'data')
})

test('terminal validation rejects illegal domain joins and missing terminal ids', () => {
  const project = { nodes: [node('pv', 'pv'), node('load', 'load')], wires: [{ id: 'w1', from: 'pv', fromTerminal: 'pv+', to: 'load', toTerminal: 'earth' }], irradiance: 100, temperature: 25 }
  const report = validateProjectModel(project)
  assert.equal(report.valid, false)
  assert.ok(report.errors.some(error => error.includes('joins dc to earth')))
})

test('terminal validation reports reverse-polarity role joins', () => {
  const project = { nodes: [node('pv', 'pv'), node('battery', 'battery')], wires: [{ id: 'w1', from: 'pv', fromTerminal: 'pv+', to: 'battery', toTerminal: 'bat-' }], irradiance: 100, temperature: 25 }
  const report = validateProjectModel(project)
  assert.equal(report.valid, false)
  assert.ok(report.errors.some(error => error.includes('incompatible terminal roles')))
})

test('terminal validation identifies a DC polarity short explicitly', () => {
  const project = { nodes: [node('battery', 'battery'), node('bus', 'bus')], wires: [{ id: 'short', from: 'battery', fromTerminal: 'bat+', to: 'bus', toTerminal: 'bus-' }], irradiance: 100, temperature: 25 }
  const report = validateProjectModel(project)
  assert.equal(report.valid, false)
  assert.ok(report.errors.some(error => error.includes('DC polarity short')))
})

test('terminal validation identifies an AC conductor short explicitly', () => {
  const project = { nodes: [node('source', 'ac-source'), node('load', 'load')], wires: [{ id: 'short', from: 'source', fromTerminal: 'line', to: 'load', toTerminal: 'neutral' }], irradiance: 100, temperature: 25 }
  const report = validateProjectModel(project)
  assert.equal(report.valid, false)
  assert.ok(report.errors.some(error => error.includes('AC conductor short')))
})

test('all four AC profiles have explicit voltage, frequency and phase semantics', () => {
  assert.equal(Object.keys(AC_PROFILES).length, 4)
  assert.equal(AC_PROFILES['split-120-240v-60hz'].phases, 2)
  assert.ok(AC_PROFILES['three-phase-400v-50hz'].terminals.includes('phase-c'))
})

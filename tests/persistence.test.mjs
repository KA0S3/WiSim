import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProject, PROJECT_SCHEMA_VERSION, saveProject } from '../src/persistence.ts'

const valid = { irradiance: 80, temperature: 25, nodes: [], wires: [] }

test('project parser accepts the current schema shape', () => {
  assert.equal(PROJECT_SCHEMA_VERSION, 3)
  assert.deepEqual(parseProject(valid), valid)
  assert.deepEqual(parseProject({ schemaVersion: 1, project: valid }), valid)
})

test('project parser accepts the persisted schema envelope and rejects future versions', () => {
  const project = { nodes: [], wires: [], irradiance: 100, temperature: 25 }
  assert.deepEqual(parseProject({ schemaVersion: 1, project }), project)
  assert.equal(parseProject({ schemaVersion: 99, project }), null)
})

test('project parser rejects malformed imports', () => {
  assert.equal(parseProject(null), null)
  assert.equal(parseProject({ nodes: [] }), null)
  assert.equal(parseProject({ project: { nodes: [], wires: [] } }), null)
  assert.equal(parseProject({ irradiance: 80, temperature: 25, nodes: [null], wires: [] }), null)
  assert.equal(parseProject({ irradiance: 80, temperature: 25, nodes: [], wires: [null] }), null)
  assert.equal(parseProject({ irradiance: 80, temperature: 25, nodes: [{ id: 'n', kind: 'pv', terminals: {} }], wires: [] }), null)
  assert.equal(parseProject({ irradiance: 80, temperature: 25, nodes: [], wires: [{ id: 'w', from: 'a', to: 'b', points: {} }] }), null)
  assert.equal(parseProject({ irradiance: 80, temperature: 25, nodes: [], wires: [], probes: [{ id: 'p', positive: null, mode: 'voltage' }] }), null)
})

test('schema v2 preserves probes and scenario/lesson working-copy metadata', () => {
  const project = { irradiance: 80, temperature: 25, nodes: [], wires: [], probes: [{ id: 'p', positive: { nodeId: 'a', terminalId: 'x' }, mode: 'continuity' }], scenario: { id: 'fuse-selection' }, lesson: { id: 'pv-backup-230v' } }
  const parsed = parseProject({ schemaVersion: 2, project })
  assert.deepEqual(parsed.probes, project.probes)
  assert.equal(parsed.scenario.id, 'fuse-selection')
  assert.equal(parsed.lesson.id, 'pv-backup-230v')
})

test('schema v2 preserves orthogonal wire bend points', () => {
  const project = { irradiance: 80, temperature: 25, nodes: [], wires: [{ id: 'w', from: 'a', to: 'b', points: [{ x: 456, y: 0 }] }] }
  const parsed = parseProject({ schemaVersion: 2, project })
  assert.deepEqual(parsed.wires[0].points, project.wires[0].points)
})

test('schema v2 preserves bounded diagnostic event history', () => {
  const project = { irradiance: 80, temperature: 25, nodes: [], wires: [], events: [{ id: 'e1', signature: 'educational:info', timestamp: 1, severity: 'info', title: 'Educational model active', evidence: 'bounded', remedy: 'review limits' }] }
  const parsed = parseProject({ schemaVersion: 2, project })
  assert.deepEqual(parsed.events, project.events)
})

test('schema v2 promotes legacy fuse watts to an explicit ampere field without discarding the old value', () => {
  const project = { irradiance: 80, temperature: 25, nodes: [{ id: 'fuse', kind: 'fuse', name: 'Protection', x: 0, y: 0, watts: 60 }], wires: [] }
  const parsed = parseProject({ schemaVersion: 2, project })
  assert.equal(parsed.nodes[0].currentLimitA, 60)
  assert.equal(parsed.nodes[0].watts, 60)
})

test('saveProject reports local storage success and failure', async () => {
  const previous = globalThis.localStorage
  const project = { irradiance: 80, temperature: 25, nodes: [], wires: [] }
  globalThis.localStorage = { setItem: () => {} }
  assert.equal(await saveProject(project), true)
  globalThis.localStorage = { setItem: () => { throw new Error('quota') } }
  assert.equal(await saveProject(project), false)
  globalThis.localStorage = previous
})

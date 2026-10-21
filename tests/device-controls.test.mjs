import test from 'node:test'
import assert from 'node:assert/strict'
import { toggleDevicePath } from '../src/deviceControls.ts'

const project = { irradiance: 50, temperature: 20, nodes: [
  { id: 'switch', kind: 'transfer', name: 'Transfer', x: 0, y: 0 },
  { id: 'fuse', kind: 'fuse', name: 'Fuse', x: 80, y: 0, tripped: false, currentLimitA: 40 },
  { id: 'load', kind: 'load', name: 'Load', x: 160, y: 0, watts: 100 },
], wires: [] }

test('transfer switch toggles between implied closed and explicit open without losing identity', () => {
  const opened = toggleDevicePath(project, 'switch')
  assert.equal(opened.nodes[0].switchState, 'open')
  assert.equal(opened.nodes[0].id, 'switch')
  const closed = toggleDevicePath(opened, 'switch')
  assert.equal(closed.nodes[0].switchState, 'closed')
})

test('fuse toggles trip state while preserving its modeled rating', () => {
  const tripped = toggleDevicePath(project, 'fuse')
  assert.equal(tripped.nodes[1].tripped, true)
  assert.equal(tripped.nodes[1].currentLimitA, 40)
  assert.equal(toggleDevicePath(tripped, 'fuse').nodes[1].tripped, false)
})

test('non-resettable modeled protection cannot be reset through the toggle', () => {
  const nonResettable = { ...project, nodes: project.nodes.map(node => node.id === 'fuse' ? { ...node, tripped: true, resettable: false } : node) }
  assert.equal(toggleDevicePath(nonResettable, 'fuse'), nonResettable)
})

test('unsupported device IDs leave the project unchanged', () => {
  assert.equal(toggleDevicePath(project, 'load'), project)
  assert.equal(toggleDevicePath(project, 'missing'), project)
})

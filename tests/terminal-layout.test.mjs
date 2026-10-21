import test from 'node:test'
import assert from 'node:assert/strict'
import { placeTerminal, terminalOrder, terminalSide } from '../src/terminalLayout.ts'

const terminals = [
  { id: 'positive', label: 'BAT +', domain: 'dc', role: 'positive', side: 'left', order: 1, x: 1, y: 2 },
  { id: 'negative', label: 'BAT −', domain: 'dc', role: 'negative', side: 'left', order: 2 },
  { id: 'earth', label: 'PE', domain: 'earth', role: 'ac-earth', side: 'right', order: 1 },
]

test('moving a terminal between sides keeps terminal identity and closes the source slot gap', () => {
  const placed = placeTerminal(terminals, 'positive', 'right', 2)
  assert.equal(placed.find(item => item.id === 'positive')?.side, 'right')
  assert.equal(placed.find(item => item.id === 'positive')?.order, 2)
  assert.equal(placed.find(item => item.id === 'negative')?.side, 'left')
  assert.equal(placed.find(item => item.id === 'negative')?.order, 1)
  assert.deepEqual(placed.map(item => item.id), terminals.map(item => item.id))
  assert.equal(placed.find(item => item.id === 'positive')?.role, 'positive')
  assert.equal(placed.find(item => item.id === 'positive')?.x, undefined)
})

test('reordering within a side produces contiguous slots and preserves connected terminal IDs', () => {
  const placed = placeTerminal(terminals, 'negative', 'left', 1)
  assert.equal(placed.find(item => item.id === 'negative')?.order, 1)
  assert.equal(placed.find(item => item.id === 'positive')?.order, 2)
  assert.deepEqual(placed.map(item => item.id).sort(), terminals.map(item => item.id).sort())
  assert.equal(terminalOrder(placed, placed.find(item => item.id === 'negative')), 1)
  assert.equal(terminalSide(placed, placed.find(item => item.id === 'negative')), 'left')
})

test('missing terminal placement request leaves the terminal layout unchanged', () => {
  assert.equal(placeTerminal(terminals, 'missing', 'top', 1), terminals)
})

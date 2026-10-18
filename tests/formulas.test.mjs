import test from 'node:test'
import assert from 'node:assert/strict'

test('cable voltage drop increases with current', () => {
  const resistance = 0.008
  assert.equal(10 * resistance, 0.08)
  assert.ok(20 * resistance > 10 * resistance)
})

test('cold PV voltage is higher for a negative temperature coefficient', () => {
  const voc = 36
  const coefficient = -0.0029
  const cold = voc * (1 + coefficient * (5 - 25))
  assert.ok(cold > voc)
})

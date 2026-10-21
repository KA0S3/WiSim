import test from 'node:test'
import assert from 'node:assert/strict'
import { explainModelBoundaryWarning } from '../src/diagnosticTeaching.ts'

test('model-boundary warnings explain the specific issue without overstating the solver', () => {
  const cases = [
    ['control/data link', 'signal or communication path', 'does not simulate protocols'],
    ['Wire w1 joins two sink terminals', 'source and sink roles', 'does not solve directional current flow'],
    ['Wire w2 is behind an open protection or transfer device', 'interrupts this represented path', 'simplified learner-controlled model'],
    ['Wire w3 has a saved display color outside the current palette', 'display tag is not recognized', 'Terminal domains determine modeled electrical compatibility'],
  ]
  for (const [evidence, why, boundary] of cases) {
    const explanation = explainModelBoundaryWarning(evidence)
    assert.match(explanation.why, new RegExp(why, 'i'))
    assert.match(explanation.boundary, new RegExp(boundary, 'i'))
  }
})

test('unknown model-boundary notes receive an honest general explanation', () => {
  const explanation = explainModelBoundaryWarning('A future model condition')
  assert.match(explanation.why, /may differ from the intended learning example/)
  assert.match(explanation.boundary, /does not infer undocumented device behavior/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { DESIGN_LESSONS, TRAINING_TRACKS, evaluateDesignLesson } from '../src/training.ts'
import { calculateSimulation } from '../src/simulation.ts'

test('training ships four progressive tracks with replayable answer content', () => {
  assert.equal(TRAINING_TRACKS.length, 4)
  assert.equal(TRAINING_TRACKS.reduce((total, track) => total + track.lessons.length, 0), 12)
  assert.ok(TRAINING_TRACKS.every(track => track.lessons.every(lesson => lesson.options.length >= 3 && lesson.explanation && lesson.hint)))
})

test('design lessons expose measurable requirements and only pass from live evidence', () => {
  assert.ok(DESIGN_LESSONS.every(lesson => lesson.profile && lesson.maxDemand > 0 && lesson.maxSurge >= lesson.maxDemand && lesson.minimumSolar > 0 && lesson.minimumRuntimeSeconds >= 0 && lesson.minimumEnergyWh >= 0))
  const lesson = DESIGN_LESSONS[0]
  const project = { irradiance: 100, temperature: 25, acProfile: lesson.profile, acSourceVoltage: 230, acSourceFrequency: 50, nodes: [{ id: 'pv', kind: 'pv', name: 'PV', x: 0, y: 0, watts: 800, voltage: 36 }, { id: 'battery', kind: 'battery', name: 'Battery', x: 1, y: 1, voltage: 12.8, capacity: 200 }, { id: 'inverter', kind: 'inverter', name: 'Inverter', x: 2, y: 2, watts: 1000, surge: 2000 }, { id: 'load', kind: 'load', name: 'Load', x: 3, y: 3, watts: 180 }], wires: [{ id: 'w1', from: 'pv', to: 'battery' }, { id: 'w2', from: 'battery', to: 'inverter' }, { id: 'w3', from: 'inverter', to: 'load' }] }
  const evaluation = evaluateDesignLesson(lesson.id, project, calculateSimulation(project))
  assert.equal(typeof evaluation.passed, 'boolean')
  assert.match(evaluation.evidence, /demand/)
})

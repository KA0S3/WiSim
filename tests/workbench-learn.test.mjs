import test from 'node:test'
import assert from 'node:assert/strict'

import { LEARN_SCENARIOS, restoreLearnClient, trainingDeparture, createLearnTrainingProject, chooseLearnScenario, createLearnScenarioProject, emptyLearnProgress, evaluateLearnScenario, markLearnCompletion, normalizeLearnProgress, recordLearnScenarioCompletion, sampleLearnScenarioRun } from '../src/workbench/learn.ts'
import { blankProject } from '../src/workbench/model.ts'

test('learn scenarios cover more than 25 client scenarios with explicit checks', () => {
  assert.equal(LEARN_SCENARIOS.length, 53)
  assert.equal(new Set(LEARN_SCENARIOS.map(scenario => scenario.id)).size, LEARN_SCENARIOS.length)
  assert.ok(LEARN_SCENARIOS.every(scenario => scenario.requirements.length >= 2))
})

test('random selection completes a difficulty pool before starting a fresh cycle', () => {
  const difficulty = 'Beginner'
  const pool = LEARN_SCENARIOS.filter(scenario => scenario.difficulty === difficulty)
  let progress = emptyLearnProgress()
  const selectedIds = []

  for (let index = 0; index < pool.length; index += 1) {
    const choice = chooseLearnScenario(LEARN_SCENARIOS, difficulty, progress, () => 0)
    assert.equal(choice.cycleReset, false)
    assert.ok(!selectedIds.includes(choice.scenario.id))
    selectedIds.push(choice.scenario.id)
    progress = recordLearnScenarioCompletion(choice.progress, choice.scenario)
  }

  assert.deepEqual(new Set(selectedIds), new Set(pool.map(scenario => scenario.id)))
  const next = chooseLearnScenario(LEARN_SCENARIOS, difficulty, progress, () => 0)
  assert.equal(next.cycleReset, true)
  assert.equal(next.progress.completedByDifficulty[difficulty].length, 0)
  assert.ok(pool.some(scenario => scenario.id === next.scenario.id))
  assert.equal(next.progress.totalCompletions, pool.length)
})

test('completion history is difficulty-scoped, idempotent, and normalizable', () => {
  const scenario = LEARN_SCENARIOS.find(candidate => candidate.difficulty === 'Ready')
  const first = recordLearnScenarioCompletion(emptyLearnProgress(), scenario)
  const repeated = recordLearnScenarioCompletion(first, scenario)

  assert.deepEqual(repeated, first)
  assert.deepEqual(first.completedByDifficulty.Ready, [scenario.id])
  assert.deepEqual(first.completedByDifficulty.Beginner, [])
  assert.deepEqual(normalizeLearnProgress(JSON.parse(JSON.stringify(first))), first)
})

test('scenario run values are stable for a given seed and differ across scenarios', () => {
  const scenario = LEARN_SCENARIOS[0]
  const runA = sampleLearnScenarioRun(scenario, 'demo-seed')
  const runB = sampleLearnScenarioRun(scenario, 'demo-seed')
  const other = sampleLearnScenarioRun(LEARN_SCENARIOS[1], 'demo-seed')

  assert.deepEqual(runA, runB)
  assert.notDeepEqual(runA, other)
})

test('scenario completion stores sampled values and marks achievement state', () => {
  const scenario = LEARN_SCENARIOS[5]
  const run = sampleLearnScenarioRun(scenario, 'persisted-run')
  const project = createLearnScenarioProject(blankProject(), scenario, run)
  const completed = markLearnCompletion(project, scenario)

  assert.ok(project.learn)
  assert.equal(project.learn.scenarioId, scenario.id)
  assert.deepEqual(project.learn.sample, run)
  assert.equal(completed.learn.completed, true)
  assert.ok(completed.learn.completedAt)
})

test('explicit requirement checks can fail and provide evidence', () => {
  const scenario = LEARN_SCENARIOS[0]
  const run = sampleLearnScenarioRun(scenario, 'evidence-seed')
  const project = createLearnScenarioProject(blankProject(), scenario, run)
  const failed = evaluateLearnScenario({ ...project, initialSoc: 6 }, null, scenario, run)

  assert.equal(failed.allPassed, false)
  assert.ok(failed.checklist.some(item => item.passed === false))
  assert.ok(failed.checklist.some(item => item.evidence.length > 0))
})

test('build learning runs include client equipment and retain the client brief and require a powered client load', () => {
 const scenario=LEARN_SCENARIOS[0],sample=sampleLearnScenarioRun(scenario,'blank-start')
 const project=createLearnScenarioProject(blankProject(),scenario,sample,'blank')
 assert.equal(project.devices.length,1)
 assert.equal(project.devices[0].kind,'load')
 assert.equal(project.devices[0].spec.watts,sample.loadWatts)
 assert.equal(project.wires.length,0)
 assert.deepEqual(project.learn.sample,sample)
 const evaluation=evaluateLearnScenario(project,null,scenario)
 assert.equal(evaluation.allPassed,false)
 assert.equal(evaluation.checklist.find(item=>item.id==='client-supply').passed,false)
})

test('provided learning systems cannot finish through ratings alone while the client is unpowered', () => {
 const scenario=LEARN_SCENARIOS[0],project=createLearnScenarioProject(blankProject(),scenario)
 assert.equal(project.devices.length,5)
 assert.equal(evaluateLearnScenario(project,null,scenario).allPassed,false)
 const load=project.devices.find(d=>d.kind==='load')
 const frame={devices:{[load.id]:{power:load.spec.watts}}}
 assert.equal(evaluateLearnScenario(project,frame,scenario).checklist.find(item=>item.id==='client-supply').passed,true)
 project.devices=[]
 assert.equal(evaluateLearnScenario(project,frame,scenario).checklist.find(item=>item.id==='client-supply').passed,false)
})

test('zero live PV output stays zero and provided charge voltage matches its battery class', () => {
 const night=LEARN_SCENARIOS.find(s=>s.id==='microgrid-night'),project=createLearnScenarioProject(blankProject(),night)
 const pv=project.devices.find(d=>d.kind==='pv')
 const evaluation=evaluateLearnScenario(project,{devices:{[pv.id]:{power:0}}},night)
 assert.equal(evaluation.checklist.find(item=>item.id==='sunset-safety').passed,true)
 const charge=LEARN_SCENARIOS.find(s=>s.id==='battery-charge-window')
 const provided=createLearnScenarioProject(blankProject(),charge,sampleLearnScenarioRun(charge,'charge-class'))
 const battery=provided.devices.find(d=>d.kind==='battery'),controller=provided.devices.find(d=>d.kind==='mppt'),inverter=provided.devices.find(d=>d.kind==='inverter')
 assert.equal(battery.spec.voltage,12)
 assert.ok(controller.spec.chargeVoltage>battery.spec.voltage)
 assert.ok(inverter.spec.cutoff<battery.spec.voltage)
})

test('training preserves client demand and site conditions while supply equipment stays editable',()=>{
 const scenario=LEARN_SCENARIOS[0],sample=sampleLearnScenarioRun(scenario,'fixed-client'),p=createLearnTrainingProject(scenario,sample)
 assert.equal(p.devices.length,1)
 assert.equal(p.devices[0].spec.watts,sample.loadWatts)
 assert.equal(trainingDeparture(p,structuredClone(p)),null)
 for(const field of ['sun','ambient','initialSoc'])assert.ok(trainingDeparture(p,{...p,[field]:p[field]+1}))
 const changed=structuredClone(p);changed.devices[0].spec.watts++
 assert.ok(trainingDeparture(p,changed))
 assert.ok(trainingDeparture(p,{...p,devices:[]}))
 assert.ok(trainingDeparture(p,{...p,learn:undefined}))
 const pump=LEARN_SCENARIOS.find(s=>/pump/.test(s.id)),pumpProject=createLearnTrainingProject(pump,{loadWatts:385,sun:50})
 assert.equal(pumpProject.devices.find(d=>d.kind==='motor').spec.watts,385)
})

test('older saved training sessions recover their client load and sampled conditions',()=>{
 const scenario=LEARN_SCENARIOS[0],sample=sampleLearnScenarioRun(scenario,'legacy-training'),project=createLearnTrainingProject(scenario,sample)
 project.devices=[];project.sun=100;project.ambient=50
 const resumed=restoreLearnClient(project)
 assert.equal(resumed.devices.length,1)
 assert.equal(resumed.devices[0].spec.watts,sample.loadWatts)
 assert.equal(resumed.sun,sample.sun)
 assert.equal(resumed.ambient,sample.ambient)
 assert.equal(resumed.learn.runId,project.learn.runId)
 const modified=structuredClone(resumed);modified.devices[0].spec.watts=1
 assert.equal(restoreLearnClient(modified).devices[0].spec.watts,sample.loadWatts)
 assert.equal(project.devices.length,0)
})

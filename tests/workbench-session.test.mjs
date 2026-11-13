import test from 'node:test'
import assert from 'node:assert/strict'
import { SimulationSession } from '../src/workbench/session.ts'
import { circuitProject } from '../src/workbench/templates.ts'
import { emptyState } from '../src/workbench/model.ts'

test('electrical edits retain runtime state but changing project resets all stored energy and protection',()=>{
  const session=new SimulationSession(),project=circuitProject()
  session.prepare(project)
  session.state.time=12;session.state.capacitors[project.devices.at(-1).id]=8
  session.state.trips=[project.devices[0].id]
  project.devices[0].x+=50;project.devices[0].spec.resistance=.2
  assert.equal(session.prepare(project).time,12)
  const other=structuredClone(project);other.id='another-project'
  assert.deepEqual(session.prepare(other),emptyState())
})

test('changing initial charge including undo starts from the requested initial conditions',()=>{
  const session=new SimulationSession(),project=circuitProject()
  session.prepare(project);session.state.soc[project.devices[0].id]=23
  const initial=project.initialSoc;project.initialSoc=40
  assert.deepEqual(session.prepare(project),emptyState())
  session.state.time=1;project.initialSoc=initial
  assert.deepEqual(session.prepare(project),emptyState())
})

test('clearing a project discards runtime state even if undo restores the same component IDs',()=>{
  const session=new SimulationSession(),project=circuitProject()
  session.prepare(project);session.state.time=10;session.state.inductors.test=2
  session.prepare({...project,devices:[],wires:[]})
  assert.deepEqual(session.prepare(project),emptyState())
  session.state.time=5;session.reset()
  assert.deepEqual(session.prepare(project),emptyState())
})

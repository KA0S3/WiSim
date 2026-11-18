import {defaultBuilding} from '../src/workbench/building-plan.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { designSystem, defaultRequirements } from '../src/workbench/templates.ts'
import { wireResistance, validateProject } from '../src/workbench/model.ts'
import { arrayOptions, selectArray } from '../src/workbench/design-options.ts'
import { designPhases } from '../src/workbench/design-phases.ts'
import { activeAt, scheduleDemand, withSchedules } from '../src/workbench/appliances.ts'
import { pvNetwork } from '../src/workbench/pv-network.ts'
import { connectionFindings } from '../src/workbench/connection-checks.ts'

test('high-power low-energy designs meet battery current and energy constraints', () => {
  const p = designSystem({ ...defaultRequirements, dailyKwh: 1, peakW: 8000, autonomyHours: 1 })
  const batteries = p.devices.filter(d => d.kind === 'battery'), inverter = p.devices.find(d => d.kind === 'inverter')
  assert.equal(inverter.spec.watts, 12000)
  assert.ok(batteries.reduce((sum, b) => sum + b.spec.rating, 0) >= (inverter.spec.watts / inverter.spec.efficiency + 8) / inverter.spec.cutoff)
  assert.equal(batteries.length, 3); assert.ok(validateProject(p))
})

test('generated independent controller paths meet voltage-drop budgets and sourced input limits', () => {
  for (const dailyKwh of [8, 40]) for (const region of ['ZA', 'GB', 'US']) {
    const r = { ...defaultRequirements, region, dailyKwh }, p = designSystem(r), option = selectArray(r)
    const resistance = wires => wires.reduce((sum, w) => sum + wireResistance(w, p.ambient), 0)
    const controllers = p.devices.filter(d => d.kind === 'mppt')
    assert.equal(controllers.length, option.controllers); assert.ok(!connectionFindings(p).length)
    for (const controller of controllers) {
      const array = pvNetwork(p, controller.id, r.hotTemperature ?? 70)
      assert.ok(array.known); assert.ok(array.shortCircuitCurrent * 1.25 <= controller.spec.pvMaxShortCircuitCurrent)
      assert.ok(array.power <= controller.spec.pvMaxPower)
      const input = p.wires.filter(w => w.to === controller.id && w.toPort.startsWith('pv'))
      assert.ok(array.shortCircuitCurrent * resistance(input) <= option.hotVmp * .015)
      const protection = p.wires.find(w => w.from === controller.id && w.fromPort === 'bat+').to
      const output = p.wires.filter(w => w.from === controller.id || w.from === protection)
      assert.ok(controller.spec.rating * resistance(output) <= 44 * .015)
    }
    const batteries = p.devices.filter(d => d.kind === 'battery')
    assert.ok(batteries.length * 100 >= controllers.reduce((sum, d) => sum + d.spec.rating, 0))
  }
})

test('designer rejects invalid inputs, infeasible area and unavailable conductor sizes', () => {
  for (const patch of [{ reserve: -1 }, { reserve: 101 }, { sunHours: 25 }, { dailyKwh: 100, peakW: 100 }, { region: 'invalid' }, { maxPanelArea: 1 }, { coldTemperature: 100 }]) assert.throws(() => designSystem({ ...defaultRequirements, ...patch }))
  assert.throws(() => designSystem({ ...defaultRequirements, cableLength: 10000 }), /no available conductor/)
})

test('alternative selection changes actual modules, string length and independent MPPT assignments', () => {
  const options = arrayOptions(defaultRequirements)
  assert.ok(new Set(options.map(option => option.panel.id)).size >= 3)
  assert.ok(new Set(options.map(option => option.series)).size >= 3)
  const option = options.find(option => option.panel.power === 215 && option.series > 2)
  const p = designSystem({ ...defaultRequirements, arrayOptionId: option.id })
  assert.equal(p.devices.filter(d => d.kind === 'pv').length, option.modules)
  assert.ok(p.devices.filter(d => d.kind === 'pv').every(d => d.model === option.panel.id && d.spec.watts === 215))
  assert.equal(p.groups.filter(group => group.kind === 'pv-array').length, option.controllers)
  const assigned = p.devices.filter(d => d.kind === 'mppt').flatMap(d => pvNetwork(p, d.id).sources)
  assert.equal(assigned.length, new Set(assigned).size); assert.equal(assigned.length, option.modules)
})

const appliance = patch => ({ id: 'appliance', name: 'Appliance', watts: 1000, quantity: 1, startHour: 8, endHour: 10, startupMultiplier: 1, startupSeconds: 0, phase: 'auto', ...patch })

test('daily schedule handles overnight periods, overlap and simultaneous startup', () => {
  const items = [appliance({ id: 'night', startHour: 22, endHour: 2 }), appliance({ id: 'pump', startHour: 0, endHour: 1, startupMultiplier: 4, startupSeconds: 1 })]
  assert.deepEqual(scheduleDemand(items), { dailyKwh: 5, peakW: 2000, startupW: 5000, peakHour: 0 })
  assert.ok(activeAt(22, 2, 23)); assert.ok(activeAt(22, 2, 0)); assert.ok(!activeAt(22, 2, 2))
  assert.equal(scheduleDemand([appliance({ startHour: 8, endHour: 8 })]).dailyKwh, 24)
})

test('scheduled loads retain manual on/off while selected time controls their effective state', () => {
  const p = designSystem({ ...defaultRequirements, appliances: [appliance({ id: 'day', name: 'Day load' }), appliance({ id: 'night', name: 'Night load', startHour: 20, endHour: 22 })] })
  assert.equal(p.requirements.dailyKwh, 4); assert.equal(p.requirements.peakW, 1000)
  const night = p.devices.find(d => d.name === 'Night load')
  p.scheduleHour = 8; assert.equal(withSchedules(p).devices.find(d => d.id === night.id).on, false)
  p.scheduleHour = 20; assert.equal(withSchedules(p).devices.find(d => d.id === night.id).on, true)
  night.on = false; assert.equal(withSchedules(p).devices.find(d => d.id === night.id).on, false)
  assert.ok(validateProject(JSON.parse(JSON.stringify(p))))
  const broken = structuredClone(p); broken.devices.find(d => d.schedule).schedule.startHour = 25
  assert.equal(validateProject(broken), false)
})

test('phase design sizes startup, balances automatic loads and honours explicit assignments', () => {
  const appliances = [appliance({ id: 'pump', watts: 1000, startupMultiplier: 8, startupSeconds: 1, phase: 'A' }), appliance({ id: 'kettle', watts: 1000 }), appliance({ id: 'heater', watts: 1000 })]
  const phases = designPhases({ ...defaultRequirements, phases: 'three', appliances })
  assert.deepEqual(phases.map(phase => phase.angle), [0, 120, 240]); assert.equal(phases[0].inverterW, 5000)
  assert.ok(phases.every(phase => phase.appliances.length === 1))
  assert.throws(() => designPhases({ ...defaultRequirements, appliances: [appliance({ phase: 'C' })] }), /unavailable/)
})

test('split and three-phase designs have separate phase output/protection and shared neutral', () => {
  for (const [phases, region, angles] of [['split', 'US', [0, 180]], ['three', 'ZA', [0, 120, 240]]]) {
    const p = designSystem({ ...defaultRequirements, phases, region })
    assert.deepEqual(p.devices.filter(d => d.kind === 'inverter').map(d => d.spec.phaseDegrees), angles)
    assert.equal(p.devices.filter(d => d.kind === 'load').length, angles.length)
    assert.ok(p.devices.some(d => d.name === 'AC shared neutral')); assert.equal(connectionFindings(p).length, 0)
    assert.ok(validateProject(p))
  }
})

test('automatic cable lengths use measured routes without arbitrary minimum slack',()=>{
 const p=designSystem({...defaultRequirements,cableLength:undefined})
 assert.ok(p.wires.every(w=>w.lengthMode==='physical'&&Number.isFinite(w.length)&&w.length>0))
 assert.ok(p.wires.filter(w=>w.toPort==='dc+').every(w=>(w.slack??0)===0))
 assert.ok(validateProject(JSON.parse(JSON.stringify(p))))
})

test('explicit panel and string counts choose compatible MPPTs or reject impossible layouts',()=>{
 const option=arrayOptions(defaultRequirements)[0]
 const r={...defaultRequirements,panelId:option.panel.id,panelCount:option.modules,stringCount:option.strings}
 const chosen=selectArray(r),p=designSystem(r)
 assert.equal(chosen.modules,option.modules);assert.equal(chosen.strings,option.strings)
 assert.equal(p.devices.filter(d=>d.kind==='mppt').length,chosen.controllers)
 assert.throws(()=>selectArray({...r,panelCount:1,stringCount:3}),/No sourced/)
 assert.throws(()=>arrayOptions({...r,panelCount:2.5}),/whole numbers/)
})

test('long motor starts fit continuous inverter power and startup protection',()=>{
 const r={...defaultRequirements,appliances:[appliance({watts:1500,startupMultiplier:4,startupSeconds:5})]}
 const phase=designPhases(r)[0],p=designSystem(r)
 assert.ok(phase.inverterW>=phase.startupW*1.2)
 assert.ok(p.devices.find(d=>d.name.includes('AC output protection')).spec.rating>=phase.startupW/230)
})

test('building refit balances parallel battery loop resistance after physical routing',()=>{
 const p=designSystem({...defaultRequirements,autonomyHours:24,building:defaultBuilding()})
 const loops=p.devices.filter(d=>d.kind==='battery').map(b=>{
  const positive=p.wires.find(w=>w.from===b.id&&w.fromPort==='p'),negative=p.wires.find(w=>w.from===b.id&&w.fromPort==='n')
  const onward=p.wires.find(w=>w.from===positive.to)
  return [positive,negative,onward].reduce((sum,w)=>sum+wireResistance(w,p.ambient),0)
 })
 assert.ok(loops.length>1);assert.ok(Math.max(...loops)-Math.min(...loops)<1e-10)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { designSystem, defaultRequirements } from '../src/workbench/templates.ts'
import { wireResistance, validateProject } from '../src/workbench/model.ts'

test('high-power low-energy designs provide enough battery current, not just autonomy',()=>{
  const p=designSystem({...defaultRequirements,dailyKwh:1,peakW:8000,autonomyHours:1})
  const batteries=p.devices.filter(d=>d.kind==='battery'),inverter=p.devices.find(d=>d.kind==='inverter'),mppt=p.devices.find(d=>d.kind==='mppt')
  assert.equal(inverter.spec.watts,12000)
  assert.ok(batteries.reduce((sum,b)=>sum+b.spec.rating,0) >= (inverter.spec.watts/inverter.spec.efficiency+8)/inverter.spec.cutoff)
  assert.ok(batteries.reduce((sum,b)=>sum+b.spec.rating,0) >= mppt.spec.rating)
  assert.equal(batteries.length,3)
  assert.ok(batteries.every(b=>b.spec.capacityAh===100))
  assert.ok(validateProject(p))
})

test('all generated power paths meet their stated drop budgets including contacts and temperature',()=>{
  for(const region of ['ZA','GB','US'])for(const peakW of [600,2400,8000]){
    const p=designSystem({...defaultRequirements,region,peakW,dailyKwh:8})
    const get=kind=>p.devices.find(d=>d.kind===kind),panels=p.devices.filter(d=>d.kind==='pv'),batteries=p.devices.filter(d=>d.kind==='battery'),mppt=get('mppt'),inverter=get('inverter'),fuse=p.devices.find(d=>d.name==='Main battery protection'),current=(inverter.spec.watts/.94+8)/44
    const paths=[
      [p.wires.filter(w=>w.from===fuse.id||w.to===fuse.id||w.to===inverter.id),current,44*.015],
      [p.wires.filter(w=>w.from===inverter.id),inverter.spec.watts/inverter.spec.voltage,inverter.spec.voltage*.01],
      [p.wires.filter(w=>w.to===mppt.id&&w.toPort.startsWith('pv')),panels.length/2*10.7,80*.015],
      [p.wires.filter(w=>w.from===mppt.id),mppt.spec.rating,44*.015],
    ]
    for(const [wires,current,budget]of paths){
      assert.ok(wires.length>=2)
      assert.ok(current*wires.reduce((sum,w)=>sum+wireResistance(w,p.ambient),0)<=budget,`${region} ${peakW} W path exceeded budget`)
    }
    for(const battery of batteries){const branchFuse=p.wires.find(w=>w.from===battery.id&&w.fromPort==='p').to,path=p.wires.filter(w=>w.from===battery.id||w.to===battery.id||w.from===branchFuse);assert.ok(Math.max(current,mppt.spec.rating)/batteries.length*path.reduce((sum,w)=>sum+wireResistance(w,p.ambient),0)<=44*.005)}
    for(const panel of panels.filter(d=>d.name.endsWith('panel 1'))){const f=p.wires.find(w=>w.from===panel.id&&w.fromPort==='p').to,second=p.wires.find(w=>w.from===panel.id&&w.fromPort==='n').to,path=p.wires.filter(w=>w.from===panel.id||w.from===f||w.from===second);assert.ok(10.7*path.reduce((sum,w)=>sum+wireResistance(w,p.ambient),0)<=80*.005)}
    assert.ok(mppt.spec.rating>=panels.reduce((sum,pv)=>sum+pv.spec.watts,0)*mppt.spec.efficiency/44)
  }
})

test('designer rejects impossible inputs and cable sizes instead of silently falling back',()=>{
  for(const patch of [{reserve:-1},{reserve:101},{sunHours:25},{dailyKwh:100,peakW:100},{region:'invalid'}])assert.throws(()=>designSystem({...defaultRequirements,...patch}))
  assert.throws(()=>designSystem({...defaultRequirements,cableLength:10000}),/no available conductor/)
})

test('increasing solar capacity sizes controller wiring and battery charge current as well',()=>{
  const p=designSystem({...defaultRequirements,dailyKwh:40,peakW:2400})
  const controller=p.devices.find(d=>d.kind==='mppt'),batteries=p.devices.filter(d=>d.kind==='battery')
  assert.ok(controller.spec.rating>100)
  assert.ok(batteries.reduce((sum,b)=>sum+b.spec.rating,0)>=controller.spec.rating)
  assert.ok(p.wires.filter(w=>w.from===controller.id).every(w=>w.area>16))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {Simulation} from 'eecircuit-engine'
import {blankProject,makeDevice,connect,emptyState} from '../src/workbench/model.ts'
import {compileCircuit,prepareState,interpret} from '../src/workbench/engine.ts'

function seriesSolarProject(){
 const project=blankProject(),first=makeDevice('pv',100,100),second=makeDevice('pv',100,350),controller=makeDevice('mppt',400,350),battery=makeDevice('battery',700,350),inverter=makeDevice('inverter',700,100),pump=makeDevice('load',1000,200,'pump')
 first.id='pv-f8f06651';second.id='pv-series-second';pump.id='load-17513376'
 project.devices=[first,second,controller,battery,inverter,pump]
 project.wires=[connect(first,'n',second,'p'),connect(first,'p',controller,'pv+'),connect(second,'n',controller,'pv-'),connect(controller,'bat+',battery,'p'),connect(controller,'bat-',battery,'n'),connect(battery,'p',inverter,'dc+'),connect(battery,'n',inverter,'dc-'),connect(inverter,'l',pump,'p'),connect(inverter,'n',pump,'n')]
 return {project,first,second,controller,battery,inverter,pump}
}

const engine=new Simulation()
async function solve(project,state=emptyState()){
 await engine.start();state=prepareState(project,state)
 const compiled=compileCircuit(project,state)
 engine.setNetList(compiled.netlist)
 const raw=await engine.runSim()
 return interpret(project,raw,state,1,0,compiled.findings)
}

const close=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,actual+' compared with '+expected)

test('two generic series panels supply the pump and keep solving through sunlight and wiring edits',async()=>{
 const {project,second,controller,battery,pump}=seriesSolarProject()
 let result=await solve(project)
 for(let i=0;i<8;i++){
  assert.ok(result.frame.devices[pump.id].power>590)
  assert.ok(result.frame.devices[controller.id].inputPower>1800)
  close(result.frame.devices[controller.id].power,result.frame.devices[controller.id].inputPower*controller.spec.efficiency,.001)
  assert.ok(result.frame.devices[battery.id].power<0)
  result=await solve(project,result.state)
 }
 project.sun=0;result=await solve(project,result.state)
 assert.ok(result.frame.devices[pump.id].power>590)
 assert.ok(result.frame.devices[battery.id].power>0)
 assert.ok(Math.abs(result.frame.devices[controller.id].inputPower)<.001)
 project.sun=85
 const returnWire=project.wires.find(w=>w.from===second.id&&w.to===controller.id)
 project.wires=project.wires.filter(w=>w!==returnWire)
 result=await solve(project,result.state)
 assert.ok(Math.abs(result.frame.devices[controller.id].inputPower)<.001)
 assert.ok(result.frame.devices[pump.id].power>590)
 project.wires.push(returnWire)
 result=await solve(project,result.state)
 assert.ok(result.frame.devices[controller.id].inputPower>1800)
 assert.ok(result.frame.time>1)
})

test('restored terminal offsets do not alter physical voltage, power or retained energy',async()=>{
 const {project,pump}=seriesSolarProject(),initial=await solve(project),shifted=structuredClone(initial.state)
 for(const key of Object.keys(shifted.nodes))shifted.nodes[key]+=500
 const resumed=await solve(project,shifted)
 close(resumed.frame.devices[pump.id].power,initial.frame.devices[pump.id].power,.01)
 close(resumed.frame.devices[pump.id].voltage,initial.frame.devices[pump.id].voltage,.01)
 assert.ok(resumed.state.time>initial.state.time)
})

test('series additions settle from the retained state while disconnected islands draw no phantom power',async()=>{
 const {project,first,second,controller,pump}=seriesSolarProject()
 const initial=await solve(project),extra=makeDevice('pv',100,600)
 project.devices.push(extra)
 project.wires=project.wires.filter(w=>!(w.from===first.id&&w.to===second.id))
 project.wires.push(connect(first,'n',extra,'p'),connect(extra,'n',second,'p'))
 let result=await solve(project,initial.state)
 assert.ok(result.frame.devices[pump.id].power>590)
 assert.ok(result.frame.devices[controller.id].inputPower>1800)
 controller.on=false
 result=await solve(project,result.state)
 assert.ok(Math.abs(result.frame.devices[controller.id].inputPower)<.001)
 for(const panel of [first,second,extra])close(result.frame.devices[panel.id].voltage,panel.spec.voc,.001)
})

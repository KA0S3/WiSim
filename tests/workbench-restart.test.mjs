import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulation } from 'eecircuit-engine'
import { compileCircuit, interpret, prepareState } from '../src/workbench/engine.ts'
import { emptyState, wireResistance } from '../src/workbench/model.ts'
import { circuitProject } from '../src/workbench/templates.ts'

const engine=new Simulation()
async function solve(p,state=emptyState(),seconds=.1) { await engine.start();state=prepareState(p,state);const compiled=compileCircuit(p,state,seconds);engine.setNetList(compiled.netlist);const raw=await engine.runSim();return interpret(p,raw,state,1,0,compiled.findings,seconds) }
const near=(actual,expected,tolerance,label='value')=>assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: expected ${expected} ± ${tolerance}, got ${actual}`)

test('a fresh ngspice instance restores capacitor energy and continues the original simulation clock',async()=>{
 const p=circuitProject(),first=await solve(p),cold=new Simulation(),state=prepareState(p,structuredClone(first.state)),seconds=.02
 await cold.start();const compiled=compileCircuit(p,state,seconds);cold.setNetList(compiled.netlist);const raw=await cold.runSim(),result=interpret(p,raw,state,2,0,compiled.findings,seconds)
 const capacitor=p.devices.find(d=>d.kind==='capacitor'),battery=p.devices.find(d=>d.kind==='battery'),resistance=p.devices.filter(d=>['resistor','switch','battery'].includes(d.kind)).reduce((sum,d)=>sum+d.spec.resistance,0)+p.wires.reduce((sum,w)=>sum+wireResistance(w,p.ambient),0)
 const expected=battery.spec.voltage*(1-Math.exp(-.12/(resistance*capacitor.spec.capacitance)))
 near(result.state.time,.12,1e-8);near(result.state.capacitors[capacitor.id],expected,.03)
})

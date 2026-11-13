import test from 'node:test'
import assert from 'node:assert/strict'
import {Simulation} from 'eecircuit-engine'

test('an actual ngspice failure rejects rather than hanging, then the same engine solves a valid circuit',async()=>{
 const engine=new Simulation();await engine.start()
 const valid='Reference resistor\nV1 1 0 12\nR1 1 0 10\n.tran .001 .1\n.end'
 engine.setNetList(valid);await engine.runSim()
 engine.setNetList('Inconsistent ideal sources\nV1 1 0 1\nV2 1 0 2\n.tran .001 .1\n.end')
 let timer
 try{
  await assert.rejects(Promise.race([engine.runSim(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Solver promise is still hanging')),4000)})]),/solver produced no readable output/i)
 }finally{clearTimeout(timer)}
 engine.setNetList(valid)
 const result=await engine.runSim()
 assert.ok(result.numPoints>2)
 const volts=result.data.find(d=>d.name.toLowerCase()==='v(1)').values
 assert.ok(Math.abs(volts.at(-1)-12)<1e-8)
})

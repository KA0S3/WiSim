import test from 'node:test'
import assert from 'node:assert/strict'
import {transferableFrame} from '../src/workbench/frame-transfer.ts'
import {measureBetween} from '../src/workbench/measurements.ts'
test('transferred waveform buffers preserve meter values and do not detach the solver state or original arrays',()=>{
 const times=[0,.01,.02],a=[3,3,3],b=[1,1,1],frame={revision:1,time:.02,durationMs:5,devices:{},wires:{},terminals:{},findings:[],engine:'test',times,waveforms:{a,b,alias:a}}
 const packed=transferableFrame(frame),received=structuredClone(packed.frame,{transfer:packed.transfer})
 assert.equal(packed.frame.times.byteLength,0);assert.deepEqual(times,[0,.01,.02]);assert.deepEqual(a,[3,3,3]);assert.ok(received.times instanceof Float64Array);assert.equal(received.waveforms.a,received.waveforms.alias)
 assert.equal(measureBetween(received.waveforms.a,received.waveforms.b,received.times,{ac:false,frequency:null},{ac:false,frequency:null}).value,2)
})

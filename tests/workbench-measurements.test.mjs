import test from 'node:test'
import assert from 'node:assert/strict'
import {timeAverage,networkMeasurements,measurementKey,measureBetween} from '../src/workbench/measurements.ts'
import {blankProject,makeDevice,connect,emptyState} from '../src/workbench/model.ts'

test('partial-window integration interpolates the first sample and integrates linear RMS exactly',()=>{
 assert.equal(timeAverage([0,10],[0,10],5),7.5)
 assert.ok(Math.abs(timeAverage([0,10],[0,10],5,true)-Math.sqrt(175/3))<1e-10)
 assert.equal(timeAverage([1],[0],0),0)
})
test('60 Hz RMS is independent of phase and a 50 Hz component default',()=>{
 const times=Array.from({length:1001},(_,i)=>i*.0001)
 for(const phase of [0,.3,1,2]){
  const wave=times.map(t=>120*Math.SQRT2*Math.sin(2*Math.PI*60*t+phase))
  const meter=measureBetween(wave,times.map(()=>0),times,{ac:true,frequency:60},{ac:true,frequency:60})
  assert.ok(Math.abs(meter.value-120)<.03)
 }
})
test('AC classification stops at converter boundaries while power observation periods cross them',()=>{
 const p=blankProject(),g=makeDevice('grid',0,0),r=makeDevice('resistor',0,0),charger=makeDevice('charger',0,0),battery=makeDevice('battery',0,0)
 g.spec.frequency=60;p.devices=[g,r,charger,battery]
 p.wires=[connect(g,'p',r,'p'),connect(r,'n',g,'n'),connect(g,'p',charger,'l'),connect(g,'n',charger,'n'),connect(charger,'bat+',battery,'p'),connect(charger,'bat-',battery,'n')]
 let metadata=networkMeasurements(p,emptyState())
 assert.deepEqual(metadata[measurementKey(r.id,'p')],{ac:true,frequency:60,observationFrequency:60})
 assert.deepEqual(metadata[measurementKey(charger.id,'l')],{ac:true,frequency:60,observationFrequency:60})
 assert.deepEqual(metadata[measurementKey(battery.id,'p')],{ac:false,frequency:null,observationFrequency:60})
 const other=makeDevice('grid',0,0);other.spec.frequency=50;p.devices.push(other);p.wires.push(connect(other,'p',g,'p'))
 metadata=networkMeasurements(p,emptyState());assert.deepEqual(metadata[measurementKey(r.id,'p')],{ac:true,frequency:null,observationFrequency:null})
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {blankProject,makeDevice,connect,wireResistance} from '../src/workbench/model.ts'
import {routeLength,terminalPosition,synchronizeLengths,moveEquipment,setWireRoute,insertWireBend} from '../src/workbench/geometry.ts'
test('3D distances include height and bends',()=>{
 assert.equal(routeLength([[0,0,0],[0,3,0],[4,3,0]]),7)
 assert.equal(routeLength([[0,0,0],[0,3,4]]),5)
})

test('adding a route bend preserves length until moved and changes the electrical resistance on movement',()=>{
 const p=blankProject(),a=makeDevice('battery',0,0),b=makeDevice('resistor',400,0)
 p.devices=[a,b];const w=connect(a,'p',b,'p');p.wires=[w]
 const direct=setWireRoute(p,w.id,[]),bend=insertWireBend(direct,w.id),inserted=setWireRoute(direct,w.id,bend)
 assert.ok(Math.abs(inserted.wires[0].length-direct.wires[0].length)<1e-10)
 bend[0][1]+=3
 const moved=setWireRoute(inserted,w.id,bend)
 assert.ok(moved.wires[0].length>inserted.wires[0].length+4)
 assert.ok(wireResistance(moved.wires[0],25)>wireResistance(inserted.wires[0],25))
 assert.equal(w.lengthMode,undefined)
 assert.throws(()=>setWireRoute(p,w.id,[[NaN,0,0]]))
})
test('physical movement updates conductor resistance without moving schematic equipment',()=>{
 const p=blankProject(),a=makeDevice('battery',0,0),b=makeDevice('resistor',300,0)
 a.physical=[0,0,0];b.physical=[1,0,0];p.devices=[a,b]
 const w=connect(a,'p',b,'p');w.lengthMode='physical';w.slack=.2;p.wires=[w]
 const first=synchronizeLengths(p),next=moveEquipment(first,b.id,[1,3,0])
 assert.ok(next.wires[0].length>first.wires[0].length)
 assert.ok(wireResistance(next.wires[0],25)>wireResistance(first.wires[0],25))
 assert.equal(next.devices[1].x,300)
 assert.equal(terminalPosition(next.devices[1],'p')[1]-terminalPosition(b,'p')[1],3)
})
test('manual cable lengths stay explicit during physical placement',()=>{
 const p=blankProject(),a=makeDevice('battery',0,0),b=makeDevice('resistor',300,0);p.devices=[a,b];p.wires=[connect(a,'p',b,'p',16,12)]
 assert.equal(moveEquipment(p,b.id,[8,9,10]).wires[0].length,12)
})

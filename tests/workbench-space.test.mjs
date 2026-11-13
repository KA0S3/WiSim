import test from 'node:test'
import assert from 'node:assert/strict'
import {blankProject,makeDevice,connect,validateProject} from '../src/workbench/model.ts'
import {makeStructure,mountDevice,updateStructure,removeStructure,deviceCenter,rotateDevice} from '../src/workbench/spatial.ts'
import {terminalPosition,moveEquipment,synchronizeLengths} from '../src/workbench/geometry.ts'

const near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`${a} != ${b}`))
function fixture(kind='wall'){
 const p=blankProject(),s=makeStructure(kind),a=makeDevice('pv',0,0),b=makeDevice('battery',400,0)
 p.structures=[s];p.devices=[a,b];p.wires=[{...connect(a,'p',b,'p'),lengthMode:'physical'}]
 return {p,s,a,b}
}
test('wall mounting, parent movement and rotation carry terminals and recalculate cables',()=>{
 const {p,s,a}=fixture();let q=synchronizeLengths(mountDevice(p,a.id,s.id))
 const before=q.devices[0],terminal=terminalPosition(before,'p'),length=q.wires[0].length
 near(deviceCenter(before),[0,1.2,-2+s.size[2]/2+a.spec.depth/2+.01])
 q=synchronizeLengths(updateStructure(q,s.id,{position:[4,4,-2]}))
 near(terminalPosition(q.devices[0],'p'),terminal.map((v,i)=>v+[4,2.8,0][i]))
 assert.notEqual(q.wires[0].length,length)
 q=synchronizeLengths(updateStructure(q,s.id,{rotation:[0,Math.PI/2,0]}))
 near(q.devices[0].rotation,[0,Math.PI/2,0])
 assert.ok(validateProject(q))
})
test('roof attachment lies on the rotated mounting plane and mounted moves remain persistent',()=>{
 const {p,s,a}=fixture('roof');let q=synchronizeLengths(mountDevice(p,a.id,s.id))
 const original=deviceCenter(q.devices[0]);assert.ok(original[1]>s.position[1]);near(q.devices[0].rotation,[-Math.PI/2,0,0])
 const target=q.devices[0].physical.map((v,i)=>v+[1,2,3][i]);q=moveEquipment(q,a.id,target)
 near(q.devices[0].physical,target);near(synchronizeLengths(q).devices[0].physical,target)
 q=rotateDevice(q,a.id,[.2,.3,.4]);near(q.devices[0].rotation,[.2,.3,.4])
})
test('resizing a face keeps the rear of the equipment at the mounting face',()=>{
 const {p,s,a}=fixture();let q=mountDevice(p,a.id,s.id)
 q=updateStructure(q,s.id,{size:[5,3,.4]})
 near(deviceCenter(q.devices[0]),[0,s.position[1],s.position[2]+.2+a.spec.depth/2+.01])
})
test('enclosure inside mounting and surface removal preserve world placement',()=>{
 const {p,s,a}=fixture('box');let q=mountDevice(p,a.id,s.id,'inside')
 near(deviceCenter(q.devices[0]),[0,.7,-1.5-s.size[2]/2+.02+a.spec.depth/2+.01])
 const d=q.devices[0];q=removeStructure(q,s.id)
 assert.equal(q.structures.length,0);assert.equal(q.devices[0].mount,undefined)
 near(q.devices[0].physical,d.physical);near(q.devices[0].rotation,d.rotation);assert.ok(validateProject(q))
 s.size=[.1,.1,.01];p.structures=[s]
 const small=mountDevice(p,a.id,s.id,'inside')
 near(deviceCenter(small.devices[0]),[0,.7,-1.5-.005+.0025+a.spec.depth/2+.01])
})
test('rotating equipment transforms terminal coordinates around its body centre',()=>{
 const d=makeDevice('battery',0,0),c=deviceCenter(d),a=terminalPosition(d,'p')
 d.rotation=[0,0,Math.PI/2]
 near(terminalPosition(d,'p'),[c[0]-(a[1]-c[1]),c[1]+a[0]-c[0],a[2]])
})
test('imports preserve space and reject invalid dimensions, rotations, dangling mounts and identity collisions',()=>{
 const {p,s,a}=fixture();const q=mountDevice(p,a.id,s.id)
 assert.ok(validateProject(JSON.parse(JSON.stringify(q))))
 for(const mutate of [p=>p.structures[0].size[0]=0,p=>p.structures[0].rotation[0]=NaN,p=>p.devices[0].mount.structureId='missing',p=>p.structures[0].id=p.devices[1].id,p=>p.devices[0].mount.face='inside']){
  const invalid=structuredClone(q);mutate(invalid);assert.equal(validateProject(invalid),false)
 }
})

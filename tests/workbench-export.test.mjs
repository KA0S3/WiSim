import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultRequirements,designSystem,solarProject} from '../src/workbench/templates.ts'
import {exportData,drawingGroups,detailProject} from '../src/workbench/export-data.ts'
import {diagramRoutes} from '../src/workbench/drawing.ts'
import {synchronizeLengths,physicalWirePoints,routeLength} from '../src/workbench/geometry.ts'

test('generated equipment, cable and end schedules count actual units with both terminal endpoints',()=>{
 const p=designSystem(defaultRequirements),data=exportData(p)
 assert.equal(p.devices.filter(d=>d.kind==='pv').length,8)
 assert.equal(p.devices.filter(d=>d.kind==='battery').length,2)
 assert.equal(p.devices.filter(d=>d.kind==='fuse').length,7)
 assert.equal(data.connections.length,p.wires.length)
 assert.equal(data.terminations.length,p.wires.length*2)
 assert.equal(new Set(data.terminations.map(t=>t.reference)).size,p.wires.length*2)
 for(const wire of p.wires){
  const row=data.connections.find(c=>c.reference===wire.reference),a=p.devices.find(d=>d.id===wire.from),b=p.devices.find(d=>d.id===wire.to)
  assert.ok(row.from.startsWith(`${a.reference}.${wire.fromPort} `))
  assert.ok(row.to.startsWith(`${b.reference}.${wire.toPort} `))
  assert.equal(row.length,wire.length)
  assert.ok(Math.abs(row.length-routeLength(physicalWirePoints(p,wire))-(wire.slack??0))<1e-10)
 }
 assert.ok(data.terminations.every(t=>t.hardware.includes('Select connector/lug')))
 assert.ok(data.csv.includes('5.12 kWh'))
})

test('exports preserve device/wire/structure references after deletion and array reordering',()=>{
 let p=synchronizeLengths(solarProject());const removed=p.devices.find(d=>d.kind==='motor')
 p={...p,devices:p.devices.filter(d=>d.id!==removed.id).reverse(),wires:p.wires.filter(w=>w.from!==removed.id&&w.to!==removed.id).reverse()}
 const data=exportData(p)
 assert.equal(data.rows[1][0],p.devices[0].reference)
 assert.deepEqual(data.connections.map(c=>c.reference),p.wires.map(w=>w.reference))
 const wire=p.wires[0],source=p.devices.find(d=>d.id===wire.from)
 assert.ok(data.connections[0].from.startsWith(source.reference+'.'))
 assert.equal(data.terminations[0].reference,wire.reference+'.A')
})

test('detail sheets cover every device once and route internal wires clearly at a fixed readable size',()=>{
 for(const p of [designSystem(defaultRequirements),designSystem({...defaultRequirements,dailyKwh:40}),solarProject()]){
  const groups=drawingGroups(p),ids=groups.flatMap(g=>g.devices.map(d=>d.id))
  assert.equal(new Set(ids).size,p.devices.length);assert.equal(ids.length,p.devices.length)
  for(const g of groups){
   assert.ok(g.devices.length<=8)
   const local=detailProject(p,g)
   assert.ok(local.devices.every(d=>d.x>=0&&d.x+210<=1700&&d.y>=0&&d.y+180<=800))
   assert.ok(diagramRoutes(local).every(r=>!r.blocked),g.name)
  }
 }
})

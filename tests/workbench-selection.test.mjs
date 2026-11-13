import test from 'node:test'
import assert from 'node:assert/strict'
import {selectionProject,pasteSelection} from '../src/workbench/selection.ts'
import {solarProject} from '../src/workbench/templates.ts'
import {validateProject,makeDevice} from '../src/workbench/model.ts'
import {synchronizeLengths} from '../src/workbench/geometry.ts'
import {productOptions,matchingProducts} from '../src/workbench/product-matching.ts'
import {applyProductSelection} from '../src/workbench/catalog-bank.ts'
import {CATALOG_RECORDS} from '../src/catalog.ts'

test('selection extraction retains only selected equipment and internal wires with a separate new-system identity',()=>{
 const p=synchronizeLengths(solarProject()),selected=p.devices.filter(d=>['battery','fuse','inverter'].includes(d.kind)).map(d=>d.id),copy=selectionProject(p,selected,true)
 assert.ok(validateProject(copy));assert.notEqual(copy.id,p.id);assert.equal(copy.devices.length,3);assert.equal(copy.wires.length,3)
 assert.ok(copy.wires.every(w=>selected.includes(w.from)&&selected.includes(w.to)))
 assert.equal(p.devices.length,7);assert.equal(copy.requirements,undefined)
})
test('pasted equipment receives independent identities and references without changing current wiring',()=>{
 const p=synchronizeLengths(solarProject()),copy=selectionProject(p,p.devices.map(d=>d.id),true),result=pasteSelection(p,copy)
 assert.ok(validateProject(result.project));assert.equal(result.addedIds.length,p.devices.length)
 assert.equal(result.project.wires.length,p.wires.length*2)
 assert.deepEqual(result.project.wires.slice(0,p.wires.length),p.wires)
 assert.equal(new Set(result.project.devices.map(d=>d.reference)).size,p.devices.length*2)
 assert.ok(result.project.wires.slice(p.wires.length).every(w=>result.addedIds.includes(w.from)&&result.addedIds.includes(w.to)))
})
test('nearest alternatives remain available outside exact power, battery voltage and surge filters',()=>{
 for(const kind of ['pv','battery','inverter','mppt']){
  const d=makeDevice(kind,0,0);d.spec.watts=100000;d.spec.capacityAh=10000;d.spec.rating=100000
  const options=productOptions(d,CATALOG_RECORDS)
  assert.ok(options.length,kind);assert.ok(options.every(o=>o.differences.length>0&&o.record.status==='verified'))
  assert.equal(matchingProducts(d,CATALOG_RECORDS).length,0)
 }
})
test('parallel catalogue units preserve external wire identities and represent real independently connected units',()=>{
 const p=synchronizeLengths(solarProject()),battery=p.devices.find(d=>d.kind==='battery'),record=CATALOG_RECORDS.find(r=>r.id==='victron-lithium-smart-12-8-100'),next=applyProductSelection(p,battery.id,record,2)
 assert.ok(validateProject(next));assert.equal(next.devices.filter(d=>d.kind==='battery').length,2)
 assert.deepEqual(next.wires.slice(0,p.wires.length),p.wires)
 const extra=next.devices.find(d=>d.kind==='battery'&&d.id!==battery.id),branches=next.wires.slice(p.wires.length)
 assert.equal(branches.length,2);assert.ok(branches.every(w=>w.from===battery.id&&w.to===extra.id&&w.fromPort===w.toPort&&w.lengthMode==='physical'))
 assert.equal(extra.spec.capacityAh,100);assert.throws(()=>applyProductSelection(p,battery.id,record,17))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {CATALOG_RECORDS} from '../src/catalog.ts'
import {physicalProfiles,applyPhysicalProfile} from '../src/workbench/profiles.ts'
import {applyCatalogRecord} from '../src/workbench/catalog-device.ts'
import {blankProject,makeDevice,validateProject} from '../src/workbench/model.ts'
import {terminalPosition,localTerminalPosition} from '../src/workbench/geometry.ts'

const record=id=>CATALOG_RECORDS.find(r=>r.id===id)
test('catalogue and geometry-only dimension profiles survive project import',()=>{
 assert.equal(new Set(physicalProfiles.map(p=>p.id)).size,physicalProfiles.length)
 assert.ok(physicalProfiles.some(p=>p.id==='canadian-solar-cs6w-550ms-2278'))
 assert.ok(physicalProfiles.some(p=>p.id==='victron-smartsolar-250-100'))
 for(const profile of physicalProfiles){
  const r=record(profile.id),d=profile.geometryOnly?applyPhysicalProfile(makeDevice(profile.kind,0,0),profile.id):applyCatalogRecord(makeDevice(profile.kind,0,0),r),p=blankProject();p.devices=[d]
  assert.deepEqual([d.spec.width,d.spec.height,d.spec.depth],profile.dimensions)
  assert.equal(d.physicalProfile,profile.id);assert.ok(validateProject(JSON.parse(JSON.stringify(p))))
  assert.equal(new URL(profile.source).protocol,'https:');assert.ok(profile.geometryOnly || r.source?.startsWith('https://') || r.simulation?.source?.startsWith('https://'))
 }
})
test('catalogue mapping keeps PV operating voltage, battery voltage and inverter output/cutoff distinct',()=>{
 const pv=applyCatalogRecord(makeDevice('pv',0,0),record('victron-bluesolar-215w-24v'))
 assert.equal(pv.spec.voltage,40.1);assert.equal(pv.spec.voc,46.01);assert.equal(pv.spec.isc,5.65)
 const mppt=applyCatalogRecord(makeDevice('mppt',0,0),record('victron-smartsolar-75-15'))
 assert.equal(mppt.spec.voltage,18);assert.ok(Math.abs(mppt.spec.chargeVoltage-14.4)<1e-8);assert.equal(mppt.spec.voc,75)
 const inverter=applyCatalogRecord(makeDevice('inverter',0,0),record('victron-phoenix-12-1200-230v'))
 assert.equal(inverter.spec.voltage,230);assert.equal(inverter.spec.cutoff,9.3);assert.equal(inverter.spec.rating,2200);assert.equal(inverter.spec.idleWatts,10)
})
test('profile terminals use the documented face and approximate anchors shared by rendering and cable measurement',()=>{
 const d=applyCatalogRecord(makeDevice('battery',0,0),record('victron-lithium-smart-12-8-200'))
 assert.equal(d.ports[0].side,'top');assert.equal(d.ports[1].side,'top')
 assert.equal(localTerminalPosition(d,'p')[1],d.spec.height/2)
 d.rotation=[0,0,Math.PI/2];assert.ok(terminalPosition(d,'p').every(Number.isFinite))
 assert.throws(()=>applyPhysicalProfile(d,'victron-smartsolar-75-15'))
 const p=blankProject();p.devices=[{...d,physicalProfile:'unknown'}];assert.equal(validateProject(p),false)
 p.devices=[{...d,ports:{}}];assert.equal(validateProject(p),false)
})

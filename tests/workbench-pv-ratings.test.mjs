import test from 'node:test'
import assert from 'node:assert/strict'
import {CATALOG_RECORDS} from '../src/catalog.ts'
import {makeDevice,blankProject,validateProject} from '../src/workbench/model.ts'
import {applyCatalogRecord} from '../src/workbench/catalog-device.ts'
import {pvVocAtTemperature,pvIscAtTemperature,pvDiodeScale} from '../src/workbench/pv-ratings.ts'
const panel=()=>applyCatalogRecord(makeDevice('pv',0,0),CATALOG_RECORDS.find(r=>r.id==='canadian-solar-cs6w-550ms-2278'))
test('sourced module temperature coefficients and MPP point retain their electrical meaning',()=>{
 const d=panel(),s=d.spec
 assert.equal(s.watts,550);assert.equal(s.voltage,41.7);assert.equal(s.mppCurrent,13.2);assert.equal(s.voc,49.6);assert.equal(s.isc,14)
 assert.ok(Math.abs(pvVocAtTemperature(s,-10)-54.1136)<1e-8);assert.ok(Math.abs(pvVocAtTemperature(s,70)-43.7968)<1e-8);assert.ok(Math.abs(pvIscAtTemperature(s,70)-14.315)<1e-8)
 const a=pvDiodeScale(s,25),amps=s.isc*(1-Math.exp((s.voltage-s.voc)/a))
 assert.ok(Math.abs(amps-s.mppCurrent)<1e-10)
 assert.deepEqual([s.width,s.height,s.depth],[1.134,2.278,.03]);assert.ok(d.ports.every(p=>p.anchor[2]<0))
})
test('legacy generic PV curves remain unchanged and optional source parameters validate on import',()=>{
 const d=makeDevice('pv',0,0),p=blankProject();p.devices=[d]
 assert.equal(pvVocAtTemperature(d.spec,25),d.spec.voc);assert.equal(pvDiodeScale(d.spec,25),d.spec.voc*.065);assert.equal(pvIscAtTemperature(d.spec,70),d.spec.isc)
 p.devices=[panel()];assert.ok(validateProject(JSON.parse(JSON.stringify(p))))
 for(const patch of [{mppCurrent:NaN},{vocTemperatureCoefficientPerC:2},{pvMaxPower:-1}]){const q=structuredClone(p);Object.assign(q.devices[0].spec,patch);assert.equal(validateProject(q),false)}
})

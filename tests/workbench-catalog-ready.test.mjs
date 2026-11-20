import {stringSizing} from '../src/workbench/design-options.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import {CATALOG_RECORDS} from '../src/catalog.ts'
import {simulationReadiness,simulationReady,catalogKind} from '../src/workbench/catalog-readiness.ts'
import {applyCatalogRecord} from '../src/workbench/catalog-device.ts'
import {applyBankProduct,bankProductPlan} from '../src/workbench/catalog-bank.ts'
import {sourceArrangement} from '../src/workbench/bank-arrangement.ts'
import {designSystem,defaultRequirements} from '../src/workbench/templates.ts'
import {blankProject,makeDevice,connect,validateProject} from '../src/workbench/model.ts'
import {connectionFindings} from '../src/workbench/connection-checks.ts'
const record=id=>CATALOG_RECORDS.find(r=>r.id===id)

test('readiness separates complete partial profiles from research status and validates every insertable model',()=>{
 const ready=CATALOG_RECORDS.filter(simulationReady)
 assert.equal(ready.length,64);assert.ok(ready.filter(r=>r.status==='partially verified').length>=40)
 for(const r of ready){const p=blankProject(),d=applyCatalogRecord(makeDevice(catalogKind(r),0,0),r);p.devices=[d];assert.ok(validateProject(JSON.parse(JSON.stringify(p))),r.id);assert.deepEqual([d.spec.width,d.spec.height,d.spec.depth],r.simulation.dimensions,r.id)}
 const partial=record('victron-blue-smart-ip22-12-15');assert.ok(simulationReady(partial));const d=applyCatalogRecord(makeDevice('charger',0,0),partial);assert.equal(d.spec.voltage,230);assert.equal(d.spec.rating,15);assert.ok(Math.abs(d.spec.chargeVoltage-14.4)<1e-9)
 const incomplete=structuredClone(partial);delete incomplete.simulation.chargeVoltage;assert.equal(simulationReady(incomplete),false);assert.throws(()=>applyCatalogRecord(makeDevice('charger',0,0),incomplete),/not simulation-ready/)
 assert.equal(simulationReadiness(record('renogy-rover-li-40a')).ready,false)
 const breaker=applyCatalogRecord(makeDevice('fuse',0,0),record('blue-sea-285-7184-60a'))
 assert.equal(breaker.spec.rating,60)
 assert.deepEqual([breaker.protection.domain,breaker.protection.voltage,breaker.protection.breakingA],['dc',48,3000])
})
test('sourced hardware revisions and restricted controller SKUs retain distinct limits',()=>{
 const legacy=applyCatalogRecord(makeDevice('inverter',0,0),record('victron-phoenix-12-1600')),current=applyCatalogRecord(makeDevice('inverter',0,0),record('victron-phoenix-24-1600'))
 assert.equal(legacy.spec.watts,1450);assert.equal(legacy.spec.rating,2200);assert.equal(current.spec.rating,2100)
 assert.deepEqual(record('victron-smartsolar-150-85').supportedBatteryVoltages,[12,24]);assert.equal(record('victron-smartsolar-250-60').maxPvShortCircuitCurrentA,60)
})
test('whole battery replacement converts generic packs to real series strings and preserves collectors and protection',()=>{
 const p=designSystem(defaultRequirements),first=p.devices.find(d=>d.kind==='battery'),product=record('victron-lithium-smart-12-8-100'),plan=bankProductPlan(p,first.id,product),bank=applyBankProduct(p,first.id,product)
 assert.equal(plan.newSeries,4);assert.equal(plan.units,8);assert.equal(plan.newEnergyWh,plan.energyWh)
 assert.ok(validateProject(bank));const arrangement=sourceArrangement(bank,first.id);assert.equal(arrangement.series,4);assert.equal(arrangement.parallel,2);assert.equal(arrangement.voltage,51.2)
 assert.equal(bank.devices.filter(d=>d.kind==='battery').length,8);assert.equal(bank.devices.filter(d=>d.kind==='fuse').length,p.devices.filter(d=>d.kind==='fuse').length)
 for(const w of p.wires)assert.ok(bank.wires.some(next=>next.id===w.id),w.id)
 for(const d of p.devices)assert.ok(bank.devices.some(next=>next.id===d.id),d.id)
 assert.equal(connectionFindings(bank).filter(f=>f.severity==='fault').length,0)
 assert.ok(bank.devices.filter(d=>d.kind==='battery').every(d=>d.batteryLimits.control==='external'&&!d.batteryLimits.externalConnected))
 const contracted=applyBankProduct(bank,first.id,record('victron-lithium-smart-25-6-100'))
 assert.ok(validateProject(contracted));assert.equal(sourceArrangement(contracted,first.id).series,2);assert.equal(sourceArrangement(contracted,first.id).voltage,51.2)
})
test('PV whole-array replacement preserves string voltage class, branch protection and usable groups',()=>{
 const p=designSystem(defaultRequirements),first=p.devices.find(d=>d.kind==='pv'),product=record('victron-bluesolar-215w-24v'),next=applyBankProduct(p,first.id,product)
 assert.ok(validateProject(next));const before=sourceArrangement(p,first.id),after=sourceArrangement(next,first.id);assert.equal(after.parallel,before.parallel);assert.ok(Math.abs(after.voltage/before.voltage-1)<.1)
 assert.equal(next.devices.filter(d=>d.kind==='fuse').length,p.devices.filter(d=>d.kind==='fuse').length)
})
test('bank replacement rejects tapped/unequal strings and sourced configuration overruns',()=>{
 const p=blankProject(),a=makeDevice('battery',0,0),b=makeDevice('battery',300,0),load=makeDevice('resistor',600,0);a.spec.voltage=b.spec.voltage=12.8;p.devices=[a,b,load];p.wires=[connect(a,'p',b,'n'),connect(a,'p',load,'p')]
 assert.throws(()=>applyBankProduct(p,a.id,record('victron-lithium-smart-12-8-100')),/midpoint/)
 a.spec.voltage=80;p.devices=[a];p.wires=[];assert.throws(()=>bankProductPlan(p,a.id,record('victron-lithium-smart-12-8-100')),/whole-unit|at most/)
})

test('BlueSolar 215 W and SmartSolar 250/60 match the manual string calculation',()=>{
 const {spec}=applyCatalogRecord(makeDevice('pv',0,0),record('victron-bluesolar-215w-24v'))
 const controller=record('victron-smartsolar-250-60')
 const four=stringSizing(spec,controller,4,-10,70)
 assert.equal(four.coldVoc.toFixed(2),'206.58')
 assert.equal(four.maxVoc,245)
 assert.equal(four.maxStrings,3)
 assert.ok(four.hotVmp>four.tracking)
 const five=stringSizing(spec,controller,5,-10,70)
 assert.equal(five.coldVoc.toFixed(2),'258.23')
 assert.ok(five.coldVoc>five.maxVoc)
})

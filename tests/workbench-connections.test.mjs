import test from 'node:test'
import assert from 'node:assert/strict'
import {blankProject,makeDevice,connect,validateProject} from '../src/workbench/model.ts'
import {connectionFindings,assertDesignConnections} from '../src/workbench/connection-checks.ts'
import {compileCircuit} from '../src/workbench/engine.ts'
import {matchingProducts,productOptions} from '../src/workbench/product-matching.ts'
import {applyCatalogRecord} from '../src/workbench/catalog-device.ts'
import {CATALOG_RECORDS} from '../src/catalog.ts'
import {warningLeader,clearLeader} from '../src/workbench/warning-route.ts'
import {designSystem,defaultRequirements} from '../src/workbench/templates.ts'
import {suggestedFix} from '../src/workbench/repairs.ts'

test('series battery voltage follows both conductors through a fuse without joining converter sides',()=>{
 const p=blankProject(),a=makeDevice('battery',0,0),b=makeDevice('battery',0,300),f=makeDevice('fuse',300,0),i=makeDevice('inverter',600,0)
 for(const d of [a,b])d.spec.voltage=12.8;i.spec.cutoff=20;p.devices=[a,b,f,i]
 p.wires=[connect(a,'p',f,'p'),connect(f,'n',i,'dc+'),connect(a,'n',b,'p'),connect(b,'n',i,'dc-')]
 assert.equal(connectionFindings(p).length,0)
 i.spec.cutoff=44;assert.ok(connectionFindings(p).some(f=>f.id==='bank-voltage-'+i.id))
 f.on=false;assert.ok(!connectionFindings(p).some(f=>f.id==='bank-voltage-'+i.id))
})
test('reversed and incompatible parallel battery sources remain legal sandbox projects with fault findings',()=>{
 const p=blankProject(),b=makeDevice('battery',0,0),i=makeDevice('inverter',300,0);p.devices=[b,i]
 p.wires=[connect(b,'p',i,'dc-'),connect(b,'n',i,'dc+')]
 assert.ok(validateProject(p));assert.ok(connectionFindings(p).some(f=>f.id==='bank-polarity-'+i.id));assert.doesNotThrow(()=>compileCircuit(p))
 const other=makeDevice('battery',0,300);other.spec.voltage=12.8;p.devices.push(other);p.wires.push(connect(b,'p',other,'p'),connect(b,'n',other,'n'))
 assert.ok(connectionFindings(p).some(f=>f.id.startsWith('bank-conflict-')))
})
test('PV check uses cold open-circuit series voltage and the largest parallel string',()=>{
 const p=blankProject(),a=makeDevice('pv',0,0),b=makeDevice('pv',300,0),c=makeDevice('pv',0,300),m=makeDevice('mppt',600,0)
 for(const d of [a,b]){d.spec.voc=48;d.spec.voltage=40}c.spec.voc=115;c.spec.voltage=90;m.spec.voc=100;p.devices=[a,b,c,m]
 p.wires=[connect(a,'p',m,'pv+'),connect(a,'n',b,'p'),connect(b,'n',m,'pv-'),connect(c,'p',m,'pv+'),connect(c,'n',m,'pv-')]
 assert.match(connectionFindings(p).find(f=>f.id==='pv-open-circuit-'+m.id).detail,/115\.0 V/)
 p.devices=p.devices.filter(d=>d.id!==c.id);p.wires=p.wires.filter(w=>w.from!==c.id&&w.to!==c.id);assert.ok(!connectionFindings(p).some(f=>f.id==='pv-open-circuit-'+m.id))
 p.ambient=-10;assert.ok(connectionFindings(p).some(f=>f.id==='pv-open-circuit-'+m.id))
})
test('sandbox permits AC/DC mistakes while the designer connection gate rejects them',()=>{
 const p=blankProject(),grid=makeDevice('grid',0,0),battery=makeDevice('battery',300,0);p.devices=[grid,battery];p.wires=[connect(grid,'p',battery,'p')]
 assert.ok(validateProject(p));assert.ok(compileCircuit(p).findings.some(f=>f.id.startsWith('domain-mismatch-')));assert.throws(()=>assertDesignConnections(p),/AC and DC/)
 assert.doesNotThrow(()=>assertDesignConnections(designSystem(defaultRequirements)))
})
test('generic passives on an AC circuit do not create a false DC-only wiring fault',()=>{
 const p=blankProject(),g=makeDevice('grid',0,0),r=makeDevice('resistor',300,0);p.devices=[g,r];p.wires=[connect(g,'p',r,'p'),connect(g,'n',r,'n')]
 assert.ok(!connectionFindings(p).some(f=>f.id.startsWith('domain-mismatch-')))
})
test('a partially connected active device gets a visible warning while a newly placed device remains a note',()=>{
 const p=blankProject(),b=makeDevice('battery',0,0),r=makeDevice('resistor',300,0);p.devices=[b,r]
 assert.equal(compileCircuit(p).findings.find(f=>f.id==='open-'+r.id).severity,'info')
 p.wires=[connect(b,'p',r,'p')]
 const finding=compileCircuit(p).findings.find(f=>f.id==='open-'+r.id);assert.equal(finding.severity,'warning');assert.match(finding.detail,/2 is unconnected/)
})
test('closest products explain connected voltage conflicts while keeping sandbox choices available',()=>{
 const p=blankProject(),b=makeDevice('battery',0,0),i=makeDevice('inverter',300,0);b.spec.voltage=12.8;b.spec.capacityAh=150;p.devices=[b,i];p.wires=[connect(b,'p',i,'dc+'),connect(b,'n',i,'dc-')]
 const options=productOptions(b,CATALOG_RECORDS,p);assert.ok(options.length);assert.ok(options[0].issues.some(s=>s.includes('voltage classes differ')))
 assert.equal(matchingProducts(b,CATALOG_RECORDS,p).length,0)
 const applied=applyCatalogRecord(b,options[0].record);assert.equal(applied.id,b.id);assert.equal(applied.spec.capacityAh,160)
 p.wires=[];assert.ok(matchingProducts(b,CATALOG_RECORDS,p).length)
})
test('controller product application preserves a supported configured bank class and its PV power table',()=>{
 const d=makeDevice('mppt',0,0),r=CATALOG_RECORDS.find(r=>r.id==='victron-smartsolar-100-50');d.spec.chargeVoltage=28.8
 const applied=applyCatalogRecord(d,r);assert.ok(Math.abs(applied.spec.chargeVoltage-28.8)<1e-8);assert.equal(applied.spec.watts,r.nominalPvPowerWByBatteryVoltage['24'])
})
test('inverter closest products respect configured surge power and AC frequency',()=>{
 const d=makeDevice('inverter',0,0);Object.assign(d.spec,{cutoff:9.3,watts:900,rating:2000,frequency:50});assert.ok(matchingProducts(d,CATALOG_RECORDS).length)
 d.spec.rating=5000;assert.equal(matchingProducts(d,CATALOG_RECORDS).length,0);d.spec.rating=2000;d.spec.frequency=60;assert.equal(matchingProducts(d,CATALOG_RECORDS).length,0)
})
test('warning leaders avoid equipment rectangles rather than falling back through them',()=>{
 const obstacles=[{left:10,top:10,right:100,bottom:100},{left:130,top:20,right:230,bottom:90}],route=warningLeader([{x:100,y:50},{x:55,y:10}],{x:300,y:50},obstacles)
 assert.ok(route);assert.ok(clearLeader(route,obstacles));assert.ok(route.length>2)
 assert.equal(clearLeader([{x:100,y:50},{x:300,y:50}],obstacles),false)
})
test('optional polarity repair swaps only the affected terminal attachments without mutating the sandbox',()=>{
 const p=blankProject(),b=makeDevice('battery',0,0),i=makeDevice('inverter',300,0);p.devices=[b,i];p.wires=[connect(b,'p',i,'dc-'),connect(b,'n',i,'dc+')]
 const before=structuredClone(p),finding=connectionFindings(p).find(f=>f.id==='bank-polarity-'+i.id),fix=suggestedFix(p,finding)
 assert.ok(fix);assert.deepEqual(p,before);assert.deepEqual(fix.project.wires.map(w=>w.id),p.wires.map(w=>w.id));assert.ok(!connectionFindings(fix.project).some(f=>f.id===finding.id))
})
test('generic voltage repair resolves the selected class mismatch while refusing to relabel real hardware',()=>{
 const p=blankProject(),b=makeDevice('battery',0,0),i=makeDevice('inverter',300,0);b.spec.voltage=12.8;p.devices=[b,i];p.wires=[connect(b,'p',i,'dc+'),connect(b,'n',i,'dc-')]
 const finding=connectionFindings(p).find(f=>f.id==='bank-voltage-'+i.id),fix=suggestedFix(p,finding)
 assert.ok(fix);assert.equal(fix.project.devices[1].spec.cutoff,11);assert.equal(fix.project.devices[1].spec.watts,i.spec.watts)
 i.model='a-real-hardware-reference';assert.equal(suggestedFix(p,finding),null)
})
test('AC/DC crossover repair removes one wire and leaves other equipment and connections intact',()=>{
 const p=blankProject(),g=makeDevice('grid',0,0),b=makeDevice('battery',300,0);p.devices=[g,b];p.wires=[connect(g,'p',b,'p'),connect(g,'n',b,'n')]
 const fix=suggestedFix(p,connectionFindings(p).find(f=>f.target===p.wires[0].id));assert.ok(fix);assert.equal(fix.project.wires.length,1);assert.equal(fix.project.wires[0].id,p.wires[1].id);assert.deepEqual(fix.project.devices.map(d=>d.spec),p.devices.map(d=>d.spec))
})

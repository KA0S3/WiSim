import test from 'node:test'
import assert from 'node:assert/strict'
import {ampacity,defaultInstallation,awgArea} from '../src/workbench/ampacity.ts'
import {engineeringFindings,batteryPermission} from '../src/workbench/engineering.ts'
import {terminationAssessment} from '../src/workbench/terminations.ts'
import {blankProject,connect,makeDevice,validateProject,emptyState} from '../src/workbench/model.ts'
import {compileCircuit} from '../src/workbench/engine.ts'
import {designSystem,defaultRequirements} from '../src/workbench/templates.ts'
import {connectionFindings} from '../src/workbench/connection-checks.ts'
import {exportData} from '../src/workbench/export-data.ts'

test('regional reference values, conservative bounds, material and temperature limits',()=>{
 const w={area:16,material:'copper',installation:defaultInstallation('ZA')}
 assert.equal(ampacity(w,'ZA').amps,83)
 w.installation.temperature=36;w.installation.circuits=3;assert.equal(ampacity(w,'ZA').amps,83*.87*.84)
 w.installation.method='za-ground';w.installation.temperature=30;assert.equal(ampacity(w,'ZA').amps,91*.95*.7)
 w.installation=defaultInstallation('GB');assert.equal(ampacity(w,'GB').amps,76)
 w.installation.loadedConductors=3;assert.equal(ampacity(w,'GB').amps,68)
 w.material='aluminium';assert.match(ampacity(w,'GB').error,/copper/)
 w.material='copper';w.installation=defaultInstallation('US');w.area=awgArea('6');assert.equal(ampacity(w,'US').amps,55)
 w.installation.termination=75;w.installation.temperature=40;w.installation.loadedConductors=6;assert.equal(ampacity(w,'US').amps,75*.91*.8)
 w.area=awgArea('12');w.installation.temperature=30;w.installation.loadedConductors=2;assert.equal(ampacity(w,'US').protectionMax,20)
 w.area=2.5;assert.match(ampacity(w,'US').error,/not in/)
 w.area=awgArea('6');w.installation.temperature=100;assert.match(ampacity(w,'US').error,/outside/)
})
test('designer applies all three regional tables without weakening voltage-drop sizing',()=>{
 for(const region of ['ZA','GB','US']){const p=designSystem({...defaultRequirements,region});assert.equal(p.engineering.region,region);assert.ok(validateProject(p));for(const w of p.wires){const a=ampacity(w,region);assert.ok(a.amps>=w.installation.designCurrent,JSON.stringify({w,a}));if(w.installation.protectionId)assert.ok(a.protectionMax>=p.devices.find(d=>d.id===w.installation.protectionId).spec.rating)}}
})
test('protection, TN/TT fault criteria and terminal hardware produce actionable findings',()=>{
 const p=blankProject(),b=makeDevice('battery',0,0),f=makeDevice('fuse',300,0),w=connect(b,'p',f,'p',6,1);p.devices=[b,f];p.wires=[w];p.engineering={region:'GB',earthing:{scheme:'TN',voltage:230,loopOhm:3,disconnectA:100,touchVoltage:50,faultA:5000,source:'test',neutralBondIds:[]}}
 w.installation={...defaultInstallation('GB'),designCurrent:50,protectionId:f.id};f.spec.rating=100;f.protection={domain:'dc',voltage:60,breakingA:1000,source:'test',conventionalFactor:1.6,letThroughA2s:1e8}
 let findings=engineeringFindings(p);for(const key of ['ampacity','coordination','conventional','breaking','thermal','loop'])assert.ok(findings.some(f=>f.id.includes(key)),key)
 p.engineering.earthing.scheme='TT';p.engineering.earthing.electrodeOhm=2000;p.engineering.earthing.residualA=.03;assert.ok(engineeringFindings(p).some(f=>f.id==='engineering-electrode'))
 w.terminations={from:{hardwareId:'klauke-1R8',studMm:8,conductorClass:2}};assert.deepEqual(terminationAssessment(p,w,'from').issues,[])
 w.terminations.from.conductorClass=5;assert.match(terminationAssessment(p,w,'from').issues.join(),/class 2/)
 assert.ok(exportData(p).csv.includes('Klauke 1R8'))
})
test('PV contact checks exact size, gender, factory family, current and cable diameter',()=>{
 const p=blankProject(),a=makeDevice('pv',0,0),b=makeDevice('bus',300,0),w=connect(a,'p',b,'p',6,1);p.devices=[a,b];p.wires=[w];p.engineering={region:'ZA'}
 w.installation={...defaultInstallation('ZA'),designCurrent:15};w.terminations={from:{hardwareId:'staubli-32.0317P0001',cableDiameterMm:5.5,matingFamily:'Stäubli MC4-Evo 2A',matingGender:'socket'}}
 assert.deepEqual(terminationAssessment(p,w,'from').issues,[])
 w.terminations.from.cableDiameterMm=7;assert.match(terminationAssessment(p,w,'from').issues.join(),/outer diameter/)
 w.terminations.from.matingFamily='MC4';assert.match(terminationAssessment(p,w,'from').issues.join(),/generic MC4/)
})
test('optional PE port persists without shorting equipment and explicit source bond reaches solver',()=>{
 const p=blankProject(),g=makeDevice('grid',0,0),earth=makeDevice('ground',0,300);g.ports.push({id:'pe',label:'PE',domain:'earth',side:'bottom',offset:.8});p.devices=[g,earth];p.wires=[connect(g,'pe',earth,'p',4,1)];p.engineering={region:'GB',earthing:{scheme:'TN',voltage:230,touchVoltage:50,source:'test',neutralBondIds:[g.id]}}
 assert.ok(validateProject(p));assert.equal(connectionFindings(p).length,0)
 const net=compileCircuit(p).netlist;assert.match(net,/Rbond_/);assert.ok(!engineeringFindings(p).some(f=>f.id==='engineering-neutral-bond'))
 g.ports.push({...g.ports.at(-1)});assert.equal(validateProject(p),false)
})
test('BMS charge/discharge permissions are independent and external control is required',()=>{
 const p=blankProject(),b=makeDevice('battery',0,0);p.devices=[b];b.batteryLimits={chargeA:50,dischargeA:100,chargeMinC:5,chargeMaxC:50,dischargeMinC:-20,dischargeMaxC:50,lowVoltage:44.8,highVoltage:57.6,minSoc:0,maxSoc:100,control:'external',externalConnected:false,source:'test'}
 assert.ok(validateProject(p));assert.equal(batteryPermission(p,b,emptyState()).charge,false);b.batteryLimits.externalConnected=true;p.ambient=0;assert.deepEqual([batteryPermission(p,b,emptyState()).charge,batteryPermission(p,b,emptyState()).discharge],[false,true]);p.ambient=25;p.initialSoc=100;assert.equal(batteryPermission(p,b,emptyState()).charge,false)
 b.batteryLimits.lowVoltage=60;assert.equal(validateProject(p),false)
})

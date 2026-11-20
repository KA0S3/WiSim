import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulation } from 'eecircuit-engine'
import { compileCircuit, interpret, prepareState } from '../src/workbench/engine.ts'
import { blankProject, connect, emptyState, makeDevice, validateProject, wireResistance } from '../src/workbench/model.ts'
import { circuitProject, solarProject, threePhaseProject, defaultRequirements, designSystem } from '../src/workbench/templates.ts'
import {makeStructure,mountDevice} from '../src/workbench/spatial.ts'
import {CATALOG_RECORDS} from '../src/catalog.ts'
import {applyCatalogRecord} from '../src/workbench/catalog-device.ts'
import {applyProductSelection} from '../src/workbench/catalog-bank.ts'
import {defaultSolarSite,siteSun,setPanelFacing} from '../src/workbench/solar.ts'
import {resistanceBetween} from '../src/workbench/instruments.ts'
import {defaultBuilding} from '../src/workbench/building-plan.ts'

const engine=new Simulation()
async function solve(p,state=emptyState(),seconds=.1) { await engine.start();state=prepareState(p,state);const compiled=compileCircuit(p,state,seconds);engine.setNetList(compiled.netlist);const raw=await engine.runSim();return interpret(p,raw,state,1,0,compiled.findings,seconds) }
const near=(actual,expected,tolerance,label='value')=>assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: expected ${expected} ± ${tolerance}, got ${actual}`)

test('optional AC inputs power the separate charger and leave inverter output live after loss of supply',async()=>{
 const offGrid=designSystem({...defaultRequirements,acInput:'none'})
 assert.ok(!offGrid.devices.some(d=>['grid','generator','charger'].includes(d.kind)))
 for(const [acInput,kind] of [['shore','grid'],['generator','generator']])for(const [region,voltage,frequency] of [['ZA',230,50],['US',120,60]]){
  const p=designSystem({...defaultRequirements,region,acInput})
  assert.ok(validateProject(p))
  assert.ok(!validateProject({...p,requirements:{...p.requirements,acInput:'invalid'}}))
  p.sun=0
  const source=p.devices.find(d=>d.kind===kind),charger=p.devices.find(d=>d.kind==='charger'),load=p.devices.find(d=>d.kind==='load')
  assert.equal(p.requirements.acInput,acInput)
  assert.equal(source.spec.frequency,frequency)
  let run=await solve(p)
  near(run.frame.devices[source.id].voltage,voltage,2,'Source terminal RMS')
  assert.equal(run.frame.measurements[charger.id+':l'].frequency,frequency)
  assert.ok(run.frame.devices[charger.id].inputPower>450)
  assert.ok(run.frame.devices[charger.id].power>450)
  assert.ok(!run.frame.findings.some(f=>f.severity==='fault'||f.id.startsWith('overload-')))
  source.on=false
  run=await solve(p,run.state,.5)
  assert.ok(Math.abs(run.frame.devices[charger.id].inputPower)<.01)
  run=await solve(p,run.state,.5)
  assert.ok(Math.abs(run.frame.devices[charger.id].power)<.01)
  assert.ok(Math.abs(run.frame.devices[load.id].power)>1000)
 }
})

test('generator overload uses apparent power and latches the AC source open',async()=>{
 const p=blankProject(),source=makeDevice('generator',0,0),load=makeDevice('load',300,0)
 source.spec.rating=250
 p.devices=[source,load];p.wires=[connect(source,'p',load,'p'),connect(source,'n',load,'n')]
 const run=await solve(p,emptyState(),2.1)
 assert.ok(run.state.trips.includes(source.id))
 assert.match(run.state.tripCauses[source.id],/VA exceeded 250 VA/)
 const tripped=await solve(p,run.state)
 assert.ok(Math.abs(tripped.frame.devices[load.id].voltage)<.01)
})

test('directional BMS equivalent limits current, inhibits cold charging and preserves discharge',async()=>{
 const p=blankProject(),b=makeDevice('battery',0,0),load=makeDevice('resistor',300,0);load.spec.resistance=1;p.devices=[b,load];p.wires=[connect(b,'p',load,'p',16,.1),connect(load,'n',b,'n',16,.1)]
 b.batteryLimits={chargeA:5,dischargeA:10,chargeMinC:5,chargeMaxC:50,dischargeMinC:-20,dischargeMaxC:50,lowVoltage:5,highVoltage:60,minSoc:0,maxSoc:100,control:'internal',externalConnected:false,source:'test equivalent'}
 let result=await solve(p);near(result.frame.devices[b.id].current,10,.01,'Discharge current cap');assert.ok(result.frame.devices[b.id].power>0)
 b.batteryLimits.control='external';result=await solve(p);assert.ok(Math.abs(result.frame.devices[b.id].current)<1e-5)
 b.batteryLimits.externalConnected=true;p.ambient=0;result=await solve(p);near(result.frame.devices[b.id].current,10,.01,'Cold discharge remains enabled')
 const source=makeDevice('battery',600,0);source.spec.voltage=58;source.spec.resistance=1;p.devices=[b,source];p.wires=[connect(source,'p',b,'p',16,.1),connect(b,'n',source,'n',16,.1)];p.ambient=25
 result=await solve(p);near(result.frame.devices[b.id].current,-5,.01,'Charge current cap')
 p.ambient=0;result=await solve(p);assert.ok(Math.abs(result.frame.devices[b.id].current)<1e-5,'Cold charge is blocked')
})

test('stored energy remains reported after isolating a capacitor and blocks resistance measurement',async()=>{
 const p=blankProject(),capacitor=makeDevice('capacitor',0,0),state=emptyState()
 capacitor.on=false;p.devices=[capacitor];state.capacitors[capacitor.id]=10
 const result=await solve(p,state),reading=result.frame.devices[capacitor.id]
 near(reading.storedEnergyJ,.05,1e-9,'Retained capacitor energy')
 assert.match(resistanceBetween(p,[{id:capacitor.id,port:'p'},{id:capacitor.id,port:'n'}],result.frame).detail,/Discharge/)
})

test('sourced 550 W module reproduces its STC Vmp/Imp point and cold open-circuit voltage',async()=>{
 const p=blankProject(),pv=applyCatalogRecord(makeDevice('pv',0,0),CATALOG_RECORDS.find(r=>r.id==='canadian-solar-cs6w-550ms-2278')),load=makeDevice('resistor',300,0)
 p.sun=100;p.ambient=25;load.spec.resistance=41.7/13.2;p.devices=[pv,load];p.wires=[connect(pv,'p',load,'p',240,0),connect(load,'n',pv,'n',240,0)]
 let result=await solve(p);near(result.frame.devices[pv.id].voltage,41.7,.01,'STC operating voltage');near(result.frame.devices[pv.id].current,13.2,.01,'STC operating current');near(result.frame.devices[pv.id].power,550.44,.3,'Rounded STC operating power')
 p.devices=[pv];p.wires=[];p.ambient=-10;result=await solve(p);near(result.frame.devices[pv.id].voltage,54.1136,.001,'Cold open-circuit voltage');assert.ok(Math.abs(result.frame.devices[pv.id].current)<1e-5)
})

test('parallel catalogue alternatives contribute real branch current and conserve source/load/cable power',async()=>{
 for(const [kind,model]of [['battery','victron-lithium-smart-12-8-100'],['pv','victron-bluesolar-175w-12v']]){
  let p=blankProject();const source=makeDevice(kind,0,0),load=makeDevice('resistor',300,0);load.spec.resistance=2;p.devices=[source,load];p.wires=[connect(source,'p',load,'p',16,.5),connect(load,'n',source,'n',16,.5)];p.sun=100
  p=applyProductSelection(p,source.id,CATALOG_RECORDS.find(r=>r.id===model),2)
  for(const d of p.devices)if(d.batteryLimits)d.batteryLimits.externalConnected=true;
  const {frame}=await solve(p),sources=p.devices.filter(d=>d.kind===kind),current=sources.reduce((sum,d)=>sum+frame.devices[d.id].current,0),power=sources.reduce((sum,d)=>sum+frame.devices[d.id].power,0),loss=Object.values(frame.wires).reduce((sum,w)=>sum+w.loss,0)
  assert.equal(sources.length,2);assert.ok(sources.every(d=>frame.devices[d.id].current>0))
  near(current,frame.devices[load.id].current,.00001,'Parallel branch current balance')
  near(power,frame.devices[load.id].power+loss,.0001,'Parallel source power balance')
 }
})

test('50/60 Hz inverter output and DC battery/cable readings share a power-conserving observation period',async()=>{
 for(const frequency of [50,60]){
  const p=blankProject(),b=makeDevice('battery',0,0),inv=makeDevice('inverter',300,0),load=makeDevice('load',600,0);inv.spec.frequency=frequency;p.devices=[b,inv,load];p.wires=[connect(b,'p',inv,'dc+',16,1),connect(b,'n',inv,'dc-',16,1),connect(inv,'l',load,'p',2.5,1),connect(inv,'n',load,'n',2.5,1)]
  let result
  for(const seconds of [.1,.04,.02]){
   result=await solve(p,result?.state??emptyState(),seconds)
   const f=result.frame,dcLoss=p.wires.slice(0,2).reduce((sum,w)=>sum+f.wires[w.id].loss,0)
   const expected=f.devices[inv.id].power/inv.spec.efficiency+8+dcLoss
   // Permit 0.05% for nonlinear solver/interpolated-sample error, below the
   // configured 0.1% relative solver tolerance. A mismatched 20 ms window at
   // 60 Hz fails this bound by orders of magnitude.
   near(f.devices[b.id].power,expected,Math.max(.02,expected*.0005),`${frequency} Hz DC/AC conversion balance`)
   assert.equal(f.measurements[b.id].ac,false);assert.equal(f.measurements[b.id].frequency,null);assert.equal(f.measurements[b.id].observationFrequency,frequency)
  }
 }
})

test('independent AC outputs sharing a DC bank retain source classifications and use one full power window',async()=>{
 const p=blankProject(),b=makeDevice('battery',0,0),inverters=[];p.devices=[b]
 for(const frequency of [50,60]){
  const inv=makeDevice('inverter',300,0),load=makeDevice('load',600,0);inv.spec.frequency=frequency;inverters.push(inv);p.devices.push(inv,load);p.wires.push(connect(b,'p',inv,'dc+',16,1),connect(b,'n',inv,'dc-',16,1),connect(inv,'l',load,'p',2.5,1),connect(inv,'n',load,'n',2.5,1))
 }
 let result
 for(const seconds of [.1,.04,.02]){
  result=await solve(p,result?.state??emptyState(),seconds)
  const f=result.frame,dcLoss=p.wires.filter(w=>w.from===b.id).reduce((sum,w)=>sum+f.wires[w.id].loss,0),expected=inverters.reduce((sum,inv)=>sum+f.devices[inv.id].power/inv.spec.efficiency+8,dcLoss)
  near(f.devices[b.id].power,expected,Math.max(.02,expected*.0005),'Shared-bank source/output balance')
  assert.equal(f.measurements[b.id].observationFrequency,null);assert.ok(!f.findings.some(f=>f.id==='frequency-conflict'))
  for(const inv of inverters)assert.equal(f.measurements[inv.id].frequency,inv.spec.frequency)
 }
})

test('a disconnected illuminated panel converges at open-circuit voltage without suppressing a connected system',async()=>{
 const p=solarProject(),loose=makeDevice('pv',0,400,'Unconnected test panel')
 loose.spec.voc=64;p.devices.push(loose)
 // Reproduce the reported network conditions without correcting the mismatch.
 p.devices.find(d=>d.kind==='battery').spec.voltage=54.5
 const controller=p.devices.find(d=>d.kind==='mppt');controller.spec.chargeVoltage=14.4;controller.spec.voltage=18;controller.spec.watts=700
 p.devices.find(d=>d.kind==='motor').on=true
 let result=await solve(p)
 for(let i=0;i<12;i++){
  near(result.frame.devices[loose.id].voltage,64,.001,'Open-circuit voltage')
  assert.ok(Math.abs(result.frame.devices[loose.id].current)<1e-6)
  assert.ok(result.frame.devices[p.devices.find(d=>d.kind==='load').id].power>590)
  assert.equal(result.frame.devices[controller.id].current,0)
  assert.ok(result.frame.findings.some(f=>f.id==='charge-voltage-'+controller.id))
  result=await solve(p,result.state)
 }
 assert.ok(result.frame.time>1.2)
})

test('native PV model retains the generic I/V curve across irradiance, load and open-circuit cases',async()=>{
 const p=blankProject(),pv=makeDevice('pv',0,0),r=makeDevice('resistor',300,0);p.devices=[pv,r];p.wires=[connect(pv,'p',r,'p',16,.1),connect(pv,'n',r,'n',16,.1)]
 for(const sun of [0,1,20,85,100])for(const resistance of [.01,5,100]){
  p.sun=sun;r.spec.resistance=resistance;const {frame}=await solve(p),reading=frame.devices[pv.id],voc=pv.spec.voc,a=Math.max(1,voc*.065)
  const expected=pv.spec.isc*sun/100*(1-Math.exp((reading.voltage-voc)/a))
  near(reading.current,expected,.0001,'PV curve current')
  near(reading.power,frame.devices[r.id].power+Object.values(frame.wires).reduce((s,w)=>s+w.loss,0),.0001,'PV power balance')
 }
 p.wires=[];p.sun=100;near((await solve(p)).frame.devices[pv.id].voltage,pv.spec.voc,.001)
})

test('solar controller conserves energy while charging, tapering and current-limiting',async()=>{
 const p=blankProject(),pv=makeDevice('pv',0,0),mppt=makeDevice('mppt',300,0),b=makeDevice('battery',600,0)
 p.devices=[pv,mppt,b];p.sun=100;p.wires=[connect(pv,'p',mppt,'pv+',16,2),connect(pv,'n',mppt,'pv-',16,2),connect(mppt,'bat+',b,'p',16,2),connect(mppt,'bat-',b,'n',16,2)]
 for(const [rating,target]of [[35,60],[1,60],[35,51.5],[1,51.5]]){
  mppt.spec.rating=rating;mppt.spec.chargeVoltage=target
  const {frame}=await solve(p),r=frame.devices[mppt.id],source=frame.devices[pv.id],battery=frame.devices[b.id]
  assert.ok(r.current>0&&r.current<=rating+.00001)
  near(r.power,r.inputPower*mppt.spec.efficiency,.0001,'Controller conversion balance')
  const pvLoss=p.wires.slice(0,2).reduce((sum,w)=>sum+frame.wires[w.id].loss,0),batteryLoss=p.wires.slice(2).reduce((sum,w)=>sum+frame.wires[w.id].loss,0)
  near(source.power,r.inputPower+pvLoss,.0001,'PV input path')
  near(r.power,-battery.power+batteryLoss,.0001,'Battery output path')
  if(rating===1&&target===60){near(r.current,1,.00001);assert.ok(source.power<60)}
  if(target===51.5)assert.ok(source.power<400)
 }
})

test('full, mismatched, reversed and switched-off controller output curtails PV draw without suppressing readings',async()=>{
 const p=blankProject(),pv=makeDevice('pv',0,0),mppt=makeDevice('mppt',300,0),b=makeDevice('battery',600,0)
 p.devices=[pv,mppt,b];p.sun=100;p.wires=[connect(pv,'p',mppt,'pv+',16,2),connect(pv,'n',mppt,'pv-',16,2),connect(mppt,'bat+',b,'p',16,2),connect(mppt,'bat-',b,'n',16,2)]
 for(const scenario of ['full','mismatched','reverse','off','night','insufficient-pv']){
  mppt.on=scenario!=='off';mppt.spec.chargeVoltage=scenario==='full'?50:scenario==='mismatched'?14.4:60;p.sun=scenario==='night'?0:100;pv.spec.voc=scenario==='insufficient-pv'?22:96
  p.wires[2].toPort=scenario==='reverse'?'n':'p';p.wires[3].toPort=scenario==='reverse'?'p':'n'
  const {frame}=await solve(p),r=frame.devices[mppt.id]
  near(r.current,0,.000001,scenario+' output');near(r.inputPower,0,.0001,scenario+' input draw')
  assert.ok(Math.abs(frame.devices[pv.id].power)<.0001)
  if(p.sun)near(frame.devices[pv.id].voltage,pv.spec.voc,.001,scenario+' open-circuit panel')
 }
})

test('incomplete solver exports cannot silently become fabricated zero readings',async()=>{
 const p=circuitProject(),state=prepareState(p,emptyState()),compiled=compileCircuit(p,state)
 await engine.start();engine.setNetList(compiled.netlist);const raw=await engine.runSim()
 const missing=structuredClone(raw);missing.data=missing.data.filter(d=>d.name==='time')
 assert.throws(()=>interpret(p,missing,state,0,0),/omitted required measurements/)
 const uneven=structuredClone(raw);uneven.data.find(d=>d.name!=='time').values.pop()
 assert.throws(()=>interpret(p,uneven,state,0,0),/inconsistent transient samples/)
 const unordered=structuredClone(raw);unordered.data.find(d=>d.name==='time').values[2]=0
 assert.throws(()=>interpret(p,unordered,state,0,0),/inconsistent transient samples/)
})

test('panel direction and site time change solved PV output without rewiring the circuit',async()=>{
 let p=solarProject();p.solarSite={...defaultSolarSite,enabled:true};const pv=p.devices.find(d=>d.kind==='pv'),sun=siteSun(p.solarSite),connections=structuredClone(p.wires)
 p=setPanelFacing(p,pv.id,90-sun.altitude,sun.azimuth);const aimed=await solve(p)
 p=setPanelFacing(p,pv.id,90,(sun.azimuth+180)%360);const away=await solve(p)
 assert.ok(away.frame.devices[pv.id].power<aimed.frame.devices[pv.id].power*.2)
 p.solarSite.date='2026-11-12T22:00:00.000Z';const night=await solve(p)
 assert.ok(Math.abs(night.frame.devices[pv.id].power)<.001);assert.deepEqual(p.wires,connections)
})

test('a catalogue 12 V inverter powers an AC load rather than retaining the 48 V generic cutoff',async()=>{
 const p=blankProject(),from=id=>CATALOG_RECORDS.find(r=>r.id===id)
 const b=applyCatalogRecord(makeDevice('battery',0,0),from('victron-lithium-smart-12-8-200')),inverter=applyCatalogRecord(makeDevice('inverter',300,0),from('victron-phoenix-12-1200-230v')),load=makeDevice('load',600,0)
 b.batteryLimits.externalConnected=true;load.spec.watts=300;p.devices=[b,inverter,load];p.wires=[connect(b,'p',inverter,'dc+',35,1),connect(b,'n',inverter,'dc-',35,1),connect(inverter,'l',load,'p'),connect(inverter,'n',load,'n')]
 const {frame}=await solve(p);assert.ok(frame.devices[load.id].power>295);assert.ok(frame.devices[b.id].power>frame.devices[load.id].power)
})

test('an inverter with no DC supply remains de-energized without phantom input voltages',async()=>{
 const p=blankProject(),d=makeDevice('inverter',0,0);p.devices=[d]
 const {frame}=await solve(p)
 assert.ok(Math.abs(frame.devices[d.id].voltage)<1e-6)
 for(const value of Object.values(frame.terminals))assert.ok(Math.abs(value)<1e-6)
})

test('60 Hz source drives correct load, passive, meter and return-wire RMS readings',async()=>{
 const p=blankProject(),g=makeDevice('grid',0,0),load=makeDevice('load',400,0)
 g.spec.voltage=120;g.spec.frequency=60;load.spec.voltage=120;load.spec.watts=240
 p.devices=[g,load];p.wires=[connect(g,'p',load,'p',2.5,1),connect(load,'n',g,'n',2.5,1)]
 const expected=120/(60+g.spec.resistance+p.wires.reduce((r,w)=>r+wireResistance(w,p.ambient),0))
 let result=await solve(p)
 for(let segment=0;segment<3;segment++){
  near(result.frame.devices[load.id].current,expected,.003)
  near(result.frame.wires[p.wires[1].id].current,expected,.003,'return current')
  assert.equal(result.frame.measurements[load.id].frequency,60)
  result=await solve(p,result.state)
 }
 const resistor=makeDevice('resistor',400,0);resistor.id=load.id;resistor.spec.resistance=60;p.devices[1]=resistor
 const passive=await solve(p);near(passive.frame.devices[resistor.id].voltage,expected*60,.1)
 near(passive.frame.devices[resistor.id].current,expected,.003)
})
test('adaptive recovery windows preserve complete 50/60 Hz readings and source phase',async()=>{
 for(const frequency of [50,60]){
  const p=blankProject(),g=makeDevice('grid',0,0),r=makeDevice('resistor',300,0);g.spec.frequency=frequency;r.spec.resistance=100;p.devices=[g,r];p.wires=[connect(g,'p',r,'p'),connect(g,'n',r,'n')]
  let result=await solve(p);const expected=result.frame.devices[r.id].current
  for(const seconds of [.04,.02,.02]){const previous=result.state.time;result=await solve(p,result.state,seconds);near(result.frame.devices[r.id].current,expected,.005);near(result.state.time,previous+seconds,1e-8);assert.equal(result.frame.measurements[r.id].frequency,frequency)}
 }
})
test('removed equipment does not accumulate retained node state during a long editing session',async()=>{
 const p=blankProject(),b=makeDevice('battery',0,0),a=makeDevice('resistor',300,0),removed=makeDevice('resistor',300,300);p.devices=[b,a,removed];p.wires=[connect(b,'p',a,'p'),connect(b,'n',a,'n'),connect(b,'p',removed,'p'),connect(b,'n',removed,'n')]
 let result=await solve(p);assert.equal(Object.keys(result.state.nodes).length,6)
 p.devices=p.devices.filter(d=>d.id!==removed.id);p.wires=p.wires.filter(w=>w.from!==removed.id&&w.to!==removed.id)
 result=await solve(p,result.state);assert.equal(Object.keys(result.state.nodes).length,4);assert.equal(result.state.enabled[removed.id],undefined);near(result.state.time,.2,1e-8)
})
test('state preparation prunes removed device charge, protection and reactive entries without resetting the current run',()=>{
 const p=blankProject(),b=makeDevice('battery',0,0);p.devices=[b];const state=emptyState();state.time=7
 state.soc={[b.id]:73,removed:12};state.capacitors={[b.id+':output']:5,'removed:output':400};state.trips=[b.id,'removed'];state.enabled={[b.id]:true,removed:true}
 const next=prepareState(p,state);assert.equal(next.time,7);assert.equal(next.soc[b.id],73);assert.equal(next.soc.removed,undefined);assert.equal(next.capacitors[b.id+':output'],5);assert.equal(next.capacitors['removed:output'],undefined);assert.deepEqual(next.trips,[b.id]);assert.equal(state.soc.removed,12)
})

test('mixed-frequency source connections are flagged and measured over the full observation window',async()=>{
 const p=blankProject(),a=makeDevice('grid',0,0),b=makeDevice('grid',0,300),r=makeDevice('resistor',400,100)
 b.spec.frequency=60;r.spec.resistance=100;p.devices=[a,b,r]
 p.wires=[connect(a,'p',r,'p'),connect(a,'n',r,'n'),connect(b,'p',r,'p'),connect(b,'n',r,'n')]
 const {frame}=await solve(p)
 assert.ok(frame.findings.some(f=>f.id==='frequency-conflict'))
 assert.equal(frame.measurements[r.id].frequency,null)
 near(frame.devices[r.id].voltage,230/Math.sqrt(2),.4)
})

function chargerProject(){
 const p=blankProject(),grid=makeDevice('grid',0,0),charger=makeDevice('charger',300,0),battery=makeDevice('battery',600,0)
 battery.spec.voltage=12.8;p.devices=[grid,charger,battery]
 p.wires=[connect(grid,'p',charger,'l',2.5,1),connect(grid,'n',charger,'n',2.5,1),connect(charger,'bat+',battery,'p',6,1),connect(charger,'bat-',battery,'n',6,1)]
 return {p,grid,charger,battery}
}
test('charger input energy balances its source and cable losses at the actual supply frequency',async()=>{
 for(const frequency of [50,60]){
  const {p,grid,charger}=chargerProject();grid.spec.frequency=frequency
  let result=await solve(p);for(let i=0;i<4;i++)result=await solve(p,result.state)
  const cableLoss=p.wires.slice(0,2).reduce((sum,w)=>sum+result.frame.wires[w.id].loss,0)
  near(result.frame.devices[charger.id].inputPower,result.frame.devices[grid.id].power-cableLoss,.15,`${frequency} Hz source/charger AC power balance`)
 }
})
test('AC charger supplies bounded DC current and consumes real AC power through its rectifier',async()=>{
 const {p,charger,battery}=chargerProject();let result=await solve(p)
 for(let i=0;i<4;i++)result=await solve(p,result.state)
 const r=result.frame.devices[charger.id]
 assert.ok(r.current>14&&r.current<=15.001)
 assert.ok(result.frame.devices[battery.id].power<-170)
 assert.ok(r.inputPower>r.power);near(r.power/r.inputPower,.9,.06,'charger efficiency including rectifier losses')
 assert.ok(result.state.capacitors[charger.id]>200)
})
test('charger loses output after mains disconnection and finite stored energy is depleted',async()=>{
 const {p,grid,charger}=chargerProject();let result=await solve(p)
 grid.on=false
 for(let i=0;i<10;i++)result=await solve(p,result.state)
 assert.ok(Math.abs(result.frame.devices[charger.id].current)<.01)
 assert.ok(Math.abs(result.frame.devices[charger.id].inputPower)<.01)
})

test('charger DC energy during mains loss is bounded by the physical capacitor energy',async()=>{
 const {p,grid,charger}=chargerProject();let result=await solve(p),energy=0
 const initial=.5*charger.spec.capacitance*result.state.capacitors[charger.id]**2
 grid.on=false
 for(let step=0;step<10;step++){
  result=await solve(p,result.state)
  const f=result.frame,v=f.waveforms[charger.id],amps=f.waveforms[p.wires[2].id]
  for(let i=1;i<f.times.length;i++)energy+=(f.times[i]-f.times[i-1])*(v[i]*amps[i]+v[i-1]*amps[i-1])/2
 }
 const remaining=.5*charger.spec.capacitance*result.state.capacitors[charger.id]**2
 assert.ok(energy>10)
 assert.ok(energy/charger.spec.efficiency<=initial-remaining+.05,`output ${energy} J exceeds available stored energy ${initial-remaining} J`)
})
test('charger regulates an unloaded voltage and stays unpowered without a mains source',async()=>{
 const {p,charger,battery}=chargerProject();p.devices=p.devices.filter(d=>d.id!==battery.id);p.wires=p.wires.filter(w=>w.to!==battery.id)
 const charged=await solve(p);assert.ok(charged.frame.devices[charger.id].voltage<=14.401)
 const empty=blankProject();empty.devices=[makeDevice('charger',0,0)]
 const unpowered=await solve(empty);assert.ok(Math.abs(unpowered.frame.devices[empty.devices[0].id].current)<1e-6)
})

test('catalogue solar/controller/battery components produce charging within the configured current limit',async()=>{
 const p=blankProject(),product=(kind,id)=>applyCatalogRecord(makeDevice(kind,0,0),CATALOG_RECORDS.find(r=>r.id===id))
 const pv=product('pv','victron-bluesolar-175w-12v'),mppt=product('mppt','victron-smartsolar-75-15'),battery=product('battery','victron-lithium-smart-12-8-100')
 battery.batteryLimits.externalConnected=true;p.sun=100;p.devices=[pv,mppt,battery];p.wires=[connect(pv,'p',mppt,'pv+'),connect(pv,'n',mppt,'pv-'),connect(mppt,'bat+',battery,'p'),connect(mppt,'bat-',battery,'n')]
 const {frame}=await solve(p);assert.ok(frame.devices[battery.id].power<-80);assert.ok(frame.devices[mppt.id].current<=15.001);assert.ok(frame.devices[battery.id].voltage<14.4)
})

test('moving a mounting surface changes the real solved current through its measured conductors',async()=>{
  let p=blankProject();const b=makeDevice('battery',0,0),r=makeDevice('resistor',400,0),wall=makeStructure('wall')
  b.spec.voltage=12;r.spec.resistance=1;p.devices=[b,r];p.structures=[wall]
  p.wires=[connect(b,'p',r,'p',1,999),connect(r,'n',b,'n',1,999)];p.wires.forEach(w=>w.lengthMode='physical')
  p=mountDevice(p,b.id,wall.id)
  const first=await solve(p)
  // Deliberately leave persisted device positions/cable lengths stale: the solver derives them.
  p.structures[0].position=[50,30,-2]
  const second=await solve(p)
  assert.ok(second.frame.devices[r.id].current<first.frame.devices[r.id].current*.6)
  assert.ok(second.frame.wires[p.wires[0].id].resistance>first.frame.wires[p.wires[0].id].resistance)
})

test('imported identifiers differing by punctuation or case remain electrically independent',async()=>{
  const p=blankProject(),b=makeDevice('battery',0,0),a=makeDevice('resistor',300,0),c=makeDevice('resistor',300,300)
  b.spec.voltage=12;a.id='Load-a';c.id='load_a';a.spec.resistance=10;c.spec.resistance=20
  p.devices=[b,a,c];p.wires=[connect(b,'p',a,'p'),connect(a,'n',b,'n'),connect(b,'p',c,'p'),connect(c,'n',b,'n')]
  p.wires.forEach((w,i)=>{w.id=['Wire-a','wire_a','WIRE-A','wire-a'][i]})
  assert.ok(validateProject(p))
  const {frame}=await solve(p)
  near(frame.devices[a.id].current/frame.devices[c.id].current,2,.002)
  near(frame.devices[b.id].current,frame.devices[a.id].current+frame.devices[c.id].current,.00001)
  for(const w of p.wires)assert.ok(frame.wires[w.id].current>0)
})

test('solver derives physical cable length instead of trusting a stale saved length',async()=>{
 const p=blankProject(),b=makeDevice('battery',0,0),r=makeDevice('resistor',300,0)
 b.spec.voltage=12;r.spec.resistance=1;b.physical=[0,0,0];r.physical=[1,0,0];p.devices=[b,r]
 p.wires=[connect(b,'p',r,'p',1,999),connect(r,'n',b,'n',1,999)]
 p.wires.forEach(w=>{w.lengthMode='physical'})
 const first=await solve(p);r.physical=[1,10,0];const second=await solve(p)
 assert.ok(first.frame.devices[r.id].current>second.frame.devices[r.id].current)
 assert.ok(second.frame.wires[p.wires[0].id].resistance>first.frame.wires[p.wires[0].id].resistance)
 assert.ok(first.frame.wires[p.wires[0].id].resistance<.1)
})

test('real ngspice solution obeys Ohm law and includes both conductor resistances',async()=>{
  const p=blankProject(),b=makeDevice('battery',0,0),r=makeDevice('resistor',300,0)
  b.spec.voltage=12;b.spec.resistance=.01;r.spec.resistance=6;p.devices=[b,r]
  p.wires=[connect(b,'p',r,'p',1,5),connect(r,'n',b,'n',1,5)]
  const result=await solve(p),expected=12/(6+.01+p.wires.reduce((s,w)=>s+wireResistance(w,p.ambient),0))
  near(result.frame.devices[r.id].current,expected,.0001,'load current')
  near(result.frame.wires[p.wires[0].id].current,result.frame.wires[p.wires[1].id].current,.000001,'KCL')
  const losses=p.wires.reduce((s,w)=>s+result.frame.wires[w.id].loss,0)
  near(result.frame.devices[b.id].power,result.frame.devices[r.id].power+losses,.001,'terminal energy balance')
})

test('removing a return conductor interrupts load current',async()=>{
  const p=blankProject(),b=makeDevice('battery',0,0),r=makeDevice('resistor',300,0);b.spec.voltage=12;r.spec.resistance=6;p.devices=[b,r];p.wires=[connect(b,'p',r,'p')]
  const {frame}=await solve(p);assert.ok(Math.abs(frame.devices[r.id].current)<.000001)
})

test('parallel branches carry different currents and sum at the source',async()=>{
  const p=blankProject(),b=makeDevice('battery',0,0),a=makeDevice('resistor',300,0),c=makeDevice('resistor',300,300);b.spec.voltage=12;a.spec.resistance=10;c.spec.resistance=20;p.devices=[b,a,c];p.wires=[connect(b,'p',a,'p'),connect(a,'n',b,'n'),connect(b,'p',c,'p'),connect(c,'n',b,'n')]
  const {frame}=await solve(p);near(frame.devices[a.id].current/frame.devices[c.id].current,2,.002);near(frame.devices[b.id].current,frame.devices[a.id].current+frame.devices[c.id].current,.00001)
})

test('capacitor charge is retained across transient segments and agrees with exponential solution',async()=>{
  const p=circuitProject(),cap=p.devices.find(d=>d.kind==='capacitor'),b=p.devices.find(d=>d.kind==='battery'),r=p.devices.find(d=>d.kind==='resistor')
  const first=await solve(p),second=await solve(p,first.state),R=r.spec.resistance+b.spec.resistance+.001+p.wires.reduce((s,w)=>s+wireResistance(w,p.ambient),0)
  near(first.state.capacitors[cap.id],12*(1-Math.exp(-.1/(R*cap.spec.capacitance))),.04)
  near(second.state.capacitors[cap.id],12*(1-Math.exp(-.2/(R*cap.spec.capacitance))),.04)
  assert.ok(second.state.capacitors[cap.id]>first.state.capacitors[cap.id])
})

test('solar system supplies the load and surplus charges the battery',async()=>{
  const p=solarProject(),{frame}=await solve(p),get=kind=>frame.devices[p.devices.find(d=>d.kind===kind).id]
  assert.ok(get('pv').power>900);near(get('load').power,597,3);assert.ok(get('battery').power<0);near(get('inverter').voltage,230,1)
})

test('loss of sunlight changes the battery from charging to supplying power',async()=>{
  const p=solarProject();p.sun=0;const {frame}=await solve(p),b=p.devices.find(d=>d.kind==='battery');assert.ok(frame.devices[b.id].power>600)
})

test('three-phase waveform angles produce line-line voltage near sqrt(3) times phase voltage',async()=>{
  const p=threePhaseProject(),{frame}=await solve(p),g=p.devices[0],a=frame.waveforms[`${g.id}:a`],b=frame.waveforms[`${g.id}:b`]
  let sum=0,span=0
  for(let i=1;i<a.length;i++){const dt=frame.times[i]-Math.max(.08,frame.times[i-1]);if(dt<=0)continue;sum+=((a[i]-b[i])**2+(a[i-1]-b[i-1])**2)/2*dt;span+=dt}
  near(Math.sqrt(sum/span),230*Math.sqrt(3),2,'line-line voltage')
  const loads=p.devices.filter(d=>d.kind==='load').map(d=>frame.devices[d.id].current);assert.ok(loads[0]<loads[1]&&loads[1]<loads[2])
})

test('turning a motor on later starts a fresh inrush event',async()=>{
  const p=solarProject(),motor=p.devices.find(d=>d.kind==='motor'),state=emptyState();state.time=5;state.enabled[motor.id]=false;motor.on=true
  const started=prepareState(p,state);assert.equal(started.starts[motor.id],5)
  const first=await solve(p,started);const later=await solve(p,{...first.state,time:7});assert.ok(first.frame.devices[motor.id].current>later.frame.devices[motor.id].current*2)
})

test('generic fuse latches open after sustained overcurrent',async()=>{
  const p=blankProject(),b=makeDevice('battery',0,0),f=makeDevice('fuse',300,0),r=makeDevice('resistor',600,0);b.spec.voltage=12;f.spec.rating=1;r.spec.resistance=.5;p.devices=[b,f,r];p.wires=[connect(b,'p',f,'p'),connect(f,'n',r,'p'),connect(r,'n',b,'n')]
  const first=await solve(p);assert.ok(first.state.trips.includes(f.id));const second=await solve(p,first.state);assert.ok(Math.abs(second.frame.devices[r.id].current)<.000001)
})

test('automatic design generates a valid connected project that the real engine solves',async()=>{
  for(const region of ['ZA','GB','US']) {const p=designSystem({...defaultRequirements,region});assert.ok(validateProject(p));const {frame}=await solve(p);const load=p.devices.find(d=>d.kind==='load');assert.ok(frame.devices[load.id].power>2300);assert.ok(p.designNotes.some(n=>n.includes('Provisional')))}
})

test('building-fitted design solves after supported route lengths resize its conductors',async()=>{
 const p=designSystem({...defaultRequirements,building:defaultBuilding()});p.sun=0
 const {frame}=await solve(p),load=p.devices.find(d=>d.kind==='load')
 assert.ok(frame.devices[load.id].power>2300);assert.equal(p.fitIssues.length,0)
 assert.ok(p.wires.every(w=>w.autoRoute&&!w.autoRoute.error))
 assert.ok(!frame.findings.some(f=>f.severity==='fault'))
})

test('automatic split/three-phase output has measured line voltages and scheduled loads switch at the chosen hour',async()=>{
 for(const [phases,region,ratio] of [['split','US',2],['three','ZA',Math.sqrt(3)]]){
  const p=designSystem({...defaultRequirements,phases,region});p.sun=0
  const result=await solve(p),inverters=p.devices.filter(d=>d.kind==='inverter'),a=result.frame.waveforms[inverters[0].id+':l'],b=result.frame.waveforms[inverters[1].id+':l'],times=result.frame.times
  const {measureBetween}=await import('../src/workbench/measurements.ts')
  const measurement={ac:true,frequency:region==='US'?60:50},line=measureBetween(a,b,times,measurement,measurement)
  near(line.value,inverters[0].spec.voltage*ratio,2,'Line-to-line RMS voltage')
 }
 const p=designSystem({...defaultRequirements,appliances:[{id:'day',name:'Day appliance',watts:1000,quantity:1,startHour:8,endHour:10,startupMultiplier:1,startupSeconds:0,phase:'auto'}]})
 p.sun=0;p.scheduleHour=8
 const first=await solve(p),load=p.devices.find(d=>d.schedule)
 assert.ok(first.frame.devices[load.id].power>950)
 p.scheduleHour=12
 const second=await solve(p,first.state)
 assert.ok(second.frame.devices[load.id].power<.001);assert.equal(load.on,true)
})

test('generated high-power and high-solar systems stay within their generic battery current limits',async()=>{
  for(const requirements of [
    {...defaultRequirements,dailyKwh:1,peakW:8000,autonomyHours:1},
    {...defaultRequirements,dailyKwh:40,peakW:2400},
  ]) {
    const p=designSystem(requirements),batteries=p.devices.filter(d=>d.kind==='battery'),load=p.devices.find(d=>d.kind==='load')
    p.sun=0
    const discharge=await solve(p)
    assert.ok(discharge.frame.devices[load.id].power>requirements.peakW*.95)
    for(const battery of batteries)assert.ok(Math.abs(discharge.frame.devices[battery.id].current)<battery.spec.rating)
    const currents=batteries.map(b=>discharge.frame.devices[b.id].current)
    assert.ok(Math.max(...currents)-Math.min(...currents)<.001,'Parallel packs should share current with balanced branches')
    p.sun=100;load.on=false
    const charge=await solve(p)
    for(const battery of batteries){assert.ok(charge.frame.devices[battery.id].current<0);assert.ok(Math.abs(charge.frame.devices[battery.id].current)<=battery.spec.rating)}
  }
})

test('import validation rejects invalid ratings, duplicate identity and missing endpoints',()=>{
  const p=solarProject();assert.ok(validateProject(p));const bad=structuredClone(p);bad.devices[0].spec.voltage=-10;assert.equal(validateProject(bad),false);const duplicate=structuredClone(p);duplicate.devices.push(duplicate.devices[0]);assert.equal(validateProject(duplicate),false);const dangling=structuredClone(p);dangling.wires[0].to='missing';assert.equal(validateProject(dangling),false)
})

test('import validation rejects malformed terminals and ambiguous state identifiers without throwing',()=>{
  for(const mutate of [
    p=>delete p.id,
    p=>p.devices[0].id='__proto__',
    p=>p.devices[0].id='constructor',
    p=>p.wires[0].id=p.devices[0].id,
    p=>p.devices[0].ports[0]=null,
    p=>p.devices[0].ports[0].domain='ac',
    p=>p.devices[0].ports[0].side='nowhere',
    p=>p.devices[0].ports[0].offset=2,
    p=>p.devices[0].spec.frequency=0,
  ]) { const p=solarProject();mutate(p);assert.equal(validateProject(p),false) }
})

test('latched trip keeps original measured overload and affected circuit after opening',async()=>{
 const p=blankProject(),fuse=makeDevice('fuse',100,0),battery=makeDevice('battery',0,0),load=makeDevice('resistor',300,0)
 load.spec.resistance=.1;fuse.spec.rating=1;p.devices=[battery,fuse,load];p.wires=[connect(battery,'p',fuse,'p',16,.1),connect(fuse,'n',load,'p',16,.1),connect(load,'n',battery,'n',16,.1)]
 let result=await solve(p)
 assert.ok(result.state.trips.includes(fuse.id))
 const original=result.frame.findings.find(f=>f.id===`trip-${fuse.id}`).detail
 assert.match(original,/A exceeded 1 A/);assert.match(original,/Connected equipment/)
 result=await solve(p,result.state)
 assert.equal(result.frame.findings.find(f=>f.id===`trip-${fuse.id}`).detail,original)
})

test('generated long-start motor survives repeated real-engine windows without overload or trip',async()=>{
 const p=designSystem({...defaultRequirements,appliances:[{id:'pump',name:'Pump',watts:1500,quantity:1,startHour:8,endHour:10,startupMultiplier:4,startupSeconds:5,phase:'auto'}]});p.sun=0
 let state=emptyState()
 for(let i=0;i<24;i++){const result=await solve(p,state);state=result.state;assert.equal(state.trips.length,0);assert.ok(!result.frame.findings.some(f=>f.severity==='fault'||f.id.startsWith('overload-')||f.id.startsWith('battery-limit-')),JSON.stringify(result.frame.findings))}
})

test('schematic exports retain PV input measurements for long imported identities and branch aliases',async()=>{
 const p=solarProject()
 const renamed=new Map(p.devices.map((d,i)=>[d.id,'imported-'+i+'-'+('equipment'.repeat(1))]))
 p.devices=p.devices.map(d=>({...d,id:renamed.get(d.id)}))
 p.wires=p.wires.map(w=>({...w,from:renamed.get(w.from),to:renamed.get(w.to)}))
 const state=prepareState(p,emptyState()),compiled=compileCircuit(p,state)
 assert.ok(compiled.netlist.split('\n').filter(line=>line.startsWith('.save ')).every(line=>line.length<1024))
 await engine.start();engine.setNetList(compiled.netlist);const raw=await engine.runSim()
 const aliases=structuredClone(raw);aliases.data=aliases.data.map(d=>({...d,name:d.name.startsWith('i(')?d.name.slice(2,-1)+'#branch':d.name}))
 const result=interpret(p,aliases,state,1,0,compiled.findings)
 const controller=p.devices.find(d=>d.kind==='mppt')
 assert.ok(result.frame.devices[controller.id].inputPower>0)
})

test('inverter DC input readings and configurable limits reflect the solved battery supply',async()=>{
 const p=solarProject(),inverter=p.devices.find(d=>d.kind==='inverter')
 assert.equal(validateProject(p),true)
 inverter.spec.dcMaxVoltage=40;inverter.spec.dcMaxCurrent=1
 assert.equal(validateProject(p),true)
 const {frame}=await solve(p),r=frame.devices[inverter.id]
 assert.ok(r.inputVoltage>40)
 assert.ok(r.inputCurrent>1)
 assert.ok(r.inputPower>r.power)
 near(r.inputPower,r.power/inverter.spec.efficiency+(inverter.spec.idleWatts??8),.1,'DC input conversion balance')
 assert.ok(frame.findings.some(f=>f.id==='inverter-dc-voltage-'+inverter.id))
 assert.ok(frame.findings.some(f=>f.id==='inverter-dc-current-'+inverter.id))
 delete inverter.spec.dcMaxVoltage;delete inverter.spec.dcMaxCurrent
 assert.equal(validateProject(p),true)
})

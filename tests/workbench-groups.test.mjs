import test from 'node:test'
import assert from 'node:assert/strict'
import {blankProject,makeDevice,connect,validateProject} from '../src/workbench/model.ts'
import {defaultRequirements,designSystem} from '../src/workbench/templates.ts'
import {groupTopology,createEquipmentGroup,schematicProjection,moveDiagramItems,setGroupCollapsed,expandedSelection,groupReadings,duplicateGroupBranch} from '../src/workbench/equipment-groups.ts'
import {compileCircuit} from '../src/workbench/engine.ts'
import {synchronizeLengths} from '../src/workbench/geometry.ts'
import {selectionProject,pasteSelection} from '../src/workbench/selection.ts'
import {diagramPositions} from '../src/workbench/diagram-layout.ts'

const designed=()=>designSystem(defaultRequirements)
test('compact designer groups retain every physical device and solver branch',()=>{
 const p=designed(),view=schematicProjection(p),without={...p,groups:undefined}
 assert.equal(p.devices.length,23);assert.equal(p.wires.length,29);assert.equal(view.project.devices.length,8);assert.equal(p.groups.length,2);assert.ok(validateProject(p))
 assert.equal(groupTopology(p,p.groups[0]),'3 parallel strings x 2 in series');assert.equal(groupTopology(p,p.groups[1]),'2 parallel branches x 1 in series')
 assert.equal(compileCircuit(p).netlist,compileCircuit(without).netlist)
 for(const w of view.project.wires){assert.ok(view.project.devices.some(d=>d.id===w.from&&d.ports.some(port=>port.id===w.fromPort)));assert.ok(view.project.devices.some(d=>d.id===w.to&&d.ports.some(port=>port.id===w.toPort)))}
 const mppt=p.devices.find(d=>d.kind==='mppt'),inverter=p.devices.find(d=>d.kind==='inverter')
 for(const [id,positive,negative]of [[mppt.id,'pv+','pv-'],[inverter.id,'dc+','dc-']]){assert.equal(p.wires.find(w=>w.to===id&&w.toPort===positive).color,'#d47c62');assert.equal(p.wires.find(w=>w.to===id&&w.toPort===negative).color,'#738496')}
 for(const w of p.wires.filter(w=>!view.project.wires.some(v=>v.id===w.id)))assert.ok(view.targetMap[w.id])
})
test('group movement translates all member diagram coordinates once and preserves measured physical wiring',()=>{
 const p=designed(),g=p.groups[0],next=synchronizeLengths(moveDiagramItems(p,{[g.id]:{x:g.x+100,y:g.y-80}}))
 assert.deepEqual(next.wires,p.wires)
 for(const d of p.devices){const moved=next.devices.find(n=>n.id===d.id);assert.equal(moved.x,d.x+(g.members.includes(d.id)?100:0));assert.equal(moved.y,d.y+(g.members.includes(d.id)?-80:0));assert.deepEqual(moved.physical,d.physical)}
 assert.equal(compileCircuit(p).netlist,compileCircuit(next).netlist)
 assert.equal(schematicProjection(setGroupCollapsed(p,g.id,false)).project.devices.length,18)
})
test('unwired grouped source terminals remain connectable and do not imply parallel topology',()=>{
 const p=blankProject(),a=makeDevice('pv',0,0),b=makeDevice('pv',300,0);p.devices=[a,b]
 const grouped=createEquipmentGroup(p,[a.id,b.id]),view=schematicProjection(grouped)
 assert.equal(view.project.devices.length,1);assert.equal(view.project.devices[0].ports.length,4);assert.equal(grouped.wires.length,0)
 assert.match(groupTopology(grouped,grouped.groups[0]),/Separate or complex/)
 assert.deepEqual(new Set(view.project.devices[0].ports.map(p=>p.id)),new Set([a.id+':p',a.id+':n',b.id+':p',b.id+':n']))
})
test('copying a collapsed bank retains members and internal wires with remapped independent identities',()=>{
 const p=designed(),g=p.groups[1],subset=selectionProject(p,[g.id],true),pasted=pasteSelection(p,subset)
 assert.equal(subset.devices.length,g.members.length);assert.equal(subset.groups.length,1);assert.ok(subset.wires.length>0);assert.ok(validateProject(subset));assert.ok(validateProject(pasted.project))
 const newGroup=pasted.project.groups.at(-1);assert.notEqual(newGroup.id,g.id);assert.ok(newGroup.members.every(id=>!p.devices.some(d=>d.id===id)));assert.ok(pasted.addedIds.includes(newGroup.id))
 assert.deepEqual(pasted.project.wires.slice(0,p.wires.length),p.wires);assert.equal(expandedSelection(p,[g.id]).length,g.members.length)
 const partial=selectionProject(p,g.members.slice(0,2));assert.equal(partial.groups.length,0)
})
test('imports reject overlapping or dangling group members and collisions; deletion prunes empty groups',()=>{
 const p=designed();for(const change of [q=>q.groups[0].members.push(q.groups[0].members[0]),q=>q.groups[0].members.push('missing'),q=>q.groups[0].id=q.wires[0].id,q=>q.groups[0].members.push(q.groups[1].members[0]),q=>q.groups[0].collapsed='yes']){const q=structuredClone(p);change(q);assert.equal(validateProject(q),false)}
 const gone=new Set(p.groups[0].members),next=synchronizeLengths({...p,devices:p.devices.filter(d=>!gone.has(d.id)),wires:p.wires.filter(w=>!gone.has(w.from)&&!gone.has(w.to))});assert.equal(next.groups.length,1);assert.ok(validateProject(next))
})
test('series source power sums but individual voltage stays a labelled range; missing readings remain unknown',()=>{
 const p=blankProject(),a=makeDevice('pv',0,0),b=makeDevice('pv',300,0);p.devices=[a,b];p.wires=[connect(a,'n',b,'p')];const q=createEquipmentGroup(p,[a.id,b.id]),g=q.groups[0]
 const frame={devices:{[a.id]:{voltage:35,power:300},[b.id]:{voltage:36,power:310}}},r=groupReadings(q,g,frame)
 assert.equal(r.power,610);assert.equal(r.minVoltage,35);assert.equal(r.maxVoltage,36);assert.equal(r.count,2)
 assert.equal(groupReadings(q,g,{devices:{[a.id]:frame.devices[a.id]}}).power,undefined)
})
test('port-aware diagram layouts remain finite, separated and independent of physical wiring',async()=>{
 const p=designed(),snapshot=structuredClone(p)
 for(const mode of ['layered','compact','screen']){
  const positions=await diagramPositions(p,mode,{width:1000,height:500}),view=schematicProjection(p),ids=view.project.devices.map(d=>d.id)
  assert.equal(Object.keys(positions).length,8)
  for(const id of ids)assert.ok(Number.isFinite(positions[id].x)&&Number.isFinite(positions[id].y))
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=positions[ids[i]],b=positions[ids[j]];assert.ok(a.x+210<=b.x||b.x+210<=a.x||a.y+180<=b.y||b.y+180<=a.y,'visible items overlap')}
 }
 assert.deepEqual(p,snapshot)
})
test('adding a parallel branch copies complete series strings and pack protection with real collectors',()=>{
 for(const kind of ['pv-array','battery-bank']){
  const p=designed(),g=p.groups.find(g=>g.kind===kind),next=synchronizeLengths(duplicateGroupBranch(p,g.id)),added=next.devices.slice(p.devices.length),wires=next.wires.slice(p.wires.length)
  assert.equal(added.filter(d=>d.kind==='pv'||d.kind==='battery').length,kind==='pv-array'?2:1);assert.equal(added.filter(d=>d.kind==='fuse').length,1)
  assert.deepEqual(next.devices.slice(0,p.devices.length),p.devices);assert.deepEqual(next.wires.slice(0,p.wires.length),p.wires);assert.ok(validateProject(next))
  const ids=new Set(added.map(d=>d.id)),boundary=wires.filter(w=>ids.has(w.from)!==ids.has(w.to));assert.equal(boundary.length,2)
  assert.ok(boundary.every(w=>p.devices.find(d=>d.id===(ids.has(w.from)?w.to:w.from)).kind==='bus'))
  assert.ok(wires.every(w=>w.lengthMode==='physical'&&w.length>0));assert.equal(next.groups.find(v=>v.id===g.id).members.length,g.members.length+added.length)
  assert.equal(groupTopology(next,next.groups.find(v=>v.id===g.id)),kind==='pv-array'?'4 parallel strings x 2 in series':'3 parallel branches x 1 in series')
 }
})

test('charger and inverter stacks retain independent AC input, DC and AC output paths',()=>{
 const p=blankProject(),charger=makeDevice('charger',0,0),inverter=makeDevice('inverter',300,0)
 p.devices=[charger,inverter]
 const grouped=createEquipmentGroup(p,[charger.id,inverter.id]),g=grouped.groups[0]
 assert.equal(g.kind,'conversion-stack')
 assert.equal(validateProject(grouped),true)
 const projection=schematicProjection(grouped),ports=projection.groups[0].device.ports
 assert.equal(ports.length,8)
 assert.equal(ports.filter(p=>p.domain==='ac').length,4)
 assert.equal(ports.filter(p=>p.domain==='dc').length,4)
 assert.deepEqual(compileCircuit(grouped),compileCircuit({...grouped,groups:undefined}))
 assert.equal(groupReadings(grouped,g,null).count,2)
 assert.equal(setGroupCollapsed(grouped,g.id,false).devices.length,2)
 assert.equal(pasteSelection(blankProject(),selectionProject(grouped,[g.id])).project.groups[0].kind,'conversion-stack')
})

test('flow arrangement is stable under reversed conductor direction and folds in whole layers',async()=>{
 const p=designed(),original=structuredClone(p)
 const reversed={...p,wires:p.wires.map(w=>({...w,from:w.to,to:w.from,fromPort:w.toPort,toPort:w.fromPort}))}
 const screen=await diagramPositions(p,'screen',{width:1000,height:600})
 assert.deepEqual(screen,await diagramPositions(reversed,'screen',{width:1000,height:600}))
 assert.deepEqual(screen,await diagramPositions(p,'screen',{width:1000,height:600}))
 assert.deepEqual(p,original)
 const layered=await diagramPositions(p,'layered'),view=schematicProjection(p)
 const solar=view.project.devices.find(d=>d.kind==='pv'),controller=view.project.devices.find(d=>d.kind==='mppt'),battery=view.project.devices.find(d=>d.kind==='battery'),inverter=view.project.devices.find(d=>d.kind==='inverter'),load=view.project.devices.find(d=>d.kind==='load'||d.kind==='motor')
 for(const [a,b] of [[solar,controller],[controller,battery],[battery,inverter],[inverter,load]])assert.ok(layered[a.id].x<layered[b.id].x)
 assert.ok(new Set(Object.values(screen).map(p=>p.y)).size>1)
 assert.ok(Math.max(...Object.values(screen).map(p=>p.x))<Math.max(...Object.values(layered).map(p=>p.x)))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {Simulation} from 'eecircuit-engine'
import {randomDemoRequirements} from '../src/workbench/demo-design.ts'
import {designGuidance} from '../src/workbench/design-guidance.ts'
import {defaultRequirements,designSystem} from '../src/workbench/templates.ts'
import {arrayOptions} from '../src/workbench/design-options.ts'
import {buildingStructures} from '../src/workbench/building-geometry.ts'
import {buildingRooms,defaultBuilding} from '../src/workbench/building-plan.ts'
import {validBuilding} from '../src/workbench/building-model.ts'
import {surfaceContains} from '../src/workbench/surface-domain.ts'
import {autoCirculation} from '../src/workbench/building-circulation.ts'
import {constructionSchedule,constructionTotal} from '../src/workbench/building-animation.ts'
import {LEARN_SCENARIOS,createLearnTrainingProject,evaluateLearnScenario} from '../src/workbench/learn.ts'
import {connect,emptyState,validateProject} from '../src/workbench/model.ts'
import {compileCircuit,interpret,prepareState} from '../src/workbench/engine.ts'

const seeded=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}

test('designer recovery keeps the energy, peak demand and backup brief',()=>{
 for(const patch of [{panelWatts:1},{maxPanelArea:1},{panelCount:1,stringCount:12}]){
  const r={...defaultRequirements,...patch},guidance=designGuidance(r)
  assert.ok(guidance?.message)
  assert.ok(guidance.fixes.length)
  for(const fix of guidance.fixes){
   const next={...r,...fix.patch}
   assert.equal(next.dailyKwh,r.dailyKwh)
   assert.equal(next.peakW,r.peakW)
   assert.equal(next.autonomyHours,r.autonomyHours)
   assert.ok(arrayOptions(next).length)
  }
 }
 const inconsistent=designGuidance({...defaultRequirements,dailyKwh:30,peakW:100})
 assert.match(inconsistent.message,/average.*exceeds.*peak/)
 assert.equal(inconsistent.fixes.length,0)
})

test('random houses produce different coherent geometry and viable systems across all floor counts',()=>{
 const signatures=new Set(),floorCounts=new Set()
 for(const seed of [1,2,3,5,7,12]){
  const r=randomDemoRequirements(seeded(seed)),layout=r.building
  assert.equal(validBuilding(layout),true)
  signatures.add(JSON.stringify([layout.floors.map(f=>f.nodes.map(n=>n.point)),layout.roofShape,r.dailyKwh,r.peakW]))
  floorCounts.add(layout.floors.length)
  assert.equal(layout.stairs.length,layout.floors.length-1)
  const p=designSystem(r)
  assert.equal(validateProject(p),true)
  assert.deepEqual(p.fitIssues,[])
  assert.ok(p.wires.every(w=>w.autoRoute&&!w.autoRoute.error))
  const schedule=constructionSchedule(p)
  for(const d of p.devices.filter(d=>d.kind!=='pv')){
   const floor=p.structures.find(s=>s.id===d.mount?.structureId)?.building?.floor??0
   const above=p.structures.find(s=>s.kind==='wall'&&s.building.floor===floor+1)
   if(above)assert.ok(schedule.get(d.id)<schedule.get(above.id))
  }
  assert.ok(Math.max(...schedule.values())+1<constructionTotal(layout.floors.length))
 }
 assert.equal(signatures.size,6)
 assert.deepEqual([...floorCounts].sort(),[1,2,3])
})

test('stairs cut the upper floor and doorways leave a full-height walk-through opening',()=>{
 const layout=randomDemoRequirements(seeded(1)).building,surfaces=buildingStructures(layout),stairs=layout.stairs[0]
 const upper=surfaces.find(s=>s.kind==='floor'&&s.building.roomId&&s.building.floor===1&&surfaceContains(s,[stairs.position[0]-s.position[0],s.position[2]-stairs.position[1]])===false&&buildingRooms(layout).find(r=>r.id===s.building.roomId)?.name.includes('stair'))
 assert.ok(upper)
 assert.ok(surfaces.some(s=>s.name.startsWith('Stairs to floor 2')))
 const wall=layout.floors[0].walls.find(w=>w.door),parts=surfaces.filter(s=>s.building.wallId===wall.id)
 assert.equal(parts.length,3)
 assert.ok(parts.some(s=>s.id.endsWith('lintel')&&s.position[1]-s.size[1]/2>=2.09))
 const simple=defaultBuilding(),copy=structuredClone(simple.floors[0])
 const ids=new Map(copy.nodes.map(n=>[n.id,n.id+'upper']))
 copy.id+='upper';copy.nodes=copy.nodes.map(n=>({...n,id:ids.get(n.id)}));copy.walls=copy.walls.map(w=>({...w,id:w.id+'upper',a:ids.get(w.a),b:ids.get(w.b)}));simple.floors.push(copy)
 assert.equal(autoCirculation(simple).stairs.length,1)
})

test('a repair exercise can pass only after the learner restores the supplied installation',async()=>{
 const scenario=LEARN_SCENARIOS.find(s=>s.id==='microgrid-night')
 const p=createLearnTrainingProject(scenario,{sun:0,ambient:23,loadWatts:500,pvWatts:1000,soc:50,inverterWatts:1500})
 assert.equal(p.learn.task,'repair')
 const inverter=p.devices.find(d=>d.kind==='inverter'),controller=p.devices.find(d=>d.kind==='mppt'),load=p.devices.find(d=>d.kind==='load')
 assert.equal(inverter.on,false)
 assert.equal(evaluateLearnScenario(p,null,scenario).allPassed,false)
 inverter.on=true;controller.spec.watts=1200;p.wires.push(connect(inverter,'n',load,'n'))
 const simulation=new Simulation();await simulation.start()
 const state=prepareState(p,emptyState()),compiled=compileCircuit(p,state,.1)
 simulation.setNetList(compiled.netlist)
 const raw=await simulation.runSim(),result=interpret(p,raw,state,1,0,compiled.findings,.1)
 const progress=evaluateLearnScenario(p,result.frame,scenario)
 assert.equal(progress.allPassed,true,JSON.stringify(progress.checklist.filter(c=>!c.passed)))
 p.wires.pop()
 assert.equal(evaluateLearnScenario(p,result.frame,scenario).allPassed,false)
})

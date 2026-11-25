import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultBuilding,buildingRooms,addPlanWall,normalizeFloor,polygonArea,pointInPolygon} from '../src/workbench/building-plan.ts'
import {buildingStructures,availableRoofRooms,exposedRoofPolygons} from '../src/workbench/building-geometry.ts'
import {applyBuilding} from '../src/workbench/building-fit.ts'
import {rectangleFits} from '../src/workbench/surface-domain.ts'
import {constructionDelay,constructionProgress,constructionDuration} from '../src/workbench/building-animation.ts'
import {practiceBuilding} from '../src/workbench/learn-rooms.ts'
import {blankProject,validateProject,uid,makeDevice} from '../src/workbench/model.ts'
import {designSystem,defaultRequirements,solarProject} from '../src/workbench/templates.ts'
import {synchronizeLengths} from '../src/workbench/geometry.ts'
import {transformPoint} from '../src/workbench/spatial.ts'

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} vs ${b}`)
function divided(){const layout=defaultBuilding();layout.floors[0]=addPlanWall(layout.floors[0],[0,-3],[0,3]);return layout}
function copyFloor(floor){const ids=new Map(floor.nodes.map(n=>[n.id,uid('junction')]));return {id:uid('floor'),nodes:floor.nodes.map(n=>({...n,id:ids.get(n.id)})),walls:floor.walls.map(w=>({...w,id:uid('wall'),a:ids.get(w.a),b:ids.get(w.b)}))}}

test('closed wall loops generate stable rooms and editable shared junctions',()=>{
 const layout=divided(),floor=layout.floors[0],rooms=buildingRooms(layout)
 assert.equal(rooms.length,2);near(rooms.reduce((sum,r)=>sum+r.area,0),48)
 const divider=floor.walls.find(w=>floor.nodes.find(n=>n.id===w.a).point[0]===0&&floor.nodes.find(n=>n.id===w.b).point[0]===0)
 assert.ok(divider);const node=floor.nodes.find(n=>n.id===divider.a);node.point=[1,node.point[1]]
 layout.floors[0]=normalizeFloor(floor)
 assert.deepEqual(new Set(buildingRooms(layout).map(r=>r.id)),new Set(rooms.map(r=>r.id)))
 layout.floors[0]=normalizeFloor({...floor,walls:floor.walls.filter(w=>w.id!==divider.id)})
 assert.equal(buildingRooms(layout).length,1)
})

test('crossing walls split automatically into connected rooms',()=>{
 const layout=divided();layout.floors[0]=addPlanWall(layout.floors[0],[-4,0],[4,0])
 const rooms=buildingRooms(layout);assert.equal(rooms.length,4);near(rooms.reduce((sum,r)=>sum+r.area,0),48)
 const junction=layout.floors[0].nodes.find(n=>n.point[0]===0&&n.point[1]===0)
 assert.equal(layout.floors[0].walls.filter(w=>w.a===junction.id||w.b===junction.id).length,4)
})

test('curved walls preserve enclosed area and generate a faceted 3D curve',()=>{
 const layout=defaultBuilding(),wall=layout.floors[0].walls[0];wall.control=[0,-5]
 const room=buildingRooms(layout)[0],surfaces=buildingStructures(layout)
 assert.ok(room.area>48);assert.ok(surfaces.filter(s=>s.kind==='wall').length>10)
 const p=applyBuilding(blankProject(),layout,false);assert.ok(validateProject(JSON.parse(JSON.stringify(p))))
})

test('partial upper floors expose the lower roof footprint accurately',()=>{
 const layout=defaultBuilding(),upper=copyFloor(layout.floors[0]);upper.nodes=upper.nodes.map(n=>({...n,point:n.point.map(value=>value/2)}));layout.floors.push(upper)
 const rooms=buildingRooms(layout),roofs=availableRoofRooms(layout,rooms)
 assert.equal(roofs.length,2)
 near(exposedRoofPolygons(rooms[0],rooms).reduce((sum,poly)=>sum+Math.abs(polygonArea(poly)),0),36)
 const surfaces=buildingStructures(layout);assert.ok(surfaces.some(s=>s.kind==='floor'&&s.building.floor===1))
 assert.ok(validateProject(applyBuilding(blankProject(),layout,false)))
})

test('all roof shapes conform to an irregular footprint',()=>{
 const layout=defaultBuilding();let floor={id:uid('floor'),nodes:[],walls:[]}
 const outline=[[0,0],[6,0],[6,2],[2,2],[2,6],[0,6]]
 for(let i=0;i<outline.length;i++)floor=addPlanWall(floor,outline[i],outline[(i+1)%outline.length])
 layout.floors=[floor]
 for(const shape of ['flat','gable','hip','shed']){
  layout.roofShape=shape;const surfaces=buildingStructures(layout).filter(s=>s.kind==='roof')
  assert.ok(surfaces.length)
  for(const surface of surfaces)for(const poly of surface.polygons)for(const point of poly){const world=transformPoint([point[0],point[1],0],surface.position,surface.rotation);assert.ok(pointInPolygon([world[0],world[2]],outline))}
 }
})

test('zero-pitch gable and hip roofs create one usable surface without duplicate panel placements',()=>{
 for(const roofShape of ['gable','hip']){
  const layout=defaultBuilding();layout.roofShape=roofShape;layout.roofPitch=0
  layout.floors[0].nodes=layout.floors[0].nodes.map(n=>({...n,point:n.point.map(v=>v*.6)}))
  assert.equal(buildingStructures(layout).filter(s=>s.kind==='roof').length,1)
  const p=applyBuilding(designSystem(defaultRequirements),layout,true),panels=p.devices.filter(d=>d.kind==='pv'&&d.mount)
  assert.equal(new Set(panels.map(d=>JSON.stringify(d.physical))).size,panels.length)
  assert.ok(p.fitIssues.some(issue=>issue.includes('could not fit')))
 }
})

test('panel and floor fitting cannot bridge a concave gap',()=>{
 const surface={size:[6,6,.1],polygons:[[[0,0],[6,0],[6,6],[4,6],[4,2],[2,2],[2,6],[0,6]]]}
 assert.equal(rectangleFits(surface,{x:3,y:2,width:4,height:2}),false)
 assert.equal(rectangleFits(surface,{x:1,y:3,width:1,height:2}),true)
})

test('building-only application preserves existing electrical equipment and wiring',()=>{
 const p=synchronizeLengths(solarProject()),next=applyBuilding(p,defaultBuilding(),false)
 assert.deepEqual(next.devices,p.devices);assert.deepEqual(next.wires,p.wires)
 assert.ok(next.structures.length);assert.ok(validateProject(next))
})

test('normal system designer fits sourced equipment and supported routes into its home',()=>{
 const p=designSystem({...defaultRequirements,building:defaultBuilding()})
 assert.ok(validateProject(p));assert.equal(p.fitIssues.length,0)
 assert.ok(p.devices.every(d=>d.mount));assert.ok(p.wires.every(w=>w.autoRoute&&!w.autoRoute.error))
 assert.ok(p.devices.filter(d=>d.kind==='pv'||d.kind==='mppt').every(d=>d.model))
 const restored=synchronizeLengths(JSON.parse(JSON.stringify(p)));assert.deepEqual(restored.building,p.building);assert.deepEqual(restored.wires,p.wires)
})

test('multiple rooms require explicit equipment and roof selection, with fit failures reported',()=>{
 const layout=divided();assert.throws(()=>designSystem({...defaultRequirements,building:layout}),/Choose the room/)
 const rooms=buildingRooms(layout);layout.equipmentRoomId=rooms[0].id;layout.panelRoomId=rooms[1].id
 const p=designSystem({...defaultRequirements,building:layout});assert.ok(validateProject(p));assert.equal(p.fitIssues.length,0)
 assert.throws(()=>designSystem({...defaultRequirements,context:'mobile',building:defaultBuilding(true)}),/cannot be placed and routed/)
})

test('malformed layouts and unsupported generated metadata fail import validation',()=>{
 const p=applyBuilding(blankProject(),defaultBuilding(),false)
 for(const change of [q=>q.building.floors[0].walls[0].a='missing',q=>q.building.roofPitch=90,q=>q.structures[0].building.floor=-1,q=>q.structures.find(s=>s.polygons).polygons=[[[0,0]]]]){
  const bad=structuredClone(p);change(bad);assert.equal(validateProject(bad),false)
 }
})

test('construction timing cascades walls, floors, indoor equipment, roofs and panels',()=>{
 const order=['wall','floor','equipment','roof','pv','wire'].map(kind=>constructionDelay(kind))
 assert.ok(order.every((delay,i)=>i===0||delay>order[i-1]));assert.ok(constructionDuration>order.at(-1)+.8)
 assert.equal(constructionProgress(0,2),0);assert.equal(constructionProgress(4,2),1)
})

test('Learn practice layouts vary by seed and scale room count with difficulty',()=>{
 for(const [difficulty,count] of [['Beginner',1],['Ready',2],['Advanced',3]]){
  const layout=practiceBuilding('sample-one',difficulty),same=practiceBuilding('sample-one',difficulty)
  assert.equal(buildingRooms(layout).length,count);near(buildingRooms(layout).reduce((n,r)=>n+r.area,0),buildingRooms(same).reduce((n,r)=>n+r.area,0))
  assert.ok(validateProject(applyBuilding(blankProject(),layout,false)))
 }
})

test('compass and hemisphere choose the equator-facing roof slope first',()=>{
 for(const [hemisphere,bearing,sign] of [['south',0,-1],['north',0,1],['south',180,1]]){
  const layout=defaultBuilding();layout.roofShape='gable';layout.roofPitch=30;layout.northBearing=bearing;layout.solarHemisphere=hemisphere
  const p=blankProject(),panel=makeDevice('pv',0,0);p.devices=[panel]
  const next=applyBuilding(p,layout,true),roof=next.structures.find(s=>s.id===next.devices[0].mount.structureId)
  const normal=transformPoint([0,0,1],[0,0,0],roof.rotation)
  assert.ok(normal[2]*sign>0,`${hemisphere} bearing ${bearing}: ${normal}`)
 }
})

test('equipment preferences honour the named wall and reject stale placement choices',()=>{
 const layout=defaultBuilding(),room=buildingRooms(layout)[0],wallId=room.walls[0]
 layout.equipmentPlacements={inverter:{roomId:room.id,wallId}}
 const p=blankProject();p.devices=[makeDevice('inverter',0,0)]
 const fitted=applyBuilding(p,layout,true),surface=fitted.structures.find(s=>s.id===fitted.devices[0].mount.structureId)
 assert.equal(surface.building.wallId,wallId);assert.equal(fitted.fitIssues.length,0)
 layout.equipmentPlacements.inverter.wallId='missing'
 assert.throws(()=>applyBuilding(p,layout,true),/no longer exists/)
})

test('adjacent rooms share a continuous roof plane clipped to the building footprint',()=>{
 const layout=divided();layout.roofShape='gable';layout.roofPitch=25
 const rooms=buildingRooms(layout),outline=rooms.flatMap(r=>r.polygon),minZ=Math.min(...outline.map(p=>p[1])),maxZ=Math.max(...outline.map(p=>p[1]))
 for(const roof of buildingStructures(layout).filter(s=>s.kind==='roof'))for(const poly of roof.polygons)for(const point of poly){
  const world=transformPoint([point[0],point[1],0],roof.position,roof.rotation)
  assert.ok(rooms.some(room=>pointInPolygon([world[0],world[2]],room.polygon)))
  near(world[1],layout.floorHeight+Math.min(world[2]-minZ,maxZ-world[2])*Math.tan(25*Math.PI/180))
 }
})

test('detached footprints get their own gable ridges and closed roof ends',()=>{
 const layout=divided()
 const detached=[[12,8],[16,8],[16,10],[12,10]]
 for(const [i,point] of detached.entries())layout.floors[0]=addPlanWall(layout.floors[0],point,detached[(i+1)%detached.length])
 const room=buildingRooms(layout).find(room=>room.polygon.every(([x])=>x>10))
 const surfaces=buildingStructures(layout).filter(surface=>surface.building.roomId===room.id)
 const roofs=surfaces.filter(surface=>surface.kind==='roof')
 const caps=surfaces.filter(surface=>surface.kind==='wall'&&surface.building.stage==='roof')
 assert.equal(roofs.length,2)
 assert.equal(caps.length,2)
 const top=(parts)=>Math.max(...parts.flatMap(surface=>surface.polygons.flatMap(poly=>poly.map(([x,y])=>transformPoint([x,y,0],surface.position,surface.rotation)[1]))))
 near(top(roofs),layout.floorHeight+Math.tan(layout.roofPitch*Math.PI/180))
 near(top(caps),top(roofs))
 const allCaps=buildingStructures(layout).filter(surface=>surface.kind==='wall'&&surface.building.stage==='roof')
 assert.ok(allCaps.every(surface=>Math.abs(surface.position[0])>1))
})

test('an L-shaped hip roof starts a valley at the inside eave and carries it into the ridge',()=>{
 const layout=defaultBuilding()
 layout.roofShape='hip'
 const outline=[[0,0],[8,0],[8,2],[2,2],[2,6],[0,6]]
 layout.floors[0]={id:uid('floor'),nodes:[],walls:[]}
 for(const [i,point] of outline.entries())layout.floors[0]=addPlanWall(layout.floors[0],point,outline[(i+1)%outline.length])
 const slope=Math.tan(layout.roofPitch*Math.PI/180)
 for(const divided of [false,true]){
  if(divided)layout.floors[0]=addPlanWall(layout.floors[0],[0,2],[2,2])
  const parts=buildingStructures(layout)
  const faces=parts.filter(part=>part.kind==='roof').flatMap(part=>part.polygons.map(poly=>poly.map(([x,y])=>transformPoint([x,y,0],part.position,part.rotation))))
  assert.equal(parts.filter(part=>part.kind==='wall'&&part.building.stage==='roof').length,0)
  near(faces.reduce((sum,face)=>sum+Math.abs(polygonArea(face.map(([x,,z])=>[x,z]))),0),24)
  const valleyFaces=faces.filter(face=>face.some(([x,y,z])=>Math.hypot(x-2,z-2)<1e-6&&Math.abs(y-layout.floorHeight)<1e-6)&&
    face.some(([x,y,z])=>Math.hypot(x-1,z-1)<1e-6&&Math.abs(y-layout.floorHeight-slope)<1e-6))
  assert.ok(valleyFaces.length>=2)
 }
})

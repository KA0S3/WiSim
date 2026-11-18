import {defaultBuilding,addPlanWall,buildingRooms} from './building-plan'
import {availableRoofRooms} from './building-geometry'
import type {BuildingLayout} from './building-model'

export function practiceBuilding(seed:string,difficulty:'Beginner'|'Ready'|'Advanced'):BuildingLayout {
  let state=seed.split('').reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261)
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
  const layout=defaultBuilding(),width=4+Math.floor(random()*5),depth=3+Math.floor(random()*4)
  const floor=layout.floors[0]
  floor.nodes=floor.nodes.map(node=>({...node,point:[Math.sign(node.point[0])*width/2,Math.sign(node.point[1])*depth/2]}))
  if(difficulty!=='Beginner')layout.floors[0]=addPlanWall(floor,[0,-depth/2],[0,depth/2])
  if(difficulty==='Advanced')layout.floors[0]=addPlanWall(layout.floors[0],[0,0],[width/2,0])
  layout.roofShape=random()>.5?'gable':'shed';layout.roofPitch=15+Math.floor(random()*20)
  const rooms=buildingRooms(layout),roofs=availableRoofRooms(layout,rooms)
  layout.equipmentRoomId=rooms[0]?.id;layout.panelRoomId=roofs.at(-1)?.id
  layout.roomNames=Object.fromEntries(rooms.map((room,i)=>[room.id,i===0?'Equipment room':`Practice room ${i+1}`]))
  return layout
}

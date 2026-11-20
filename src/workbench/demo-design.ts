import {acInputOptions,uid,type ACInput,type Requirements} from './model'
import type {BuildingLayout,FloorPlan,PlanPoint} from './building-model'
import {addPlanWall,buildingRooms,pointInPolygon} from './building-plan'

/** Generate one coherent house with shared stairs and a freshly sized client brief. */
export function randomDemoRequirements(random:()=>number=Math.random,acInput?:ACInput):Requirements {
  const width=12+Math.round(random()*60)/10,depth=9+Math.round(random()*50)/10
  const floorCount=1+Math.floor(random()*3),hallX=width/2-3.2
  const building:BuildingLayout={id:uid('building'),floors:[],floorHeight:(27+Math.round(random()*4))/10,wallThickness:.18,roofShape:(['flat','gable','hip','shed'] as const)[Math.floor(random()*4)],roofPitch:12+Math.floor(random()*24),northBearing:Math.floor(random()*360),solarHemisphere:'south',roomNames:{},stairs:[]}
  const notchWidth=1+random()*2,notchDepth=1+random()*2,hasNotch=random()>.4
  for(let level=0;level<floorCount;level++){
    let floor:FloorPlan={id:uid('floor'),nodes:[],walls:[]}
    const outline:PlanPoint[]=hasNotch?[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2+notchWidth,depth/2],[-width/2+notchWidth,depth/2-notchDepth],[-width/2,depth/2-notchDepth]]:[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]]
    for(let i=0;i<outline.length;i++)floor=addPlanWall(floor,outline[i],outline[(i+1)%outline.length])
    floor=addPlanWall(floor,[hallX,-depth/2],[hallX,depth/2])
    const divider=-depth*.18+random()*depth*.22
    floor=addPlanWall(floor,[-width/2,divider],[hallX,divider])
    floor.walls=floor.walls.map(w=>{
      const a=floor.nodes.find(n=>n.id===w.a)!.point,b=floor.nodes.find(n=>n.id===w.b)!.point
      const entrance=level===0&&a[1]===-depth/2&&b[1]===-depth/2&&Math.min(a[0],b[0])>=hallX
      return {...w,door:entrance||a[0]===hallX&&b[0]===hallX||a[1]===divider&&b[1]===divider}
    })
    building.floors.push(floor)
    if(level<floorCount-1)building.stairs!.push({floor:level,position:[hallX+1.25,0],width:1.15,run:4.4})
  }
  const rooms=buildingRooms(building),equipmentFloor=Math.floor(random()*floorCount)
  const equipmentRoom=rooms.filter(room=>room.floor===equipmentFloor&&!pointInPolygon([hallX+1,0],room.polygon)).sort((a,b)=>b.area-a.area)[0]
  building.equipmentRoomId=equipmentRoom?.id
  building.roomNames=Object.fromEntries(rooms.map(room=>[room.id,pointInPolygon([hallX+1,0],room.polygon)?`Floor ${room.floor+1} ${floorCount>1?'stair hall':'entrance hall'}`:room.id===equipmentRoom?.id?'Utility room':`Floor ${room.floor+1} living space`]))
  const dailyKwh=4+Math.round(random()*60)/10
  return {context:'home',region:'ZA',dailyKwh,peakW:1200+Math.floor(random()*18)*100,autonomyHours:4+Math.floor(random()*9),sunHours:4.2+Math.round(random()*10)/10,reserve:15+Math.floor(random()*16),priority:'cost',phases:'single',building,acInput:acInput??acInputOptions[Math.floor(random()*acInputOptions.length)]}
}

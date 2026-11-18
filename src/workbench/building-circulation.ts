import type {BuildingLayout,PlanPoint,PlanRoom} from './building-model'
import {buildingRooms,planDistance} from './building-plan'
import {roomInterior} from './building-geometry'
import {rectangleFits} from './surface-domain'

export function roomFitsOpening(room:PlanRoom,position:PlanPoint,width:number,depth:number):boolean {
  return rectangleFits({id:'room',name:room.name,kind:'floor',position:[0,0,0],rotation:[0,0,0],size:[1,1,.1],color:'#fff',polygons:[room.polygon]},{x:position[0],y:position[1],width:width+.2,height:depth+.2})
}

export function autoCirculation(input:BuildingLayout):BuildingLayout {
  const layout=structuredClone(input),rooms=buildingRooms(layout)
  layout.floors=layout.floors.map(floor=>({...floor,walls:floor.walls.map(wall=>({...wall,door:wall.door||!wall.control&&planDistance(floor.nodes.find(n=>n.id===wall.a)!.point,floor.nodes.find(n=>n.id===wall.b)!.point)>1.6&&rooms.filter(room=>room.walls.includes(wall.id)).length===2}))}))
  layout.stairs??=[]
  for(let floor=0;floor<layout.floors.length-1;floor++){
    if(layout.stairs.some(stairs=>stairs.floor===floor))continue
    const below=rooms.filter(room=>room.floor===floor),above=rooms.filter(room=>room.floor===floor+1)
    let position:PlanPoint|undefined
    for(const room of below){
      const xs=room.polygon.map(p=>p[0]),zs=room.polygon.map(p=>p[1]),candidates=[roomInterior(room)]
      for(let x=Math.min(...xs)+.7;x<Math.max(...xs)-.7;x+=.5)for(let z=Math.min(...zs)+2.3;z<Math.max(...zs)-2.3;z+=.5)candidates.push([x,z])
      position=candidates.find(p=>roomFitsOpening(room,p,1.1,4.4)&&above.some(upper=>roomFitsOpening(upper,p,1.1,4.4)))
      if(position)break
    }
    if(!position)throw new Error(`Floors ${floor+1} and ${floor+2} need overlapping room space for stairs, at least 1.3 m wide and 4.6 m long. Place stairs manually or enlarge their shared area.`)
    layout.stairs.push({floor,position,width:1.1,run:4.4})
  }
  return layout
}

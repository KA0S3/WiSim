import { Vector3 } from 'three/src/math/Vector3.js'
import type { BuildingLayout, PlanPoint } from './building-model'
import { validBuilding } from './building-model'
import { buildingRooms, pointInPolygon } from './building-plan'
import { availableRoofRooms, buildingStructures } from './building-geometry'
import { mountDevice, orientation, resolveMounts } from './spatial'
import { synchronizeLengths } from './geometry'
import { previewSupportedRoute } from './surface-routing'
import {facing} from './solar'
import {rectangleFits} from './surface-domain'
import type { Device, Mount, Project, Structure } from './model'

type Rectangle={x:number;y:number;width:number;height:number}
const overlap=(a:Rectangle,b:Rectangle)=>Math.abs(a.x-b.x)<(a.width+b.width)/2+.05&&Math.abs(a.y-b.y)<(a.height+b.height)/2+.05

function findSpace(surface:Structure,width:number,height:number,occupied:Rectangle[],compact=false):Rectangle|null {
  if(width+.1>surface.size[0]||height+.1>surface.size[1])return null
  const step=.1
  const candidates:Rectangle[]=[],left=-surface.size[0]/2+width/2+.05,bottom=-surface.size[1]/2+height/2+.05
  for(let y=bottom;y<=surface.size[1]/2-height/2-.05+1e-8;y+=step)for(let x=left;x<=surface.size[0]/2-width/2-.05+1e-8;x+=step)candidates.push({x,y,width,height})
  if(compact)candidates.sort((a,b)=>Math.hypot(a.x-left,a.y-bottom)-Math.hypot(b.x-left,b.y-bottom))
  for(const rectangle of candidates){
    if(!occupied.some(other=>overlap(rectangle,other))&&rectangleFits(surface,rectangle))return rectangle
  }
  return null
}

export function applyBuilding(input:Project,layout:BuildingLayout,refit:boolean):Project {
  if(!validBuilding(layout))throw new Error('The building layout has invalid walls, floors or roof settings.')
  const rooms=buildingRooms(layout),roofs=availableRoofRooms(layout,rooms)
  const defaultEquipmentRoom=rooms.find(room=>room.id===layout.equipmentRoomId)??(rooms.length===1?rooms[0]:undefined)
  const panelRoom=roofs.find(room=>room.id===layout.panelRoomId)??(roofs.length===1?roofs[0]:undefined)
  if(refit&&input.devices.some(d=>d.kind!=='pv')&&!defaultEquipmentRoom&& !layout.equipmentPlacements)throw new Error('Choose the room for indoor equipment before refitting.')
  if(layout.panelRoomId&&!panelRoom)throw new Error('The selected panel roof no longer exists. Choose a roof or use automatic selection.')
  for(const [kind,preference] of Object.entries(layout.equipmentPlacements??{})){
    const room=rooms.find(r=>r.id===preference.roomId)
    if(!room||preference.wallId&&!room.walls.includes(preference.wallId))throw new Error(`Choose a valid room and wall for ${kind}; its saved placement no longer exists.`)
  }
  const resolved=resolveMounts(input),oldIds=new Set(resolved.structures?.filter(s=>s.building).map(s=>s.id))
  let project:Project={...resolved,building:structuredClone(layout),fitIssues:[],structures:[...(resolved.structures??[]).filter(s=>!s.building),...buildingStructures(layout)],devices:resolved.devices.map(d=>oldIds.has(d.mount?.structureId??'')?{...d,mount:undefined}:d)}
  if((project.structures?.length??0)>5000)throw new Error('This workspace exceeds the 5000-surface capacity.')
  if(!refit)return synchronizeLengths(project)
  const occupied=new Map<string,Rectangle[]>(),issues:string[]=[]
  const attach=(device:Device,surface:Structure,face:Mount['face'],space:Rectangle,landscape=false)=>{
    project=mountDevice(project,device.id,surface.id,face)
    project={...project,devices:project.devices.map(d=>d.id===device.id?{...d,mount:{...d.mount!,offset:[space.x,space.y,.03],rotation:face==='back'?[0,Math.PI,0]:landscape?[0,0,Math.PI/2]:[0,0,0]}}:d)}
    const key=`${surface.id}-${face}`;occupied.set(key,[...(occupied.get(key)??[]),space])
  }
  for(const device of [...project.devices].sort((a,b)=>b.spec.width*b.spec.height-a.spec.width*a.spec.height)){
    let placed=false
    const preference=layout.equipmentPlacements?.[device.id]??layout.equipmentPlacements?.[`appliance:${device.applianceId}`]??layout.equipmentPlacements?.[device.kind],equipmentRoom=rooms.find(r=>r.id===preference?.roomId)??defaultEquipmentRoom
    if(device.kind==='pv'){
      const candidates=project.structures!.filter(s=>s.kind==='roof'&&(!panelRoom||s.building?.roomId===panelRoom.id)).sort((a,b)=>{
        const desired=((layout.northBearing??0)+((layout.solarHemisphere??(input.requirements?.region==='GB'||input.requirements?.region==='US'?'north':'south'))==='north'?180:0))*Math.PI/180
        const score=(s:Structure)=>{const f=facing(s.rotation);return Math.sin(f.tilt*Math.PI/180)*Math.cos(f.azimuth*Math.PI/180-desired)}
        return score(b)-score(a)||b.size[0]*b.size[1]-a.size[0]*a.size[1]
      })
      for(const surface of candidates){
        for(const landscape of [false,true]){
          const space=findSpace(surface,landscape?device.spec.height:device.spec.width,landscape?device.spec.width:device.spec.height,occupied.get(`${surface.id}-front`)??[])
          if(space){attach(device,surface,'front',space,landscape);placed=true;break}
        }
        if(placed)break
      }
    }else if(equipmentRoom){
      const candidates=project.structures!.filter(s=>s.kind==='wall'&&s.building?.floor===equipmentRoom.floor&&equipmentRoom.walls.includes(s.building.wallId??'')&&(!preference?.wallId||s.building.wallId===preference.wallId)).sort((a,b)=>b.size[0]-a.size[0])
      for(const surface of candidates){
        const normal=new Vector3(0,0,1).applyQuaternion(orientation(surface.rotation)),point:PlanPoint=[surface.position[0]+normal.x*.1,surface.position[2]+normal.z*.1]
        const face:Mount['face']=pointInPolygon(point,equipmentRoom.polygon)?'front':'back'
        const space=findSpace(surface,device.spec.width+.15,device.spec.height+.2,occupied.get(`${surface.id}-${face}`)??[],true)
        if(space){attach(device,surface,face,space);placed=true;break}
      }
      if(!placed&&!preference?.wallId){
        const floor=project.structures!.find(s=>s.kind==='floor'&&s.building?.roomId===equipmentRoom.id)!
        const space=device.spec.height<layout.floorHeight-.15?findSpace(floor,device.spec.width+.15,device.spec.depth+.15,occupied.get(`${floor.id}-front`)??[]):null
        if(space){
          const position=new Vector3(space.x,space.y,0).applyQuaternion(orientation(floor.rotation)).add(new Vector3(...floor.position))
          project={...project,devices:project.devices.map(d=>d.id===device.id?{...d,mount:undefined,rotation:[0,0,0],physical:[position.x,floor.position[1]+.06,position.z]}:d)}
          occupied.set(`${floor.id}-front`,[...(occupied.get(`${floor.id}-front`)??[]),space]);placed=true
        }
      }
    }
    if(!placed)issues.push(`${device.name} could not fit in the selected ${device.kind==='pv'?'roof':'room'}. Its previous world placement is retained.`)
  }
  project=synchronizeLengths(project)
  for(const wire of project.wires){
    try{project=previewSupportedRoute(project,wire.id)}catch(cause){issues.push(`${wire.reference??wire.id} needs a supported route. ${cause instanceof Error?cause.message:String(cause)}`)}
  }
  return synchronizeLengths({...project,fitIssues:issues})
}

import type {Project} from './model'

const floorDuration=3.7
export const constructionDuration=8.2
export function constructionTotal(floors=1):number {return Math.max(1,floors)*floorDuration+4.5}
export function constructionDelay(kind:string,index=0,floor=0,floors=1):number {
  const base=floor*floorDuration
  if(kind==='wall')return base+Math.min(.6,index*.065)
  if(kind==='floor')return base+1.35+Math.min(.25,index*.025)
  if(kind==='roof')return floors*floorDuration+.1+Math.min(.4,index*.07)
  if(kind==='pv')return floors*floorDuration+1.5+Math.min(.7,index*.07)
  if(kind==='wire')return floors*floorDuration+3.2
  return base+2.15+Math.min(.6,index*.07)
}
export function constructionProgress(elapsed:number,delay:number):number {
  const fraction=Math.max(0,Math.min(1,(elapsed-delay)/1.05))
  return 1-(1-fraction)**3
}
export function constructionStage(elapsed:number,floors=1):string {
  if(elapsed<floors*floorDuration){
    const floor=Math.floor(elapsed/floorDuration),time=elapsed%floorDuration,suffix=floors>1?` / floor ${floor+1}`:''
    if(time<1.35)return 'Building walls'+suffix
    if(time<2.15)return 'Placing floors and stairs'+suffix
    return 'Fitting indoor equipment'+suffix
  }
  if(elapsed<floors*floorDuration+1.5)return 'Building roofs'
  if(elapsed<floors*floorDuration+3.2)return 'Mounting solar panels'
  return 'Connecting the system'
}

export function constructionSchedule(project:Project):Map<string,number> {
  const delays=new Map<string,number>(),counts=new Map<string,number>(),floors=project.building?.floors.length??1
  const next=(kind:string,floor:number)=>{
    const key=`${kind}-${floor}`,index=counts.get(key)??0
    counts.set(key,index+1)
    return constructionDelay(kind,index,floor,floors)
  }
  for(const surface of project.structures??[])delays.set(surface.id,next(surface.building?.stage??surface.kind,surface.building?.floor??0))
  for(const device of project.devices){
    const parent=project.structures?.find(s=>s.id===device.mount?.structureId)
    const floor=parent?.building?.floor??Math.max(0,Math.min(floors-1,Math.floor(device.physical[1]/(project.building?.floorHeight??2.8))))
    delays.set(device.id,next(device.kind==='pv'?'pv':'equipment',floor))
  }
  return delays
}

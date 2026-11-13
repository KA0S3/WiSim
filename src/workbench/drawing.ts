import { buildOrthogonalRoute, findCollinearOverlaps, type RoutePoint,type RouteSegment } from '../routing'
import type { Project } from './model'

export function diagramRoutes(project: Project) {
  const terminal = (id: string, portId: string): RoutePoint => {
    const d = project.devices.find(d=>d.id===id)!,p=d.ports.find(p=>p.id===portId)!
    return { x:d.x+(p.side==='left'?0:p.side==='right'?210:p.offset*210), y:d.y+(p.side==='top'?0:p.side==='bottom'?180:p.offset*180) }
  }
  const routed:Array<{wire:Project['wires'][number];points:RoutePoint[];segments:RouteSegment[];blocked:boolean}>=[]
  for(const [index,wire]of project.wires.entries()){
    const ends=(w:typeof wire)=>[`${w.from}:${w.fromPort}`,`${w.to}:${w.toPort}`]
    const unrelated=routed.filter(r=>!ends(wire).some(t=>ends(r.wire).includes(t)))
    let result:typeof routed[number]|undefined
    // Reuse spatially clear lanes rather than expanding every obstacle without
    // bound as wire count grows. Keep unrelated collinear runs distinguishable.
    const candidates=[16+index*4,...Array.from({length:64},(_,i)=>12+i*4)]
    for(const clearance of new Set(candidates)){
    // Separate lanes around equipment avoid collinear false junctions.
    const escape=clearance+14
    const stub=(point:RoutePoint,id:string,portId:string)=>{
      const side=project.devices.find(d=>d.id===id)!.ports.find(p=>p.id===portId)!.side
      return {x:point.x+(side==='left'?-escape:side==='right'?escape:0),y:point.y+(side==='top'?-escape:side==='bottom'?escape:0)}
    }
    const a=terminal(wire.from,wire.fromPort),b=terminal(wire.to,wire.toPort)
    const obstacles=project.devices.map(d=>({left:d.x-clearance,top:d.y-clearance,right:d.x+210+clearance,bottom:d.y+180+clearance}))
    const middle=buildOrthogonalRoute(stub(a,wire.from,wire.fromPort),stub(b,wire.to,wire.toPort),[],obstacles)
    const points=[a,...middle.points,b]
    const segments=points.slice(1).map((to,i)=>({from:points[i],to})),conflict=unrelated.some(r=>findCollinearOverlaps(segments,r.segments).length)
    result={wire,points,segments,blocked:middle.blocked||conflict}
    if(!result.blocked)break
    }
    routed.push(result!)
  }
  return routed
}

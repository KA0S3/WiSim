import type { Device, Project, Wire } from './model'
import { deviceCenter, transformPoint, resolveMounts, moveDeviceInSpace } from './spatial'
import {ensureReferences} from './references'
import {cleanGroups} from './equipment-groups'
import {refreshSupportedRoutes} from './surface-routing'

export type Point3 = [number, number, number]
export function localTerminalPosition(device: Device, portId: string): Point3 {
  const port=device.ports.find(p=>p.id===portId)
  if(!port)throw new Error(`Unknown terminal ${device.id}:${portId}`)
  const s=device.spec
  if(port.anchor)return [port.anchor[0]*s.width,port.anchor[1]*s.height,port.anchor[2]*s.depth]
  return [(port.side==='left'?-.5:port.side==='right'?.5:port.offset-.5)*s.width,
    (port.side==='top'?s.height:port.side==='bottom'?0:s.height*(1-port.offset))-s.height/2,
    s.depth/2+.025]
}
export function terminalPosition(device: Device, portId: string): Point3 {
  return transformPoint(localTerminalPosition(device,portId),deviceCenter(device),device.rotation)
}
export function physicalWirePoints(project: Project, wire: Wire): Point3[] {
  const a=project.devices.find(d=>d.id===wire.from),b=project.devices.find(d=>d.id===wire.to)
  if(!a||!b)throw new Error(`Missing equipment for conductor ${wire.id}`)
  return [terminalPosition(a,wire.fromPort),...(wire.route3d??[]),terminalPosition(b,wire.toPort)]
}
export function routeLength(points: Point3[]): number {
  return points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1],p[2]-points[i][2]),0)
}
export function synchronizeLengths(project: Project): Project {
  project=ensureReferences(refreshSupportedRoutes(resolveMounts(project)))
  return {...project,groups:cleanGroups(project),wires:project.wires.map(w=>w.lengthMode==='physical'&&!w.autoRoute?.error?{...w,length:routeLength(physicalWirePoints(project,w))+(w.slack??0)}:w)}
}
export function moveEquipment(project: Project,id:string,position:Point3):Project {
  if(!position.every(Number.isFinite))throw new Error('Equipment coordinates must be finite')
  return synchronizeLengths(moveDeviceInSpace(project,id,[...position] as Point3))
}

export function setWireRoute(project: Project, id: string, route: Point3[]): Project {
  if (route.some(point => point.length !== 3 || !point.every(Number.isFinite))) throw new Error('Route coordinates must be finite')
  return synchronizeLengths({...project,wires:project.wires.map(w=>w.id===id?{...w,lengthMode:'physical',autoRoute:undefined,route3d:route.map(p=>[...p] as Point3)}:w)})
}

export function insertWireBend(project: Project, id: string): Point3[] {
  const wire=project.wires.find(w=>w.id===id)
  if(!wire)throw new Error('Unknown conductor')
  const points=physicalWirePoints(project,wire)
  let longest=0
  for(let i=1;i<points.length-1;i++)if(routeLength(points.slice(i,i+2))>routeLength(points.slice(longest,longest+2)))longest=i
  const midpoint=points[longest].map((n,axis)=>(n+points[longest+1][axis])/2) as Point3
  const route=[...(wire.route3d??[])];route.splice(longest,0,midpoint)
  return route
}

import { Euler } from 'three/src/math/Euler.js'
import { Quaternion } from 'three/src/math/Quaternion.js'
import { Vector3 } from 'three/src/math/Vector3.js'
import { uid, type Device, type Project, type Structure, type StructureKind, type Triple, type Mount } from './model'

export const orientation=(rotation:Triple=[0,0,0])=>new Quaternion().setFromEuler(new Euler(...rotation,'XYZ'))
export const angles=(q:Quaternion):Triple=>{const e=new Euler().setFromQuaternion(q,'XYZ');return[e.x,e.y,e.z]}
export const deviceCenter=(d:Device):Triple=>[d.physical[0],d.physical[1]+d.spec.height/2+.025,d.physical[2]]
export function transformPoint(point:Triple,position:Triple,rotation:Triple=[0,0,0]):Triple {
  return new Vector3(...point).applyQuaternion(orientation(rotation)).add(new Vector3(...position)).toArray() as Triple
}
export const shellThickness=(s:Structure)=>Math.min(.02,...s.size.map(n=>n/4))
const backPlane=(s:Structure,face:Mount['face'])=>face==='inside'?-s.size[2]/2+shellThickness(s):face==='back'?-s.size[2]/2:s.size[2]/2
const mountSign=(d:Device)=>d.mount?.face==='back'?-1:1
export function mountingExtent(d:Device):number {
  const q=orientation(d.mount?.rotation)
  return Math.max(...[-.5,.5].flatMap(x=>[-.5,.5].flatMap(y=>[-.5,.5].map(z=>-mountSign(d)*new Vector3(x*d.spec.width,y*d.spec.height,z*d.spec.depth).applyQuaternion(q).z))))
}
export function resolveMounts(project:Project):Project {
  return {...project,devices:project.devices.map(d=>{
    const mount=d.mount,s=project.structures?.find(s=>s.id===mount?.structureId)
    if(!mount||!s)return d
    const center=transformPoint([mount.offset[0],mount.offset[1],backPlane(s,mount.face)+mountSign(d)*(mountingExtent(d)+mount.offset[2])],s.position,s.rotation)
    return {...d,physical:[center[0],center[1]-d.spec.height/2-.025,center[2]],rotation:angles(orientation(s.rotation).multiply(orientation(mount.rotation)))}
  })}
}
export function makeStructure(kind:StructureKind):Structure {
  const defaults:Record<StructureKind,{size:Triple;position:Triple;rotation:Triple;color:string}>={
    wall:{size:[4,2.4,.12],position:[0,1.2,-2],rotation:[0,0,0],color:'#d2d5cc'},
    roof:{size:[4,3,.08],position:[0,2,0],rotation:[-Math.PI/2,0,0],color:'#a2b4ba'},
    rail:{size:[2,.04,.04],position:[0,1,-1.5],rotation:[0,0,0],color:'#82939b'},
    box:{size:[1,1.4,.6],position:[0,.7,-1.5],rotation:[0,0,0],color:'#c3cbc6'},
    floor:{size:[4,3,.15],position:[0,0,0],rotation:[-Math.PI/2,0,0],color:'#d9c5a7'},
  }
  return {id:uid('structure'),kind,name:kind[0].toUpperCase()+kind.slice(1),...structuredClone(defaults[kind])}
}
export function mountDevice(project:Project,deviceId:string,structureId:string|null,face:Mount['face']='front'):Project {
  const resolved=resolveMounts(project),s=resolved.structures?.find(s=>s.id===structureId)
  if(structureId&&!s)throw new Error('Unknown mounting structure')
  if(face==='inside'&&s?.kind!=='box')throw new Error('Interior mounting requires an enclosure')
  if(face==='back'&&s?.kind!=='wall')throw new Error('Back mounting requires a wall')
  return resolveMounts({...resolved,devices:resolved.devices.map(d=>d.id===deviceId?{...d,mount:s?{structureId:s.id,face,offset:[0,0,.01],rotation:face==='back'?[0,Math.PI,0]:[0,0,0]}:undefined}:d)})
}
export function moveDeviceInSpace(project:Project,id:string,position:Triple):Project {
  const resolved=resolveMounts(project)
  return resolveMounts({...resolved,devices:resolved.devices.map(d=>{
    if(d.id!==id)return d
    const moved={...d,physical:position},s=resolved.structures?.find(s=>s.id===d.mount?.structureId)
    if(!d.mount||!s)return moved
    const local=new Vector3(...deviceCenter(moved)).sub(new Vector3(...s.position)).applyQuaternion(orientation(s.rotation).invert())
    return {...moved,mount:{...d.mount,offset:[local.x,local.y,mountSign(d)*(local.z-backPlane(s,d.mount.face))-mountingExtent(d)]}}
  })})
}
export function rotateDevice(project:Project,id:string,rotation:Triple):Project {
  if(!rotation.every(Number.isFinite))throw new Error('Rotation must be finite')
  return resolveMounts({...project,devices:project.devices.map(d=>{
    if(d.id!==id)return d
    const s=project.structures?.find(s=>s.id===d.mount?.structureId)
    return {...d,rotation,mount:d.mount&&s?{...d.mount,rotation:angles(orientation(s.rotation).invert().multiply(orientation(rotation)))}:d.mount}
  })})
}
export function updateStructure(project:Project,id:string,patch:Partial<Structure>):Project {
  return resolveMounts({...project,structures:project.structures?.map(s=>s.id===id?{...s,...patch,id:s.id}:s)})
}
export function removeStructure(project:Project,id:string):Project {
  const resolved=resolveMounts(project)
  return {...resolved,structures:resolved.structures?.filter(s=>s.id!==id),devices:resolved.devices.map(d=>d.mount?.structureId===id?{...d,mount:undefined}:d)}
}

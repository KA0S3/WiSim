import {uid,type Project,validateProject} from './model'
import {synchronizeLengths} from './geometry'
import {expandedSelection} from './equipment-groups'

export function selectionProject(project:Project,selection:string[],newSystem=false):Project{
 const ids=new Set(expandedSelection(project,selection)),devices=project.devices.filter(d=>ids.has(d.id)),chosen=new Set(devices.map(d=>d.id))
 const routeSupports=new Set(project.wires.filter(w=>chosen.has(w.from)&&chosen.has(w.to)).flatMap(w=>w.autoRoute?.supportIds??[]))
 const structures=project.structures?.filter(s=>devices.some(d=>d.mount?.structureId===s.id)||routeSupports.has(s.id))
 return synchronizeLengths({...project,id:newSystem?uid('project'):project.id,name:newSystem?project.name+' / selection':project.name,devices,wires:project.wires.filter(w=>chosen.has(w.from)&&chosen.has(w.to)),groups:project.groups?.filter(g=>g.members.every(id=>chosen.has(id))),structures:newSystem?structures:project.structures,requirements:undefined,designNotes:['Sandbox subset. External connections were not included; review open terminals and protection before use.']})
}
export function pasteSelection(project:Project,source:Project):{project:Project;addedIds:string[]}{
 if(!validateProject(source))throw Error('The copied equipment data is not a valid project.')
 if(project.devices.length+source.devices.length>500||project.wires.length+source.wires.length>2000||(project.structures?.length??0)+(source.structures?.length??0)>5000)throw Error('Pasting this selection would exceed the project size limit.')
 const remap=new Map([...source.devices,...source.wires,...source.structures??[],...source.groups??[]].map(d=>[d.id,uid('copy')]))
 const physicalShift=Math.max(0,...project.devices.map(d=>d.physical[0]+d.spec.width/2))+1-Math.min(0,...source.devices.map(d=>d.physical[0]-d.spec.width/2)),diagramShift=Math.max(0,...project.devices.map(d=>d.x))+340-Math.min(0,...source.devices.map(d=>d.x))
 const devices=source.devices.map(d=>({...structuredClone(d),id:remap.get(d.id)!,reference:undefined,x:d.x+diagramShift,physical:[d.physical[0]+physicalShift,d.physical[1],d.physical[2]] as [number,number,number],mount:d.mount?{...structuredClone(d.mount),structureId:remap.get(d.mount.structureId)!}:undefined}))
 const wires=source.wires.map(w=>({...structuredClone(w),id:remap.get(w.id)!,reference:undefined,from:remap.get(w.from)!,to:remap.get(w.to)!,autoRoute:w.autoRoute?{supportIds:w.autoRoute.supportIds.map(id=>remap.get(id)??id)}:undefined,route3d:w.route3d?.map(p=>[p[0]+physicalShift,p[1],p[2]] as [number,number,number])}))
 for(const d of devices)if(d.protection?.upstreamId)d.protection.upstreamId=remap.get(d.protection.upstreamId)
 for(const w of wires)if(w.installation?.protectionId)w.installation.protectionId=remap.get(w.installation.protectionId)
 const structures=source.structures?.map(s=>({...structuredClone(s),id:remap.get(s.id)!,reference:undefined,position:[s.position[0]+physicalShift,s.position[1],s.position[2]] as [number,number,number]}))
 const groups=source.groups?.map(g=>({...g,id:remap.get(g.id)!,members:g.members.map(id=>remap.get(id)!),x:g.x+diagramShift}))
 const hidden=new Set(groups?.filter(g=>g.collapsed).flatMap(g=>g.members))
 return {project:synchronizeLengths({...project,devices:[...project.devices,...devices],wires:[...project.wires,...wires],groups:[...project.groups??[],...groups??[]],structures:[...project.structures??[],...structures??[]]}),addedIds:[...devices.filter(d=>!hidden.has(d.id)).map(d=>d.id),...(groups?.filter(g=>g.collapsed).map(g=>g.id)??[])]}
}

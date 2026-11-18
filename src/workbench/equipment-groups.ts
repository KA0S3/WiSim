import {uid,type Device,type EquipmentGroup,type Frame,type Project} from './model'

export const groupSource=(g:EquipmentGroup)=>g.kind==='pv-array'?'pv':g.kind==='conversion-stack'?'inverter':'battery'
export const groupMemberSource=(g:EquipmentGroup,d:Device)=>g.kind==='conversion-stack'?['inverter','charger','mppt'].includes(d.kind):d.kind===groupSource(g)
/** Wiring topology only: passives are followed independent of their trip state. */
export function groupTopology(project:Project,g:EquipmentGroup):string{
 if(g.kind==='conversion-stack')return 'Individual AC/DC conversion paths / expand to inspect'
 const parent=new Map<string,string>(),root=(key:string):string=>{const p=parent.get(key);if(!p){parent.set(key,key);return key}if(p===key)return key;const r=root(p);parent.set(key,r);return r},join=(a:string,b:string)=>{const x=root(a),y=root(b);if(x!==y)parent.set(x,y)},key=(id:string,port:string)=>id+':'+port
 for(const w of project.wires)join(key(w.from,w.fromPort),key(w.to,w.toPort))
 for(const d of project.devices)if(['bus','fuse','switch'].includes(d.kind))for(const port of d.ports.slice(1))join(key(d.id,d.ports[0].id),key(d.id,port.id))
 const sources=project.devices.filter(d=>g.members.includes(d.id)&&groupMemberSource(g,d)),edges=sources.map(d=>({id:d.id,from:root(key(d.id,'n')),to:root(key(d.id,'p'))})),starts=[...new Set(edges.map(e=>e.from))].filter(n=>!edges.some(e=>e.to===n)),ends=[...new Set(edges.map(e=>e.to))].filter(n=>!edges.some(e=>e.from===n))
 const complex='Separate or complex branches / expand to inspect'
 if(starts.length!==1||ends.length!==1)return complex
 const paths:string[][]=[],covered=new Set<string>();let visits=0,invalid=false
 const visit=(node:string,path:string[])=>{if(++visits>10000){invalid=true;return}if(node===ends[0]){paths.push(path);path.forEach(id=>covered.add(id));return}for(const e of edges.filter(e=>e.from===node)){if(path.includes(e.id)){invalid=true;continue}visit(e.to,[...path,e.id])}}
 visit(starts[0],[])
 if(invalid||!paths.length||covered.size!==sources.length||new Set(paths.map(p=>p.length)).size!==1)return complex
 return `${paths.length} parallel ${g.kind==='pv-array'?'strings':'branches'} x ${paths[0].length} in series`
}
export function expandedSelection(project:Project,ids:string[]):string[]{
 return [...new Set(ids.flatMap(id=>project.groups?.find(g=>g.id===id)?.members??[id]))]
}
export function cleanGroups(project:Project):EquipmentGroup[]|undefined{
 return project.groups?.map(g=>({...g,members:g.members.filter(id=>project.devices.some(d=>d.id===id))})).filter(g=>g.members.length>=2&&g.members.some(id=>project.devices.some(d=>d.id===id&&groupMemberSource(g,d))))
}
export function createEquipmentGroup(project:Project,ids:string[],name?:string):Project{
 const chosen=new Set(expandedSelection(project,ids)),devices=project.devices.filter(d=>chosen.has(d.id)),sources=devices.filter(d=>['pv','battery','inverter','charger','mppt'].includes(d.kind)),kind=sources[0]?.kind,conversion=sources.length>0&&sources.every(d=>['inverter','charger','mppt'].includes(d.kind))
 if(sources.length<2||!conversion&&sources.some(d=>d.kind!==kind)||devices.some(d=>![...(conversion?['inverter','charger','mppt']:[kind]),'fuse','switch','bus'].includes(d.kind)))throw Error('Select two or more panels, batteries, or conversion devices, optionally with their fuses, isolators and busbars.')
 const members=devices.map(d=>d.id)
 if(project.groups?.some(g=>g.members.some(id=>chosen.has(id))))throw Error('Extract equipment from its existing group first.')
 const group:EquipmentGroup={id:uid('group'),name:name??(conversion?'Conversion stack':kind==='pv'?'PV array':'Battery bank'),kind:conversion?'conversion-stack':kind==='pv'?'pv-array':'battery-bank',members,collapsed:true,x:Math.min(...devices.map(d=>d.x)),y:Math.min(...devices.map(d=>d.y))}
 return {...project,groups:[...project.groups??[],group]}
}
export function setGroupCollapsed(project:Project,id:string,collapsed:boolean):Project{
 return {...project,groups:project.groups?.map(g=>g.id===id?{...g,collapsed,...(collapsed?{x:Math.min(...project.devices.filter(d=>g.members.includes(d.id)).map(d=>d.x)),y:Math.min(...project.devices.filter(d=>g.members.includes(d.id)).map(d=>d.y))}:{})}:g)}
}
export function moveDiagramItems(project:Project,positions:Record<string,{x:number;y:number}>):Project{
 const shifts=new Map<string,{x:number;y:number}>()
 for(const g of project.groups??[])if(g.collapsed&&positions[g.id])for(const id of g.members)shifts.set(id,{x:positions[g.id].x-g.x,y:positions[g.id].y-g.y})
 return {...project,groups:project.groups?.map(g=>positions[g.id]?{...g,...positions[g.id]}:g),devices:project.devices.map(d=>positions[d.id]?{...d,...positions[d.id]}:shifts.has(d.id)?{...d,x:d.x+shifts.get(d.id)!.x,y:d.y+shifts.get(d.id)!.y}:d)}
}
export const groupPort=(id:string,port:string)=>id+':'+port
export function schematicProjection(project:Project){
 const collapsed=project.groups?.filter(g=>g.collapsed)??[],owner=new Map(collapsed.flatMap(g=>g.members.map(id=>[id,g.id] as const))),targetMap:Record<string,string>={}
 for(const [id,group]of owner)targetMap[id]=group
 const wires=project.wires.flatMap(w=>{
  const a=owner.get(w.from),b=owner.get(w.to)
  if(a&&a===b){targetMap[w.id]=a;return []}
  return [{...w,from:a??w.from,to:b??w.to,fromPort:a?groupPort(w.from,w.fromPort):w.fromPort,toPort:b?groupPort(w.to,w.toPort):w.toPort}]
 })
 const groups=collapsed.map(g=>{
  const members=project.devices.filter(d=>g.members.includes(d.id)),sources=members.filter(d=>groupMemberSource(g,d)),ports=new Map<string,Device['ports'][number]>()
  const expose=(id:string,pid:string,side:'left'|'right'=g.kind==='pv-array'?'right':pid==='n'||pid.endsWith('-')?'left':'right')=>{const d=members.find(d=>d.id===id)!,port=d.ports.find(p=>p.id===pid)!;ports.set(groupPort(id,pid),{...port,id:groupPort(id,pid),label:(d.reference??d.name)+' / '+port.label,side})}
  for(const w of project.wires){if(owner.get(w.from)===g.id&&owner.get(w.to)!==g.id)expose(w.from,w.fromPort,'right');if(owner.get(w.to)===g.id&&owner.get(w.from)!==g.id)expose(w.to,w.toPort,'left')}
  // Every unconnected source terminal remains available; grouping cannot hide
  // an unwired unit or silently turn series strings into a parallel bank.
  for(const d of sources)for(const port of d.ports)if(!project.wires.some(w=>w.from===d.id&&w.fromPort===port.id||w.to===d.id&&w.toPort===port.id))expose(d.id,port.id)
  if(!ports.size&&sources[0])for(const port of sources[0].ports)expose(sources[0].id,port.id)
  const values=[...ports.values()],count=(side:string)=>values.filter(p=>p.side===side).length,height=Math.max(180,32*(Math.max(count('left'),count('right'))+1))
  for(const side of ['left','right']){const list=values.filter(p=>p.side===side);list.forEach((p,i)=>p.offset=(i+1)/(list.length+1))}
  // A display projection only. Never pass this representative to the solver,
  // physical workbench, export or catalogue matching.
  const device:Device={...sources[0],id:g.id,name:g.name,x:g.x,y:g.y,ports:values}
  return {group:g,device,height,sourceCount:sources.length}
 })
 return {project:{...project,devices:[...project.devices.filter(d=>!owner.has(d.id)),...groups.map(g=>g.device)],wires},groups,targetMap,owner}
}
export function groupReadings(project:Project,g:EquipmentGroup,frame:Frame|null){
 const sources=project.devices.filter(d=>g.members.includes(d.id)&&groupMemberSource(g,d)),readings=sources.map(d=>frame?.devices[d.id]),complete=readings.every(Boolean)&&!!sources.length
 return {count:sources.length,power:complete?readings.reduce((sum,r)=>sum+r!.power,0):undefined,minVoltage:complete?Math.min(...readings.map(r=>r!.voltage)):undefined,maxVoltage:complete?Math.max(...readings.map(r=>r!.voltage)):undefined,ratedWatts:sources.reduce((sum,d)=>sum+(d.kind==='battery'?d.spec.voltage*d.spec.capacityAh:d.kind==='charger'?(d.spec.chargeVoltage??d.spec.voltage)*d.spec.rating:d.spec.watts),0)}
}

/** Clone a complete series/protected branch, retaining its collector endpoints. */
export function duplicateGroupBranch(project:Project,groupId:string,sourceId?:string):Project{
 const g=project.groups?.find(g=>g.id===groupId)
 if(!g)throw Error('Choose an existing array or bank.')
 const members=project.devices.filter(d=>g.members.includes(d.id)),sources=members.filter(d=>groupMemberSource(g,d)),first=sources.find(d=>d.id===sourceId)??sources[0]
 if(!first)throw Error('This group contains no source equipment.')
 const allowed=new Set(members.filter(d=>d.kind!=='bus').map(d=>d.id)),branch=new Set([first.id]),queue=[first.id]
 for(let i=0;i<queue.length;i++)for(const w of project.wires){const other=w.from===queue[i]?w.to:w.to===queue[i]?w.from:null;if(other&&allowed.has(other)&&!branch.has(other)){branch.add(other);queue.push(other)}}
 // Parallel catalogue units can share a source terminal instead of a busbar.
 // Duplicate a leaf unit, not the hub with every other unit connected to it.
 if(branch.size===members.length&&sources.length>1){
  const leaf=sources.find(d=>{const links=project.wires.filter(w=>w.from===d.id||w.to===d.id);return links.length===2&&['p','n'].every(port=>links.some(w=>w.from===d.id&&w.fromPort===port&&sources.some(s=>s.id===w.to)&&w.toPort===port||w.to===d.id&&w.toPort===port&&sources.some(s=>s.id===w.from)&&w.fromPort===port))})
  if(leaf){branch.clear();branch.add(leaf.id)}
 }
 const links=project.wires.filter(w=>branch.has(w.from)||branch.has(w.to)),boundary=links.filter(w=>branch.has(w.from)!==branch.has(w.to))
 if(boundary.length!==2)throw Error('Automatic branch duplication needs exactly two collector connections. Expand this group and wire additional units explicitly.')
 if(project.devices.length+branch.size>500||project.wires.length+links.length>2000)throw Error('Adding this branch would exceed the interactive project limit.')
 const remap=new Map([...branch].map(id=>[id,uid('unit')])),span=Math.max(...members.map(d=>d.physical[0]+d.spec.width/2))-Math.min(...members.map(d=>d.physical[0]-d.spec.width/2))+.3
 const devices=members.filter(d=>branch.has(d.id)).map(d=>({...structuredClone(d),id:remap.get(d.id)!,reference:undefined,name:d.name+' / added branch',x:d.x+300,y:d.y+250,physical:[d.physical[0]+span,d.physical[1],d.physical[2]] as Device['physical'],mount:d.mount?{...structuredClone(d.mount),offset:[d.mount.offset[0]+span,d.mount.offset[1],d.mount.offset[2]] as Device['physical']}:undefined}))
 const wires=links.map(w=>({...structuredClone(w),id:uid('wire'),reference:undefined,from:remap.get(w.from)??w.from,to:remap.get(w.to)??w.to,route3d:undefined,autoRoute:undefined,lengthMode:'physical' as const,slack:w.lengthMode==='physical'?w.slack:0}))
 return {...project,devices:[...project.devices,...devices],wires:[...project.wires,...wires],groups:project.groups?.map(old=>old.id===g.id?{...old,members:[...old.members,...devices.map(d=>d.id)]}:old),designNotes:[...project.designNotes??[],'A source branch was duplicated in the sandbox. Review branch protection, sharing, conductor sizing, collector/controller current limits, mounting and product parallel-operation limits.']}
}

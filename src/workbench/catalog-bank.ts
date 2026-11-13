import type {CatalogRecord} from '../catalog'
import {applyCatalogRecord} from './catalog-device'
import {connect,uid,type Project,type Device} from './model'
import {synchronizeLengths} from './geometry'
import {createEquipmentGroup} from './equipment-groups'

export function applyProductSelection(project:Project,id:string,record:CatalogRecord,quantity=1):Project{
 const original=project.devices.find(d=>d.id===id)
 if(!original||record.status!=='verified'||record.kind!==original.kind)throw Error('Choose a verified product of the selected equipment type.')
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>16)throw Error('Choose between 1 and 16 individual units.')
 if(quantity>1&&!['pv','battery'].includes(original.kind))throw Error('Parallel-unit replacement currently supports panels and batteries only.')
 if(project.devices.length+quantity-1>500||project.wires.length+2*(quantity-1)>2000)throw Error('This bank would exceed the current project size limit.')
 const first=applyCatalogRecord(original,record),devices:Device[]=[first]
 for(let i=1;i<quantity;i++){
  const d=structuredClone(first);d.id=uid(d.kind);delete d.reference;d.name=`${record.name} / unit ${i+1} of ${quantity}`;d.x+=i*280
  d.physical=[d.physical[0]+i*(d.spec.width+.15),d.physical[1],d.physical[2]]
  if(d.mount)d.mount.offset[0]+=i*(d.spec.width+.15)
  devices.push(d)
 }
 if(quantity>1)first.name=`${record.name} / unit 1 of ${quantity}`
 const wires=devices.slice(1).flatMap(d=>['p','n'].map(port=>({...connect(first,port,d,port,16,0),lengthMode:'physical' as const})))
 let next:Project={...project,devices:[...project.devices.map(d=>d.id===id?first:d),...devices.slice(1)],wires:[...project.wires,...wires]}
 if(quantity>1){const existing=next.groups?.find(g=>g.members.includes(id));next=existing?{...next,groups:next.groups?.map(g=>g.id===existing.id?{...g,members:[...g.members,...devices.slice(1).map(d=>d.id)]}:g)}:createEquipmentGroup(next,devices.map(d=>d.id),quantity+' x '+record.name)}
 return synchronizeLengths(next)
}

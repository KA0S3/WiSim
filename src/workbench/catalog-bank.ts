import type {CatalogRecord} from '../catalog'
import {applyCatalogRecord} from './catalog-device'
import {connect,uid,type Project,type Device} from './model'
import {synchronizeLengths} from './geometry'
import {createEquipmentGroup} from './equipment-groups'
import {simulationReady,catalogKind} from './catalog-readiness'
import {sourceArrangement} from './bank-arrangement'

export function applyProductSelection(project:Project,id:string,record:CatalogRecord,quantity=1):Project{
 const original=project.devices.find(d=>d.id===id)
 if(!original||!simulationReady(record)||catalogKind(record)!==original.kind)throw Error('Choose a simulation-ready product of the selected equipment type.')
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

export function bankProductPlan(project:Project,id:string,record:CatalogRecord){
 const arrangement=sourceArrangement(project,id)
 if(!simulationReady(record)||catalogKind(record)!==arrangement.kind)throw Error('Choose a complete product of the same source type.')
 const voltage=arrangement.kind==='battery'?record.voltage!:record.moduleVmp!,series=Math.round(arrangement.voltage/voltage)
 if(series<1||series>100||Math.abs(series*voltage/arrangement.voltage-1)>.1)throw Error(`No whole-unit series arrangement preserves the ${arrangement.voltage.toFixed(1)} V operating class within 10%.`)
 const limits=record.simulation?.batteryLimits
 if(limits?.maxSeries&&series>limits.maxSeries)throw Error(`This battery permits at most ${limits.maxSeries} series units; ${series} would be required.`)
 if(limits?.maxParallel&&arrangement.parallel>limits.maxParallel||record.id.startsWith('victron-lithium-smart-')&&series*arrangement.parallel>20)throw Error('The proposed bank exceeds the sourced product configuration limit.')
 return {...arrangement,newSeries:series,units:series*arrangement.parallel,newVoltage:series*voltage,newEnergyWh:series*arrangement.parallel*voltage*(record.capacityAh??0),newWatts:series*arrangement.parallel*(record.power??0)}
}

/** Replace complete clear strings, preserving collector wiring/protection and reusable identities. */
export function applyBankProduct(project:Project,id:string,record:CatalogRecord):Project{
 const plan=bankProductPlan(project,id,record),next=structuredClone(project),oldIds=plan.ids,newIds:string[]=[],removed=new Set<string>(),replacements=new Map<string,Device>(),newLinks:Project['wires']=[],rewire=new Map<string,{positive:string;negative:string}>()
 for(const [branchIndex,branch]of plan.branches.entries()){
  const physicalSpan=branch.reduce((sum,d)=>sum+d.spec.width+.15,0),first=branch[0],units:Device[]=[]
  for(let i=0;i<plan.newSeries;i++){
   const old=branch[i],seed=old??{...structuredClone(first),id:uid(first.kind),reference:undefined,x:first.x+i*280,y:first.y,physical:[first.physical[0]+physicalSpan+(i-branch.length)*(record.simulation!.dimensions[0]+.15),first.physical[1],first.physical[2]] as Device['physical'],mount:undefined}
   const unit=applyCatalogRecord(seed,record);unit.name=`${record.name} / branch ${branchIndex+1}, unit ${i+1} of ${plan.newSeries}`;units.push(unit);replacements.set(unit.id,unit);newIds.push(unit.id)
  }
  branch.slice(plan.newSeries).forEach(d=>removed.add(d.id))
  for(const old of branch)rewire.set(old.id,{negative:units[0].id,positive:units.at(-1)!.id})
  const internal=next.wires.filter(w=>branch.some(d=>d.id===w.from)&&branch.some(d=>d.id===w.to)&&w.fromPort!==w.toPort)
  for(let i=0;i<units.length-1;i++){const original=internal[i],w=original?{...original,from:units[i].id,fromPort:'p',to:units[i+1].id,toPort:'n',route3d:undefined,autoRoute:undefined}:connect(units[i],'p',units[i+1],'n',project.wires.find(w=>w.from===first.id||w.to===first.id)?.area??16,0);w.lengthMode='physical';newLinks.push(w)}
 }
 const wires=next.wires.filter(w=>!(oldIds.has(w.from)&&oldIds.has(w.to))).map(w=>{
  const copy={...w}
  for(const end of ['from','to'] as const)if(oldIds.has(w[end])){const port=w[end==='from'?'fromPort':'toPort'],node=plan.node(w[end],port);if(port==='pe'){if(removed.has(w[end]))copy[end]=rewire.get(w[end])!.negative;continue}if(node!==plan.high&&node!==plan.low)throw Error('A source midpoint has an external tap. Rewire that tapped circuit explicitly before replacement.');copy[end]=node===plan.high?rewire.get(w[end])!.positive:rewire.get(w[end])!.negative;copy.autoRoute=undefined;copy.route3d=undefined}
  return copy
 })
 // Direct parallel links are rebuilt at the preserved end terminals.
 const parallel=next.wires.filter(w=>oldIds.has(w.from)&&oldIds.has(w.to)&&w.fromPort===w.toPort)
 for(const w of parallel){const port=w.fromPort;if(!['p','n','pe'].includes(port))continue;const from=rewire.get(w.from)!,to=rewire.get(w.to)!;const a=port==='p'?from.positive:from.negative,b=port==='p'?to.positive:to.negative;if(a!==b)wires.push({...w,from:a,to:b,route3d:undefined,autoRoute:undefined})}
 next.devices=[...next.devices.filter(d=>!oldIds.has(d.id)),...replacements.values()];next.wires=[...wires,...newLinks]
 const owners=next.groups?.filter(g=>g.members.some(m=>oldIds.has(m)))??[],owner=owners.find(g=>g.members.includes(id))??owners[0],ownerIds=new Set(owners.map(g=>g.id))
 next.groups=next.groups?.filter(g=>!ownerIds.has(g.id))
 if(owner){const members=[...new Set([...owners.flatMap(g=>g.members).filter(m=>!oldIds.has(m)),...newIds])];if(members.length>1)next.groups=[...next.groups??[],{...owner,members}]}
 if(next.devices.length>500||next.wires.length>2000)throw Error('The replacement exceeds the project capacity.')
 if(!next.groups?.some(g=>newIds.some(id=>g.members.includes(id)))&&newIds.length>1){const grouped=createEquipmentGroup(next,newIds,record.name+' bank');next.groups=grouped.groups}
 for(const w of next.wires)for(const end of ['from','to'] as const)if(newIds.includes(w[end])&&w.terminations?.[end]){const previous=w.terminations[end]!;w.terminations[end]={hardwareId:previous.hardwareId,cableDiameterMm:previous.cableDiameterMm,conductorClass:previous.conductorClass}}
 if(next.building)next.fitIssues=[...next.fitIssues??[],'Catalogue bank replacement changed equipment dimensions/count. Open Design home/compartment and refit equipment to recheck mounting, roof area and supported routes.']
 next.designNotes=[...next.designNotes??[],`Whole ${plan.kind==='battery'?'bank':'array'} replacement: ${plan.newSeries} series × ${plan.parallel} parallel. Existing collector/protection ratings retained; review current, capacity, hardware, mounting and routes. External BMS control must be configured for the selected product.`]
 return synchronizeLengths(next)
}

import {definitions,type Device,type Project} from './model'
import {synchronizeLengths} from './geometry'
import {ampacity} from './ampacity'
import {engineeringSummary} from './engineering'
import {terminationAssessment} from './terminations'

export const csvCell=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`
export function equipmentSpecification(d:Device):string{
 const s=d.spec
 switch(d.kind){
  case 'pv':return `${s.watts} W; Vop ${s.voltage} V; Voc ${s.voc} V; Isc ${s.isc} A`
  case 'battery':return `${s.voltage} V; ${s.capacityAh} Ah; ${s.voltage*s.capacityAh/1000} kWh; ${s.rating} A configured limit`
  case 'inverter':return `${s.watts} W; ${s.rating} W surge; ${s.voltage} V / ${s.frequency} Hz output; ${s.phaseDegrees??0} deg phase; ${s.cutoff} V DC cutoff`
  case 'mppt':return `${s.rating} A output; ${s.chargeVoltage??60} V charge target; ${s.voc} V PV limit; ${s.watts} W input assumption`
  case 'charger':return `${s.voltage} V AC; ${s.chargeVoltage??14.4} V charge target; ${s.rating} A output`
  case 'fuse':return `${s.rating} A generic protection; manufacturer curve/interrupt rating unspecified`
  case 'bus':return 'Single-potential distribution junction; hardware current/terminal ratings unspecified'
  case 'load':case 'dc-load':case 'motor':return `${s.voltage} V; ${s.watts} W${d.kind==='motor'?`; ${s.surge} x startup for ${s.startupSeconds} s`:''}`
  case 'capacitor':return `${s.capacitance} F; ${s.voltage} V configured rating`
  case 'inductor':return `${s.inductance} H; ${s.resistance} ohm`
  case 'resistor':case 'switch':return `${s.resistance} ohm`
  case 'generator':return `${s.voltage} V; ${s.frequency} Hz; ${s.rating} VA`
  case 'grid':case 'three-phase':return `${s.voltage} V phase-neutral; ${s.frequency} Hz`
  default:return definitions[d.kind].description
 }
}
export function exportData(input:Project){
 const project=synchronizeLengths(input),deviceById=new Map(project.devices.map(d=>[d.id,d]))
 const endpoint=(id:string,portId:string)=>{const d=deviceById.get(id)!;return `${d.reference}.${portId} (${d.name} / ${d.ports.find(p=>p.id===portId)!.label})`}
 const connections=project.wires.map(w=>({reference:w.reference!,from:endpoint(w.from,w.fromPort),to:endpoint(w.to,w.toPort),area:w.area,length:w.length,material:w.material,lengthMode:w.lengthMode??'manual',routeError:w.autoRoute?.error}))
 const terminations=project.wires.flatMap(w=>(['A','B'] as const).map((end,index)=>{const a=terminationAssessment(project,w,index?'to':'from');return {reference:`${w.reference}.${end}`,wire:w.reference!,equipment:deviceById.get(index?w.to:w.from)!.reference!,port:index?w.toPort:w.fromPort,endpoint:endpoint(index?w.to:w.from,index?w.toPort:w.fromPort),area:w.area,material:w.material,hardware:a.part?`${a.part.name}; ${a.part.source}; ${a.issues.length?a.issues.join(' / '):'entered compatibility checks agree; tooling/torque verification required'}`:'Select connector/lug, stud size and crimp tooling from the actual terminal and conductor specifications'}}))
 const rows:unknown[][]=[['Reference','Item','Type','Quantity','Unit','Specification','From / terminal','To / conductor','Model / verification status']]
 for(const d of project.devices)rows.push([d.reference,d.name,definitions[d.kind].label,1,'item',equipmentSpecification(d)+(d.schedule?`; daily ${d.schedule.startHour}-${d.schedule.endHour} h`:''),'','',d.model?`Catalogue-linked: ${d.model}; review model assumptions`:'Generic behavioural model'])
 for(const s of project.structures??[])rows.push([s.reference,s.name,s.kind,1,'workspace',`${s.size.map(n=>n.toFixed(3)).join(' x ')} m`,'','','Geometry only; material and fixings unspecified'])
 for(const c of connections)rows.push([c.reference,`${c.material} conductor`,'Cable',c.length,'m',`${c.area} mm2; ${c.routeError?'last validated physical length':c.lengthMode==='physical'?'physical route + saved slack':'specified length'}`,c.from,c.to,c.routeError?`Unsupported route: ${c.routeError}`:'Voltage-drop model; ampacity/protection require verification'])
 for(const t of terminations)rows.push([t.reference,'Conductor end','Termination',1,'end',`${t.area} mm2 ${t.material}`,t.endpoint,t.wire,t.hardware])
 if(project.engineering){rows.push(['','Regional engineering','Design assumptions',1,'review',engineeringSummary(project),'','','Input-based checks; not an installation certificate']);for(const w of project.wires){const a=ampacity(w,project.engineering.region);rows.push([w.reference,'Installation ampacity','Cable assessment',1,'review',`${a.amps?.toFixed(2)??'unresolved'} A; ${a.error??a.label}`,JSON.stringify(w.installation??{}),'',''])}if(project.engineering.earthing)rows.push(['','Earthing inputs','Design assumptions',1,'review',JSON.stringify(project.engineering.earthing),'','','Verify actual bonding, disconnection and continuity'])}
 for(const d of project.devices){if(d.protection)rows.push([d.reference,'Protection hardware','Manufacturer inputs',1,'review',JSON.stringify(d.protection),'','','']);if(d.batteryLimits)rows.push([d.reference,'Battery management','Directional limits',1,'review',JSON.stringify(d.batteryLimits),'','','Bounded equivalent; cell firmware not reproduced'])}
 return {project,connections,terminations,rows,csv:rows.map(r=>r.map(csvCell).join(',')).join('\r\n')}
}

/** Keep each source branch together, then paginate remaining distribution equipment. */
export function drawingGroups(project:Project):Array<{name:string;devices:Device[]}>{
 const used=new Set<string>(),branches:Array<{name:string;devices:Device[]}>=[]
 for(const kind of ['pv','battery'] as const)for(const source of project.devices.filter(d=>d.kind===kind)){
  if(used.has(source.id))continue
  const ids=new Set([source.id]),queue=[source.id]
  while(queue.length){const id=queue.shift()!;for(const w of project.wires){const other=w.from===id?w.to:w.to===id?w.from:null,d=project.devices.find(d=>d.id===other);if(d&&!used.has(d.id)&&!ids.has(d.id)&&(d.kind===kind||d.kind==='fuse')){ids.add(d.id);queue.push(d.id)}}}
  const devices=project.devices.filter(d=>ids.has(d.id));devices.forEach(d=>used.add(d.id))
  branches.push({name:kind==='pv'?'PV strings':'Battery branches',devices})
 }
 const result:Array<{name:string;devices:Device[]}>=[],distribution=project.devices.filter(d=>!used.has(d.id))
 for(let i=0;i<distribution.length;i+=8)result.push({name:'Conversion, distribution and loads',devices:distribution.slice(i,i+8)})
 for(const branch of branches){const last=result.at(-1);if(last?.name===branch.name&&last.devices.length+branch.devices.length<=8)last.devices.push(...branch.devices);else for(let i=0;i<branch.devices.length;i+=8)result.push({name:branch.name,devices:branch.devices.slice(i,i+8)})}
 return result
}

export function detailProject(project:Project,group:ReturnType<typeof drawingGroups>[number]):Project{
 const columns=group.name==='PV strings'&&group.devices.length<=6?3:4,ids=new Set(group.devices.map(d=>d.id))
 return {...project,devices:group.devices.map((d,i)=>({...d,x:110+(i%columns)*430,y:100+Math.floor(i/columns)*460})),wires:project.wires.filter(w=>ids.has(w.from)&&ids.has(w.to))}
}

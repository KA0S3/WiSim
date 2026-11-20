import {ampacity,engineeringSources} from './ampacity'
import {terminationAssessment} from './terminations'
import {acSourceKinds,type Finding,type Project,type Frame,type Device,type RuntimeState} from './model'
import {batteryNetwork} from './connection-checks'

export function batteryPermission(project:Project,d:Device,state:RuntimeState){
 const b=d.batteryLimits,soc=state.soc[d.id]??project.initialSoc,t=project.ambient
 if(!b)return {charge:true,discharge:soc>0,reasons:[] as string[]}
 const connected=b.control==='internal'||b.externalConnected
 const charge=connected&&t>=b.chargeMinC&&t<=b.chargeMaxC&&soc<b.maxSoc&&!state.enabled[d.id+':charge-blocked']
 const discharge=connected&&t>=b.dischargeMinC&&t<=b.dischargeMaxC&&soc>b.minSoc&&!state.enabled[d.id+':discharge-blocked']
 return {charge,discharge,reasons:[...(!connected?['External BMS contactor/control is not connected.']:[]),...(!charge?['Charging inhibited by BMS configuration, temperature or SOC.']:[]),...(!discharge?['Discharging inhibited by BMS configuration, temperature or SOC.']:[])]}
}
export function engineeringFindings(project:Project,frame?:Pick<Frame,'wires'|'devices'>):Finding[]{
 const e=project.engineering;if(!e)return []
 const out:Finding[]=[],add=(id:string,severity:Finding['severity'],title:string,detail:string,target?:string)=>out.push({id:'engineering-'+id,severity,title,detail,target})
 const devices=new Map(project.devices.map(d=>[d.id,d])),a=e.earthing
 for(const w of project.wires){
  const capacity=ampacity(w,e.region),i=w.installation,current=Math.max(i?.designCurrent??0,Math.abs(frame?.wires[w.id]?.current??0)),required=current*(e.region==='US'&&i?.continuous?1.25:1)
  const pe=[devices.get(w.from)?.ports.find(p=>p.id===w.fromPort),devices.get(w.to)?.ports.find(p=>p.id===w.toPort)].some(p=>p?.domain==='earth')
  if(!pe){
   if(capacity.amps===undefined)add('ampacity-'+w.id,'warning','Cable ampacity unresolved',capacity.error+' '+capacity.label,w.id)
   else if(required>capacity.amps)add('ampacity-'+w.id,'fault','Cable ampacity exceeded',`${required.toFixed(2)} A required; ${capacity.amps.toFixed(2)} A after temperature/grouping/terminal limits. ${capacity.label}`,w.id)
   if(i?.protectionId){
    const p=devices.get(i.protectionId),rating=p?.kind==='fuse'?p.spec.rating:undefined
    if(rating===undefined)add('protection-missing-'+w.id,'warning','Assigned protection is missing','Select the actual series protection device for this conductor.',w.id)
    else{
     if(rating<required||capacity.protectionMax!==undefined&&rating>capacity.protectionMax)add('coordination-'+w.id,'fault','Protection and conductor do not coordinate',`Required ${required.toFixed(1)} A ≤ protection ${rating} A ≤ allowable ${capacity.protectionMax?.toFixed(1)??'unknown'} A is not satisfied.`,w.id)
     if(p?.protection?.conventionalFactor&&capacity.amps!==undefined&&rating*p.protection.conventionalFactor>1.45*capacity.amps)add('conventional-'+w.id,'fault','Conventional trip current exceeds cable criterion','I2 must not exceed 1.45 × Iz for this IEC overload criterion.',w.id)
    }
   }else add('protection-unassigned-'+w.id,'info','Conductor protection unassigned','Open Electrical engineering, select this conductor, and choose its Source overcurrent protection. Review each source feed, including battery and grid paths.',w.id)
  }else if(a){
   let minimum:number|undefined
   if(e.region==='US'){
    const p=i?.protectionId?devices.get(i.protectionId):undefined
    if(p){const ix=[15,20,60,100,200,300,400,500,600,800,1000,1200].findIndex(n=>n>=p.spec.rating);const labels=w.material==='copper'?['14','12','10','8','6','4','3','2','1','1/0','2/0','3/0']:['12','10','8','6','4','2','1','1/0','2/0','3/0','4/0'];if(ix>=0&&labels[ix])minimum=awgAreaForEarth(labels[ix])}
   }else if(a.faultA&&a.clearingSeconds&&a.k)minimum=a.faultA*Math.sqrt(a.clearingSeconds)/a.k
   if(minimum===undefined)add('pe-size-'+w.id,'warning','Protective conductor sizing unresolved',e.region==='US'?'Assign the source overcurrent device for the sourced EGC table.':'Enter prospective earth-fault current, verified clearing time and conductor k factor for the adiabatic check.',w.id)
   else if(w.area+1e-6<minimum)add('pe-size-'+w.id,'fault','Protective conductor is undersized',`${minimum.toFixed(3)} mm² minimum from the selected fault assumptions; actual ${w.area.toFixed(3)} mm².`,w.id)
  }
  if(w.terminations)for(const end of ['from','to'] as const){const t=terminationAssessment(project,w,end);for(const [index,issue]of t.issues.entries())add(`termination-${w.id}-${end}-${index}`,'warning','Termination needs review',`${end==='from'?'A':'B'}: ${issue}`,w.id)}
 }
 for(const d of project.devices){
  if(d.batteryLimits){const bank=batteryNetwork(project,d.id),count=bank.sources.length,series=bank.span?Math.round(bank.span/d.spec.voltage):1,b=d.batteryLimits;if(b.maxSeries&&series>b.maxSeries||b.maxParallel&&count/Math.max(1,series)>b.maxParallel)add('bank-limit-'+d.id,'fault','Battery arrangement exceeds sourced limits',`${series} inferred series and ${count/Math.max(1,series)} parallel units; configured maxima ${b.maxSeries??'unknown'} series / ${b.maxParallel??'unknown'} parallel. Complex mixed banks require a separate study.`,d.id)}
  if(d.kind==='fuse'){
   const p=d.protection
   if(!p){add('hardware-'+d.id,'info','Generic protection model','Overcurrent trips use the configured current rating and a generic delay. For hardware assessment, open Electrical engineering, select this fuse, enable protection hardware data, and enter its AC/DC rating, interrupt capacity and manufacturer curve reference.',d.id);continue}
   if(!p.source.trim())add('protection-source-'+d.id,'warning','Protection data needs a source','Record the manufacturer document and the applicable curve/conditions.',d.id)
   if(a?.faultA&&p.breakingA<a.faultA)add('breaking-'+d.id,'fault','Interrupt rating is below prospective fault current',`${p.breakingA} A interrupt rating; configured fault current ${a.faultA} A.`,d.id)
   const domains=project.wires.filter(w=>w.from===d.id||w.to===d.id).flatMap(w=>{const other=devices.get(w.from===d.id?w.to:w.from);return other?.ports.find(port=>port.id===(w.from===d.id?w.toPort:w.fromPort))?.domain??[]})
   if(domains.some(domain=>domain!=='earth'&&domain!==p.domain))add('domain-'+d.id,'fault','Protection AC/DC rating mismatch','The selected protection domain does not match an adjacent circuit terminal.',d.id)
   if(p.upstreamId){const upstream=devices.get(p.upstreamId);if(!upstream||!p.selectivityA||!p.coordinationSource||!a?.faultA)add('selectivity-'+d.id,'warning','Selectivity is not established','Enter the exact upstream device, manufacturer coordination source and selectivity limit, plus prospective fault current.',d.id);else if(a.faultA>p.selectivityA)add('selectivity-'+d.id,'warning','Fault current exceeds selectivity limit',`${a.faultA} A prospective; sourced pair is selective only through ${p.selectivityA} A.`,d.id)}
   const connected=project.wires.filter(w=>w.installation?.protectionId===d.id)
   for(const w of connected){const k=w.material==='copper'?115:76,energy=p.letThroughA2s??(a?.faultA&&p.clearingSeconds?a.faultA**2*p.clearingSeconds:undefined);if(energy!==undefined&&energy>(k*w.area)**2)add('thermal-'+d.id+'-'+w.id,'fault','Fault energy exceeds PVC cable withstand',`Configured let-through ${energy.toFixed(0)} A²s exceeds (kS)² ${(k*w.area)**2} A²s for PVC ${w.material}. Verify the actual cable construction and manufacturer curve.`,w.id)}
  }
  if(d.batteryLimits){const b=d.batteryLimits;if(!b.source.trim())add('bms-source-'+d.id,'warning','Battery management limits need a source','The entered limits are assumptions until checked against the exact battery and BMS.',d.id);if(b.control==='external'&&!b.externalConnected)add('bms-external-'+d.id,'fault','External BMS is not connected','This configuration inhibits both directions. Connect the real BMS control/contactor before enabling this model.',d.id);if(frame){const r=frame.devices[d.id],limit=(r?.current??0)<0?b.chargeA:b.dischargeA;if(Math.abs(r?.current??0)>limit*1.001)add('bms-current-'+d.id,'fault','Battery BMS current limit exceeded',`${Math.abs(r.current).toFixed(1)} A exceeds ${limit} A. Review the configured bounded BMS equivalent.`,d.id)}}
 }
 if(a){
  if(a.scheme==='TN'){if(a.loopOhm===undefined||a.disconnectA===undefined)add('loop','warning','Earth-fault loop check needs inputs','Enter measured/designed loop impedance Zs and the current Ia guaranteeing the required disconnection time.');else if(a.loopOhm*a.disconnectA>a.voltage)add('loop','fault','Earth-fault loop cannot guarantee disconnection',`Zs × Ia = ${(a.loopOhm*a.disconnectA).toFixed(1)} V exceeds U0 ${a.voltage} V.`)}
  if(a.scheme==='TT'){if(a.electrodeOhm===undefined||a.residualA===undefined)add('electrode','warning','TT touch-voltage check needs inputs','Enter electrode resistance and rated residual operating current; verify RCD type and operating time separately.');else if(a.electrodeOhm*a.residualA>a.touchVoltage)add('electrode','fault','TT touch-voltage criterion exceeded',`Ra × IΔn = ${(a.electrodeOhm*a.residualA).toFixed(1)} V exceeds ${a.touchVoltage} V.`)}
  if(a.scheme==='IT')add('it','warning','IT system requires a separate protection study','Insulation monitoring, first-fault indication and second-fault disconnection are not established by the TN/TT checks.')
  const grounds=new Set(project.devices.filter(d=>d.kind==='ground').map(d=>d.id)),edges=new Map<string,string[]>()
  const link=(x:string,y:string)=>{edges.set(x,[...(edges.get(x)??[]),y]);edges.set(y,[...(edges.get(y)??[]),x])}
  for(const w of project.wires)link(`${w.from}:${w.fromPort}`,`${w.to}:${w.toPort}`)
  const reached=new Set([...grounds].map(id=>id+':p')),queue=[...reached];while(queue.length)for(const n of edges.get(queue.shift()!)??[])if(!reached.has(n)){reached.add(n);queue.push(n)}
  for(const d of project.devices.filter(d=>['inverter','charger','mppt','load','motor','pv'].includes(d.kind)))if(!d.ports.some(p=>p.id==='pe')||!reached.has(d.id+':pe'))add('bond-'+d.id,'warning','Equipment protective earth is unconnected','Add the optional chassis PE terminal and a conductor to the earth reference where the actual equipment requires bonding. Double-insulated equipment requires its own documented assessment.',d.id)
  const validBonds=a.neutralBondIds.filter(id=>{const d=devices.get(id);return d&&acSourceKinds.has(d.kind)&&d.ports.some(p=>p.id==='pe')&&reached.has(d.id+':pe')});if(a.scheme==='TN'&&validBonds.length!==1)add('neutral-bond','warning','Neutral-earth bond arrangement needs review',`${validBonds.length} connected source bonds. Specify the intended source bond and wire its chassis PE to earth; switching sources and separately derived systems need a dedicated assessment.`)
  if(!a.source.trim())add('earthing-source','warning','Earthing inputs need evidence','Record the source/test evidence and required disconnection time. Input criteria do not certify installed continuity or touch safety.')
 }
 return out
}
// The NEC 2017 EGC table uses these exact native conductor sizes.
function awgAreaForEarth(label:string){const awg=label.includes('/')?1-Number(label.split('/')[0]):Number(label);return Math.PI/4*(.127*92**((36-awg)/39))**2}
export function engineeringSummary(project:Project){return project.engineering?`${project.engineering.region}: ${engineeringSources[project.engineering.region].label}; installation conditions stored per conductor; ${project.engineering.earthing?.scheme??'earthing unassigned'}`:'Regional engineering inputs not configured'}

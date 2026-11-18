import type {Device,Finding,Project} from './model'
import {pvVocAtTemperature} from './pv-ratings'
import {pvNetwork} from './pv-network'
import {faultFindings} from './fault-checks'

const key=(id:string,port:string)=>JSON.stringify([id,port])
/** Wire/fuse/bus nets, then source-voltage constraints. Loads and converter sides never collapse into one net. */
function sourceNetwork(project:Project,kind:'battery'|'pv',cold=false){
 const parent=new Map<string,string>()
 const root=(k:string):string=>{const p=parent.get(k);if(!p){parent.set(k,k);return k}if(p===k)return k;const r=root(p);parent.set(k,r);return r}
 const join=(a:string,b:string)=>{const x=root(a),y=root(b);if(x!==y)parent.set(x,y)}
 for(const d of project.devices){for(const p of d.ports)root(key(d.id,p.id));if(d.on&&['bus','fuse','switch'].includes(d.kind))for(const p of d.ports.filter(p=>p.domain!=='earth').slice(1))join(key(d.id,d.ports[0].id),key(d.id,p.id))}
 for(const w of project.wires)join(key(w.from,w.fromPort),key(w.to,w.toPort))
 type Edge={to:string;voltage:number;id:string}
 const graph=new Map<string,Edge[]>(),add=(from:string,to:string,voltage:number,id:string)=>graph.set(from,[...(graph.get(from)??[]),{to,voltage,id}])
 for(const d of project.devices.filter(d=>d.on&&d.kind===kind)){
  const voltage=kind==='pv'?(cold?pvVocAtTemperature(d.spec,project.ambient):d.spec.voltage):d.spec.voltage,a=root(key(d.id,'n')),b=root(key(d.id,'p'))
  add(a,b,voltage,d.id);add(b,a,-voltage,d.id)
 }
 return (device:Device,positive:string,negative:string)=>{
  const start=root(key(device.id,negative)),end=root(key(device.id,positive)),values=new Map([[start,0]]),queue=[start],sources=new Set<string>();let conflict=false
  for(let i=0;i<queue.length;i++)for(const edge of graph.get(queue[i])??[]){
   sources.add(edge.id);const v=values.get(queue[i])!+edge.voltage,old=values.get(edge.to)
   if(old===undefined){values.set(edge.to,v);queue.push(edge.to)}else if(Math.abs(old-v)>Math.max(.2,Math.abs(v)*.02))conflict=true
  }
  let voltage=values.get(end),incomplete=false
  if(kind==='pv'&&start!==end&&voltage!==undefined){
   const paths=[{node:start,value:0,seen:new Set([start])}],totals:number[]=[];let steps=0
   while(paths.length&&steps++<10000){const path=paths.pop()!;if(path.node===end){totals.push(path.value);continue}for(const edge of graph.get(path.node)??[])if(!path.seen.has(edge.to))paths.push({node:edge.to,value:path.value+edge.voltage,seen:new Set([...path.seen,edge.to])})}
   incomplete=paths.length>0;if(totals.length)voltage=Math.max(...totals)
  }
  return {voltage,span:Math.max(...values.values())-Math.min(...values.values()),sources:[...sources],conflict,incomplete,shorted:start===end&&sources.size>0}
 }
}
export function batteryNetwork(project:Project,id:string,positive='p',negative='n'){const device=project.devices.find(d=>d.id===id);return device?sourceNetwork(project,'battery')(device,positive,negative):{voltage:undefined,span:0,sources:[],conflict:false,incomplete:false,shorted:false}}

export type ConnectionFinding=Finding&{related:string[]}
export function connectionFindings(project:Project):ConnectionFinding[]{
 const battery=sourceNetwork(project,'battery'),pv=sourceNetwork(project,'pv',true),findings:ConnectionFinding[]=faultFindings(project)
 for(const wire of project.wires){
  const a=project.devices.find(d=>d.id===wire.from),b=project.devices.find(d=>d.id===wire.to),from=a?.ports.find(p=>p.id===wire.fromPort),to=b?.ports.find(p=>p.id===wire.toPort),passive=['resistor','capacitor','inductor','diode','switch','fuse','bus']
  // A generic passive's default drawing domain does not restrict it to DC.
  if(from&&to&&from.domain!==to.domain&&(from.domain==='earth'||to.domain==='earth'||!passive.includes(a!.kind)&&!passive.includes(b!.kind)))findings.push({id:'domain-mismatch-'+wire.id,severity:from.domain==='earth'||to.domain==='earth'?'warning':'fault',title:from.domain==='earth'||to.domain==='earth'?'Earth/reference connection needs review':'AC and DC terminals are directly connected',detail:`This conductor joins a ${from.domain.toUpperCase()} terminal to a ${to.domain.toUpperCase()} terminal. The sandbox permits the connection; review the intended conversion, isolation or reference arrangement.`,target:wire.id,related:[wire.from,wire.to]})
 }
 for(const d of project.devices){
  if(!d.on)continue
  const ports=d.kind==='inverter'?['dc+','dc-']:d.kind==='mppt'||d.kind==='charger'?['bat+','bat-']:d.kind==='battery'?['p','n']:null
  if(ports){
   const bank=battery(d,ports[0],ports[1]),related=[d.id,...bank.sources]
   if(bank.sources.length&&bank.conflict)findings.push({id:'bank-conflict-'+d.id,severity:'fault',title:'Battery source voltages conflict',detail:'Connected battery branches impose inconsistent voltages. Check series/parallel arrangement and polarity before continuing.',target:d.id,related})
   if(bank.voltage!==undefined&&bank.sources.length){
    if(bank.voltage<=0)findings.push({id:'bank-polarity-'+d.id,severity:'fault',title:bank.shorted?'Battery terminals are shorted':'Battery polarity is reversed',detail:`The connected source constraints give ${bank.voltage.toFixed(1)} V from positive to negative at ${d.name}. Check both terminal connections.`,target:d.id,related})
    else if(d.kind==='inverter'){
     const nominal=d.spec.cutoff>30?48:d.spec.cutoff>15?24:12
     if(Math.abs(bank.voltage/nominal-1)>.15)findings.push({id:'bank-voltage-'+d.id,severity:'fault',title:'Battery bank and inverter voltage classes differ',detail:`${bank.voltage.toFixed(1)} V nominal connected bank; the configured inverter cutoff corresponds to a ${nominal} V system. Select matching equipment or revise the bank.`,target:d.id,related})
    }else if(d.kind==='mppt'||d.kind==='charger'){
     const target=d.spec.chargeVoltage??60,ratio=target/bank.voltage
     if(ratio<1.02||ratio>1.3)findings.push({id:'charge-voltage-'+d.id,severity:'warning',title:'Charge target does not match the battery bank',detail:`${target.toFixed(1)} V charge target for a ${bank.voltage.toFixed(1)} V nominal bank. Check chemistry, series count and charge settings; manufacturer limits still require verification.`,target:d.id,related})
    }
   }
  }
  if(d.kind==='mppt'){
   const array=pv(d,'pv+','pv-'),related=[d.id,...array.sources]
   const network=pvNetwork(project,d.id)
   if(network.known){
    if(d.spec.pvMaxShortCircuitCurrent!==undefined&&network.shortCircuitCurrent>d.spec.pvMaxShortCircuitCurrent)findings.push({id:'pv-short-circuit-current-'+d.id,severity:'fault',title:'PV array short-circuit current exceeds controller limit',detail:`${network.strings} parallel strings give ${network.shortCircuitCurrent.toFixed(2)} A estimated Isc at ${project.ambient} °C; the configured limit is ${d.spec.pvMaxShortCircuitCurrent} A. Split strings across additional controllers or use compatible equipment. Output current limiting does not establish safe PV input current.`,target:d.id,related:[d.id,...network.sources]})
    if(d.spec.pvMaxPower!==undefined&&network.power>d.spec.pvMaxPower)findings.push({id:'pv-nameplate-power-'+d.id,severity:'warning',title:'PV nameplate power exceeds the controller reference',detail:`${network.power.toFixed(0)} W of modules exceeds the ${d.spec.pvMaxPower.toFixed(0)} W reference at the configured battery class. Check the exact manufacturer's permitted oversizing and clipping; current and voltage limits remain separate constraints.`,target:d.id,related:[d.id,...network.sources]})
   }else if(array.sources.length&&d.spec.pvMaxShortCircuitCurrent!==undefined)findings.push({id:'pv-input-current-unknown-'+d.id,severity:'warning',title:'PV input current limit cannot be established',detail:'The connected PV network is not a set of independent, complete series strings. Expand and review shared modules, open paths, polarity and collector connections; a safe input-current total has not been assumed.',target:d.id,related})
   if(array.voltage!==undefined&&d.spec.pvMaxOperatingVoltage!==undefined&&array.voltage>d.spec.pvMaxOperatingVoltage&&array.voltage<=d.spec.voc)findings.push({id:'pv-operating-voltage-'+d.id,severity:'warning',title:'PV voltage exceeds the controller operating/startup limit',detail:`${array.voltage.toFixed(1)} V estimated string Voc exceeds the ${d.spec.pvMaxOperatingVoltage} V operating/startup limit, although it remains below the configured absolute maximum. Reduce series count or select compatible equipment.`,target:d.id,related})
   if(array.incomplete)findings.push({id:'pv-network-unknown-'+d.id,severity:'warning',title:'PV voltage check needs a simpler topology',detail:'The bounded string-path check could not inspect every path. Split the array into clear strings; maximum Voc is not established for this network.',target:d.id,related})
   if(array.conflict)findings.push({id:'pv-conflict-'+d.id,severity:'warning',title:'PV strings have different open-circuit voltages',detail:'Parallel branches have different nominal string Voc. Review panel counts, matching and reverse-current protection; these are nonlinear PV sources, not ideal fixed-voltage supplies.',target:d.id,related})
   if(array.voltage!==undefined&&array.sources.length){
    if(array.voltage<=0)findings.push({id:'pv-polarity-'+d.id,severity:'fault',title:'PV input polarity or wiring is incorrect',detail:`The connected PV source constraints give ${array.voltage.toFixed(1)} V. Check PV positive/negative and any shorted terminals.`,target:d.id,related})
    else if(array.voltage>d.spec.voc)findings.push({id:'pv-open-circuit-'+d.id,severity:'fault',title:'PV open-circuit voltage exceeds controller limit',detail:`${array.voltage.toFixed(1)} V estimated string Voc at ${project.ambient} °C exceeds the ${d.spec.voc} V controller limit. Reduce series count or choose a higher-voltage controller. Sourced per-module temperature coefficients are used where available; otherwise the generic coefficient is an assumption.`,target:d.id,related})
   }
  }
 }
 return findings.filter((f,i,all)=>all.findIndex(a=>a.id===f.id)===i)
}
export function assertDesignConnections(project:Project):void{
 const issues=connectionFindings(project)
 if(issues.length)throw new Error('Generated design failed connection checks: '+issues.map(f=>f.title).join('; '))
}

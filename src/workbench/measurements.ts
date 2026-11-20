import {acSourceKinds,type Project,type RuntimeState,type NumericSeries} from './model'

export type Measurement = {ac:boolean;frequency:number|null;observationFrequency?:number|null}
export const measurementKey=(id:string,port:string)=>`${id}:${port}`

/** Propagate source frequency through conductors/passives, keeping converter sides separate. */
export function networkMeasurements(project:Project,state:RuntimeState):Record<string,Measurement>{
 const parent=new Map<string,string>(),frequencies=new Map<string,Set<number>>()
 const root=(key:string):string=>{const p=parent.get(key);if(!p){parent.set(key,key);return key}if(p===key)return key;const r=root(p);parent.set(key,r);return r}
 const join=(a:string,b:string)=>{const x=root(a),y=root(b);if(x!==y)parent.set(x,y)}
 for(const d of project.devices){
  d.ports.forEach(p=>root(measurementKey(d.id,p.id)))
  if(!d.on||state.trips.includes(d.id))continue
  const groups=d.kind==='inverter'?[['l','n'],['dc+','dc-']]:d.kind==='charger'?[['l','n'],['bat+','bat-']]:d.kind==='mppt'?[['pv+','pv-'],['bat+','bat-']]:[d.ports.filter(p=>p.domain!=='earth').map(p=>p.id)]
  for(const group of groups)for(const port of group.slice(1))join(measurementKey(d.id,group[0]),measurementKey(d.id,port))
 }
 for(const w of project.wires)join(measurementKey(w.from,w.fromPort),measurementKey(w.to,w.toPort))
 for(const d of project.devices){
  if(!d.on||state.trips.includes(d.id)||!acSourceKinds.has(d.kind))continue
  const port=d.kind==='inverter'?'l':d.kind==='three-phase'?'a':'p',key=root(measurementKey(d.id,port))
  const values=frequencies.get(key)??new Set<number>();values.add(d.spec.frequency);frequencies.set(key,values)
 }
 // Converter sides remain separate AC/DC domains, but their power readings need
 // one shared observation window. A 20 ms DC average is not a full 60 Hz cycle.
 const couplings=new Map<string,Set<string>>()
 for(const d of project.devices){
  if(!d.on||state.trips.includes(d.id)||!['inverter','charger','mppt'].includes(d.kind))continue
  const domains=[...new Set(d.ports.filter(p=>p.domain!=='earth').map(p=>root(measurementKey(d.id,p.id))))]
  for(const a of domains)for(const b of domains)if(a!==b){const linked=couplings.get(a)??new Set<string>();linked.add(b);couplings.set(a,linked)}
 }
 const observation=new Map<string,Set<number>>()
 for(const start of new Set([...parent.keys()].map(root))){
  if(observation.has(start))continue
  const seen=new Set([start]),queue=[start],values=new Set<number>()
  for(let i=0;i<queue.length;i++){for(const f of frequencies.get(queue[i])??[])values.add(f);for(const next of couplings.get(queue[i])??[])if(!seen.has(next)){seen.add(next);queue.push(next)}}
  for(const domain of seen)observation.set(domain,values)
 }
 const result:Record<string,Measurement>={}
 for(const key of parent.keys()){
  const domain=root(key),f=frequencies.get(domain),observed=observation.get(domain),measurement:Measurement={ac:!!f?.size,frequency:f?.size===1?[...f][0]:null}
  if(observed?.size)measurement.observationFrequency=observed.size===1?[...observed][0]:null
  result[key]=measurement
 }
 return result
}

export function measurementStart(times:NumericSeries,measurement:Measurement):number {
 const end=times.at(-1)??0
 if(measurement.observationFrequency!==undefined)return measurement.observationFrequency===null?times[0]??0:Math.max(times[0]??0,end-1/measurement.observationFrequency)
 return measurement.ac?(measurement.frequency?Math.max(times[0]??0,end-1/measurement.frequency):times[0]??0):Math.max(times[0]??0,end-.02)
}

/** Integrate the piecewise-linear samples, including an interpolated window boundary. */
export function timeAverage(values:NumericSeries,times:NumericSeries,begin:number,squared=false):number {
 let area=0,span=0
 for(let i=1;i<Math.min(times.length,values.length);i++){
  const start=Math.max(begin,times[i-1]),dt=times[i]-start,total=times[i]-times[i-1]
  if(dt<=0||total<=0)continue
  const a=values[i-1]+(values[i]-values[i-1])*(start-times[i-1])/total,b=values[i]
  area+=(squared?(a*a+a*b+b*b)/3:(a+b)/2)*dt;span+=dt
 }
 return span?(squared?Math.sqrt(Math.max(0,area/span)):area/span):0
}

export function measureBetween(a:NumericSeries,b:NumericSeries,times:NumericSeries,left:Measurement,right:Measurement){
 const ac=left.ac||right.ac
 const frequency=left.ac&&right.ac?(left.frequency===right.frequency?left.frequency:null):left.ac?left.frequency:right.frequency
 const observations=[left,right].flatMap(m=>m.observationFrequency!==undefined?[m.observationFrequency]:m.ac?[m.frequency]:[]),unique=new Set(observations)
 const measurement:Measurement={ac,frequency,...(observations.length?{observationFrequency:unique.size===1?observations[0]:null}:{})}
 const begin=measurementStart(times,measurement)
 return {value:timeAverage(a.map((v,i)=>v-(b[i]??0)),times,begin,ac),begin,ac,frequency}
}

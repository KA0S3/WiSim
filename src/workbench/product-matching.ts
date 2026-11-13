import type {CatalogRecord} from '../catalog'
import type {Device,Project} from './model'
import {applyCatalogRecord} from './catalog-device'
import {connectionFindings} from './connection-checks'

/** Rank only locally verified, voltage-compatible devices with sufficient configured capacity. */
function strictProducts(device:Device,records:CatalogRecord[]):CatalogRecord[]{
 const s=device.spec,relative=(a:number,b:number)=>Math.abs(a-b)/Math.max(1,Math.abs(b))
 const ranked=records.flatMap(record=>{
  if(record.status!=='verified'||record.kind!==device.kind)return []
  let score=0
  if(device.kind==='battery'){
   if(!record.voltage||relative(record.voltage,s.voltage)>.1||!record.capacityAh||record.capacityAh<s.capacityAh||record.capacityAh>s.capacityAh*2.1)return []
   if(record.maxDischargeCurrentA&&record.maxDischargeCurrentA<s.rating)return []
   score=relative(record.capacityAh,s.capacityAh)+relative(record.voltage,s.voltage)*4
  }else if(device.kind==='pv'){
   if(!record.power||record.power<s.watts||!record.moduleVmp||relative(record.power,s.watts)>.3||relative(record.moduleVmp,s.voltage)>.25)return []
   score=relative(record.power,s.watts)+relative(record.moduleVmp,s.voltage)+relative(record.moduleVoc??s.voc,s.voc)
  }else if(device.kind==='inverter'){
   const dc=s.cutoff>30?48:s.cutoff>15?24:12
   if(!record.acVoltage||relative(record.acVoltage,s.voltage)>.1||!record.voltage||relative(record.voltage,dc)>.1||!record.power||record.power<s.watts||record.power>s.watts*2)return []
   if(record.acFrequency&&record.acFrequency!==s.frequency||s.rating>0&&(!record.surge||record.surge<s.rating))return []
   score=relative(record.power,s.watts)
  }else if(device.kind==='mppt'){
   const nominal=(s.chargeVoltage??60)/1.2
   if(!record.supportedBatteryVoltages?.some(v=>relative(v,nominal)<.1)||!record.pvVoc||record.pvVoc<s.voc||!record.chargeCurrent||record.chargeCurrent<s.rating)return []
   const supported=record.supportedBatteryVoltages.find(v=>relative(v,nominal)<.1)!
   if((record.nominalPvPowerWByBatteryVoltage?.[String(supported)]??record.power??0)<s.watts)return []
   score=relative(record.chargeCurrent,s.rating)+relative(record.pvVoc,s.voc)
  }else return []
  return [{record,score}]
 })
 return ranked.sort((a,b)=>a.score-b.score||a.record.id.localeCompare(b.record.id)).map(r=>r.record)
}
export type ProductOption={record:CatalogRecord;issues:string[];differences:string[];sufficient:boolean;suggestedQuantity:number;score:number}
export function productOptions(device:Device,records:CatalogRecord[],project?:Project):ProductOption[]{
 const strict=new Set(strictProducts(device,records).map(r=>r.id))
 const fields:Partial<Record<Device['kind'],Array<[keyof Device['spec'],string,string,number]>>>={
  battery:[['voltage','Battery voltage','V',4],['capacityAh','Capacity','Ah',1],['rating','Current limit','A',.5]],
  pv:[['watts','Panel power','W',2],['voltage','Operating voltage','V',1],['voc','Open-circuit voltage','V',1],['isc','Short-circuit current','A',.5]],
  inverter:[['watts','Output power','W',2],['rating','Surge power','W',1],['voltage','AC voltage','V',3],['frequency','Frequency','Hz',3],['cutoff','DC cutoff','V',3]],
  mppt:[['rating','Output current','A',2],['voc','Maximum PV voltage','V',1],['watts','PV power assumption','W',1],['chargeVoltage','Charge target','V',3]],
  charger:[['rating','Charge current','A',2],['voltage','AC input voltage','V',3],['chargeVoltage','Charge target','V',3]],
 }
 if(!fields[device.kind])return []
 return records.filter(r=>r.status==='verified'&&r.kind===device.kind).map(record=>{
  const candidate=applyCatalogRecord(device,record),proposed=project?{...project,devices:project.devices.map(d=>d.id===device.id?candidate:d)}:undefined
  const issues=project?connectionFindings(proposed as Project).filter(f=>f.related.includes(device.id)).map(f=>f.title+': '+f.detail):[]
  let score=0;const differences:string[]=[],number=(n:number)=>Number(n.toFixed(3)).toString()
  for(const [key,label,unit,weight]of fields[device.kind]!){const desired=device.spec[key]??(key==='chargeVoltage'?60:0),actual=candidate.spec[key]??desired,delta=actual-desired;score+=weight*Math.abs(delta)/Math.max(1,Math.abs(desired));if(Math.abs(delta)>1e-6)differences.push(`${label}: ${number(actual)} ${unit} (${number(Math.abs(delta))} ${unit} ${delta>0?'above':'below'} your ${number(desired)} ${unit})`)}
  const suggestedQuantity=device.kind==='battery'?Math.max(1,Math.ceil(device.spec.capacityAh/candidate.spec.capacityAh),Math.ceil(device.spec.rating/Math.max(1,candidate.spec.rating))):device.kind==='pv'?Math.max(1,Math.ceil(device.spec.watts/Math.max(1,candidate.spec.watts))):1
  return {record,issues:[...new Set(issues)],differences,sufficient:strict.has(record.id)&&!issues.length,suggestedQuantity,score}
 }).sort((a,b)=>Number(strict.has(b.record.id))-Number(strict.has(a.record.id))||Number(a.issues.length>0)-Number(b.issues.length>0)||a.score-b.score||a.record.id.localeCompare(b.record.id)).slice(0,4)
}
export function matchingProducts(device:Device,records:CatalogRecord[],project?:Project):CatalogRecord[]{return strictProducts(device,records).filter(record=>!project||!connectionFindings({...project,devices:project.devices.map(d=>d.id===device.id?applyCatalogRecord(d,record):d)}).some(f=>f.related.includes(device.id))).slice(0,3)}

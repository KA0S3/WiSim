import type {CatalogRecord} from '../catalog'
import {definitions,type Device} from './model'
import {applyPhysicalProfile,physicalProfile} from './profiles'
import {simulationReadiness,catalogKind} from './catalog-readiness'

/** Map ratings by their electrical meaning; nominal battery voltage is not PV Vmp or AC output voltage. */
export function applyCatalogRecord(device:Device,record:CatalogRecord):Device{
 const readiness=simulationReadiness(record)
 if(!readiness.ready||catalogKind(record)!==device.kind)throw new Error('This record is not simulation-ready for this equipment type: '+readiness.missing.join(' '))
 let d:Device={...device,name:record.name,model:record.id,physicalProfile:undefined,ports:[...structuredClone(definitions[device.kind].ports),...device.ports.filter(p=>p.id==='pe')],spec:{...device.spec}}
 const s=d.spec,profile=record.simulation!
 Object.assign(s,{width:profile.dimensions[0],height:profile.dimensions[1],depth:profile.dimensions[2]})
 if(profile.resistanceOhm!==undefined)s.resistance=profile.resistanceOhm
 if(record.power)s.watts=record.power
 switch(d.kind){
  case 'pv':
   if(record.moduleVmp)s.voltage=record.moduleVmp;if(record.moduleVoc)s.voc=record.moduleVoc;if(record.moduleIsc)s.isc=record.moduleIsc
   s.mppCurrent=record.moduleImp;s.vocTemperatureCoefficientPerC=record.moduleVocTemperatureCoefficientPerC;s.powerTemperatureCoefficientPerC=record.modulePowerTemperatureCoefficientPerC;s.iscTemperatureCoefficientPerC=record.moduleIscTemperatureCoefficientPerC;s.maxSeriesFuseA=record.maxSeriesFuseA
   break
  case 'battery':if(record.voltage)s.voltage=record.voltage;if(record.capacityAh)s.capacityAh=record.capacityAh;if(record.maxDischargeCurrentA)s.rating=record.maxDischargeCurrentA;d.batteryLimits=structuredClone(profile.batteryLimits);if(d.batteryLimits&&device.batteryLimits?.control==='external')d.batteryLimits.externalConnected=device.batteryLimits.externalConnected;break
  case 'mppt':{
   const desired=(device.spec.chargeVoltage??60)/1.2
   const nominal=record.supportedBatteryVoltages?.find(v=>Math.abs(v-desired)/v<.1)??record.voltage??12
   s.voltage=nominal*1.5 // Editable PV operating-point assumption, not manufacturer tracking firmware.
   s.chargeVoltage=nominal*1.2
   const pvPower=record.nominalPvPowerWByBatteryVoltage?.[String(nominal)];if(pvPower)s.watts=pvPower
   if(record.pvVoc)s.voc=record.pvVoc;if(record.chargeCurrent)s.rating=record.chargeCurrent
   if(record.maximumEfficiencyPercent)s.efficiency=record.maximumEfficiencyPercent/100
   s.pvMaxOperatingVoltage=record.pvMaxOperatingVoltage;s.pvMaxShortCircuitCurrent=record.maxPvShortCircuitCurrentA;s.pvMaxPower=pvPower;s.pvStartHeadroom=record.pvStartHeadroomV;s.pvRunHeadroom=record.pvRunHeadroomV
   break
  }
  case 'inverter':
   if(record.acVoltage)s.voltage=record.acVoltage;if(record.acFrequency)s.frequency=record.acFrequency
   if(record.surge)s.rating=record.surge
   s.cutoff=profile.cutoffV!;s.efficiency=record.maximumEfficiencyPercent!/100;s.idleWatts=profile.idleW
   break
  case 'charger':s.voltage=profile.acVoltage!;s.frequency=profile.acFrequency!;s.rating=record.chargeCurrent!;s.chargeVoltage=profile.chargeVoltage!;s.efficiency=record.maximumEfficiencyPercent!/100;s.idleWatts=profile.idleW;break
  case 'fuse':if(record.current)s.rating=record.current;d.protection={domain:'dc',voltage:record.maxVoltageDC!,breakingA:record.maxInterruptCurrentA!,source:profile.source};break
 }
 if(physicalProfile(record.id))d=applyPhysicalProfile(d,record.id)
 if(d.physicalProfile&&record.terminalLayout){
  const aliases:Record<string,string>=d.kind==='battery'?{p:'bat+',n:'bat-'}:d.kind==='pv'?{p:'pv+',n:'pv-'}:d.kind==='inverter'?{l:'ac-out-l',n:'ac-out-n'}:{}
  d.ports=d.ports.map(port=>{
   const terminal=record.terminalLayout!.find(t=>t.id===(aliases[port.id]??port.id))
   if(!terminal?.side)return port
   const group=record.terminalLayout!.filter(t=>t.side===terminal.side),offset=(group.indexOf(terminal)+1)/(group.length+1)
   const anchor: [number,number,number]|undefined=d.kind==='pv'?[offset-.5,-.35,-.55]:terminal.side==='top'?[offset-.5,.5,0]:terminal.side==='bottom'?[offset-.5,-.5,.35]:undefined
   return {...port,side:terminal.side,offset,anchor:physicalProfile(d.physicalProfile)?.terminals?.[port.id]??anchor}
  })
 }
 return d
}

import type {CatalogRecord} from '../catalog'
import {definitions,type Device} from './model'
import {applyPhysicalProfile,physicalProfile} from './profiles'

/** Map ratings by their electrical meaning; nominal battery voltage is not PV Vmp or AC output voltage. */
export function applyCatalogRecord(device:Device,record:CatalogRecord):Device{
 if(record.status!=='verified'||record.kind!==device.kind)throw new Error('This record is not verified for this equipment type')
 let d:Device={...device,name:record.name,model:record.id,physicalProfile:undefined,ports:structuredClone(definitions[device.kind].ports),spec:{...device.spec}}
 const s=d.spec
 if(record.power)s.watts=record.power
 switch(d.kind){
  case 'pv':
   if(record.moduleVmp)s.voltage=record.moduleVmp;if(record.moduleVoc)s.voc=record.moduleVoc;if(record.moduleIsc)s.isc=record.moduleIsc
   s.mppCurrent=record.moduleImp;s.vocTemperatureCoefficientPerC=record.moduleVocTemperatureCoefficientPerC;s.powerTemperatureCoefficientPerC=record.modulePowerTemperatureCoefficientPerC;s.iscTemperatureCoefficientPerC=record.moduleIscTemperatureCoefficientPerC;s.maxSeriesFuseA=record.maxSeriesFuseA
   break
  case 'battery':if(record.voltage)s.voltage=record.voltage;if(record.capacityAh)s.capacityAh=record.capacityAh;if(record.maxDischargeCurrentA)s.rating=record.maxDischargeCurrentA;break
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
   s.cutoff=(record.voltage??51.2)*44/51.2
   if(record.id==='victron-phoenix-12-1200-230v'){s.cutoff=9.3;s.efficiency=.91;s.idleWatts=10}
   break
  case 'fuse':if(record.current)s.rating=record.current;break
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

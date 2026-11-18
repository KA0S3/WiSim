import type {CatalogRecord} from '../catalog'
import type {Kind} from './model'
import {validBatteryLimits} from './engineering-model'

export function catalogKind(record:CatalogRecord):Kind|null{return ['battery','pv','mppt','inverter','fuse','load','bus'].includes(record.kind)?record.kind as Kind:record.kind==='battery-charger'?'charger':null}
export function simulationReadiness(record:CatalogRecord){
 const missing:string[]=[],kind=catalogKind(record),s=record.simulation
 if(!kind)missing.push('This equipment behaviour is not implemented.')
 if(!['verified','partially verified'].includes(record.status))missing.push('Electrical research has not established a usable profile.')
 if(!s||s.version!==1||!s.source?.startsWith('https://')||!/^\d{4}-\d{2}-\d{2}$/.test(s.checked)||!Array.isArray(s.dimensions)||s.dimensions.length!==3||!s.dimensions.every(v=>Number.isFinite(v)&&v>0)||!s.assumptions?.length)missing.push('A sourced, dimensioned simulation profile is required.')
 const required=(...keys:(keyof CatalogRecord)[])=>keys.forEach(k=>{if(typeof record[k]!=='number'||!Number.isFinite(record[k])||Number(record[k])<=0)missing.push(`Missing ${k}.`)})
 if(kind==='pv'){required('power','moduleVoc','moduleVmp','moduleImp','moduleIsc');if((record.moduleVmp??Infinity)>=(record.moduleVoc??0)||(record.moduleImp??Infinity)>=(record.moduleIsc??0))missing.push('PV ratings are inconsistent.');for(const k of ['moduleVocTemperatureCoefficientPerC','modulePowerTemperatureCoefficientPerC','moduleIscTemperatureCoefficientPerC'] as const)if(typeof record[k]!=='number'||!Number.isFinite(record[k])||Math.abs(record[k]!)>.02)missing.push(`Missing ${k}.`)}
 if(kind==='battery'){required('voltage','capacityAh','maxChargeCurrentA','maxDischargeCurrentA');if(!validBatteryLimits(s?.batteryLimits))missing.push('Battery/BMS operating limits are incomplete.')}
 if(kind==='mppt'){required('pvVoc','chargeCurrent','maximumEfficiencyPercent','maxPvShortCircuitCurrentA');if(!record.supportedBatteryVoltages?.length||record.supportedBatteryVoltages.some(v=>!record.nominalPvPowerWByBatteryVoltage?.[String(v)]))missing.push('Battery-voltage/power mapping is incomplete.')}
 if(kind==='inverter'){required('voltage','power','surge','acVoltage','acFrequency','maximumEfficiencyPercent');for(const k of ['cutoffV','inputMinV','inputMaxV','idleW'] as const)if(s?.[k]===undefined||!Number.isFinite(s[k])||s[k]!<0)missing.push(`Missing inverter ${k}.`)}
 if(kind==='charger'){required('voltage','chargeCurrent','maximumEfficiencyPercent');for(const k of ['acVoltage','acFrequency','chargeVoltage','idleW'] as const)if(s?.[k]===undefined||!Number.isFinite(s[k])||s[k]!<0)missing.push(`Missing charger ${k}.`)}
 if(kind==='fuse')required('current','maxVoltageDC','maxInterruptCurrentA')
 if(!['battery','pv','mppt','inverter','charger','fuse'].includes(kind??''))missing.push('A complete simulation mapping is not available for this product.')
 if(record.maximumEfficiencyPercent!==undefined&&record.maximumEfficiencyPercent>100)missing.push('Efficiency exceeds 100%.')
 return {ready:!missing.length,kind,missing}
}
export const simulationReady=(record:CatalogRecord)=>simulationReadiness(record).ready

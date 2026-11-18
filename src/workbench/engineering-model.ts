export type Region = 'ZA'|'GB'|'US'
export type Installation = {
  method:'za-air'|'za-duct'|'za-ground'|'gb-B'|'gb-C'|'us-raceway';
  temperature:number; circuits:number; loadedConductors:number;
  insulation:60|70|75|90; termination:60|70|75|90;
  designCurrent?:number; continuous?:boolean; protectionId?:string;
}
export type Protection = {
  domain:'ac'|'dc';voltage:number;breakingA:number;source:string;
  conventionalFactor?:number;clearingSeconds?:number;disconnectA?:number;letThroughA2s?:number;
  upstreamId?:string;selectivityA?:number;coordinationSource?:string;
}
export type BatteryLimits = {
  chargeA:number;dischargeA:number;chargeMinC:number;chargeMaxC:number;dischargeMinC:number;dischargeMaxC:number;
  lowVoltage:number;highVoltage:number;maxSoc:number;minSoc:number;
  control:'internal'|'external';externalConnected:boolean;source:string;
  maxSeries?:number;maxParallel?:number;
}
export type Termination = {hardwareId?:string;studMm?:number;matingFamily?:string;matingGender?:'socket'|'plug';cableDiameterMm?:number;conductorClass?:2|5|6}
export type Earthing = {scheme:'TN'|'TT'|'IT';voltage:number;loopOhm?:number;disconnectA?:number;electrodeOhm?:number;residualA?:number;touchVoltage:number;faultA?:number;clearingSeconds?:number;k?:number;source:string;neutralBondIds:string[]}
export type Engineering = {region:Region;earthing?:Earthing}

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const positive=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0
const optional=(o:Record<string,unknown>,keys:string[])=>keys.every(k=>o[k]===undefined||positive(o[k]))
export function validInstallation(v:unknown):v is Installation {
  return object(v)&&['za-air','za-duct','za-ground','gb-B','gb-C','us-raceway'].includes(String(v.method))&&typeof v.temperature==='number'&&Number.isFinite(v.temperature)&&v.temperature>=-50&&v.temperature<=150&&Number.isInteger(v.circuits)&&positive(v.circuits)&&Number(v.circuits)<=100&&Number.isInteger(v.loadedConductors)&&positive(v.loadedConductors)&&Number(v.loadedConductors)<=100&&[60,70,75,90].includes(Number(v.insulation))&&[60,70,75,90].includes(Number(v.termination))&&optional(v,['designCurrent'])&&(v.continuous===undefined||typeof v.continuous==='boolean')&&(v.protectionId===undefined||typeof v.protectionId==='string')
}
export function validProtection(v:unknown):v is Protection{return object(v)&&['ac','dc'].includes(String(v.domain))&&positive(v.voltage)&&positive(v.breakingA)&&typeof v.source==='string'&&optional(v,['conventionalFactor','clearingSeconds','disconnectA','letThroughA2s','selectivityA'])&&(v.upstreamId===undefined||typeof v.upstreamId==='string')&&(v.coordinationSource===undefined||typeof v.coordinationSource==='string')}
export function validBatteryLimits(v:unknown):v is BatteryLimits{return object(v)&&['chargeA','dischargeA','lowVoltage','highVoltage'].every(k=>positive(v[k]))&&['chargeMinC','chargeMaxC','dischargeMinC','dischargeMaxC','minSoc','maxSoc'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k]))&&Number(v.chargeMinC)<Number(v.chargeMaxC)&&Number(v.dischargeMinC)<Number(v.dischargeMaxC)&&Number(v.lowVoltage)<Number(v.highVoltage)&&Number(v.minSoc)>=0&&Number(v.maxSoc)<=100&&Number(v.minSoc)<Number(v.maxSoc)&&['internal','external'].includes(String(v.control))&&typeof v.externalConnected==='boolean'&&typeof v.source==='string'&&optional(v,['maxSeries','maxParallel'])}
export function validTermination(v:unknown):v is Termination{return object(v)&&optional(v,['studMm','cableDiameterMm'])&&['hardwareId','matingFamily'].every(k=>v[k]===undefined||typeof v[k]==='string')&&(v.matingGender===undefined||['socket','plug'].includes(String(v.matingGender)))&&(v.conductorClass===undefined||[2,5,6].includes(Number(v.conductorClass)))}
export function validEngineering(v:unknown):v is Engineering {
  if(!object(v)||!['ZA','GB','US'].includes(String(v.region)))return false
  if(v.earthing===undefined)return true
  const e=v.earthing
  return object(e)&&['TN','TT','IT'].includes(String(e.scheme))&&positive(e.voltage)&&positive(e.touchVoltage)&&optional(e,['loopOhm','disconnectA','electrodeOhm','residualA','faultA','clearingSeconds','k'])&&typeof e.source==='string'&&Array.isArray(e.neutralBondIds)&&e.neutralBondIds.length<=500&&e.neutralBondIds.every(id=>typeof id==='string')
}

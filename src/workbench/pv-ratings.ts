import type {Spec} from './model'
export function pvVocAtTemperature(s:Spec,temperature:number):number{return s.voc*Math.max(.01,1+(s.vocTemperatureCoefficientPerC??-.0029)*(temperature-25))}
export function pvIscAtTemperature(s:Spec,temperature:number):number{return s.isc*Math.max(.01,1+(s.iscTemperatureCoefficientPerC??0)*(temperature-25))}
/** A generic single-diode fit through sourced Vmp/Imp; no shading or series/shunt model. */
export function pvDiodeScale(s:Spec,temperature:number):number{
 const imp=s.mppCurrent
 if(imp!==undefined&&imp>0&&imp<s.isc&&s.voltage>0&&s.voltage<s.voc){
  const a=(s.voc-s.voltage)/Math.log(s.isc/(s.isc-imp))
  if(Number.isFinite(a)&&a>0)return Math.max(.05,a*(temperature+273.15)/298.15)
 }
 return Math.max(1,pvVocAtTemperature(s,temperature)*.065)
}

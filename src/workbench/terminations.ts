import type {Project,Wire} from './model'
import type {Termination} from './engineering-model'
import {awgArea} from './ampacity'
const klauke='https://www.klauke.com/gb/en/tubular-cable-lugs-cu-standard-type-4957'
const staubli='https://www.staubli.com/content/dam/ecs/catalogs-brochures/RE/SOL-MC4-Evo-2-11014101-en.pdf'
export type Hardware={id:string;name:string;source:string;kind:'lug'|'pv';areas:number[];studMm?:number;conductorClass?:number;diameter?:[number,number];gender?:'socket'|'plug';amps?:number[];usAreas?:number[];usAmps?:number[];volts?:number}
const lugRows:Array<[number,number,number[]]>=[[6,1,[6,8,10]],[10,2,[6,8,10]],[16,3,[6,8,10]],[25,4,[6,8,10]],[35,5,[6,8,10]],[50,6,[6,8,10]],[70,7,[6,8,10]],[95,8,[8,10]],[120,9,[8,10]],[150,10,[8,10]],[185,11,[10]],[240,12,[10]]]
export const TERMINATION_HARDWARE:Hardware[]=[
 ...lugRows.flatMap(([area,part,studs])=>studs.map(studMm=>({id:`klauke-${part}R${studMm}`,name:`Klauke ${part}R${studMm} / ${area} mm² M${studMm}`,source:klauke,kind:'lug' as const,areas:[area],studMm,conductorClass:2}))),
 ...([[16,'socket',[4.7,6.4]],[17,'plug',[4.7,6.4]],[18,'socket',[5.9,7.3]],[19,'plug',[5.9,7.3]],[20,'socket',[6.4,8.4]],[21,'plug',[6.4,8.4]]] as const).map(([part,gender,diameter])=>({id:`staubli-32.03${part}P0001`,name:`Stäubli 32.03${part}P0001 / MC4-Evo 2A ${gender}`,source:staubli,kind:'pv' as const,areas:[4,6],usAreas:[awgArea('12'),awgArea('10')],usAmps:[39,50],amps:[45,53],volts:1500,diameter:[...diameter] as [number,number],gender}))
]
export function terminationAssessment(project:Project,wire:Wire,end:'from'|'to'){
 const t:Termination|undefined=wire.terminations?.[end],part=TERMINATION_HARDWARE.find(h=>h.id===t?.hardwareId),issues:string[]=[]
 if(!part)return {part,issues:['Select exact end hardware; the terminal variant has not been established.']}
 if(wire.material!=='copper')issues.push('Selected hardware is for copper conductors.')
 if(part.kind==='lug'){
  if(!part.areas.includes(wire.area))issues.push('Lug barrel does not match conductor cross-section.')
  if(t?.studMm!==part.studMm)issues.push('Confirm the actual terminal stud diameter matches the lug hole.')
  if(t?.conductorClass!==part.conductorClass)issues.push('This lug is sourced for class 2 stranded copper; select the actual conductor class.')
 }else{
  const us=project.engineering?.region==='US',areas=us?part.usAreas!:part.areas,ix=areas.findIndex(a=>Math.abs(a-wire.area)<.001)
  if(ix<0)issues.push('Connector crimp contact does not match the selected conductor size.')
  const current=wire.installation?.designCurrent
  if(current===undefined)issues.push('Design current is required to assess connector current rating.')
  else if(ix>=0&&current>(us?part.usAmps!:part.amps!)[ix])issues.push('Design current exceeds this contact rating at reference conditions.')
  if(!t?.cableDiameterMm||t.cableDiameterMm<part.diameter![0]||t.cableDiameterMm>part.diameter![1])issues.push(`Cable outer diameter must be ${part.diameter!.join('–')} mm.`)
  if(t?.matingFamily!=='Stäubli MC4-Evo 2A')issues.push('Confirm the actual factory connector is Stäubli MC4-Evo 2A; a generic MC4 label does not establish compatibility.')
  if(t?.matingGender===undefined||t.matingGender===part.gender)issues.push('Select the opposite mating contact gender at the equipment terminal.')
 }
 return {part,issues}
}

import { wireResistance, type Wire, type Project } from './model'
import {sizeAmpacity} from './ampacity'

export type DesignSizingPath={wireIds:string[];current:number;voltage:number;fraction:number;temperature:number;label:string;minimumArea:number}

export function sizePlacedDesign(project:Project,paths:DesignSizingPath[]):Project {
  const next=structuredClone(project),wires=new Map(next.wires.map(w=>[w.id,w]))
  for(const path of paths){
    const conductors=path.wireIds.map(id=>wires.get(id)!)
    const previous=conductors.map(w=>w.area)
    sizeVoltageDropPath(conductors,path.current,path.voltage,path.fraction,path.temperature,path.label,path.minimumArea)
    conductors.forEach((wire,i)=>{wire.area=Math.max(previous[i],wire.area)})
    if(next.engineering)sizeAmpacity(conductors,next.engineering.region,path.current,Math.max(0,...conductors.map(w=>next.devices.find(d=>d.id===w.installation?.protectionId)?.spec.rating??0)))
  }
  const branches=paths.filter(path=>path.label==='Parallel battery branch').map(path=>path.wireIds.map(id=>wires.get(id)!))
  if(branches.length>1){
    const area=Math.max(...branches.flat().map(w=>w.area))
    branches.flat().forEach(w=>{w.area=area})
    const resistance=(branch:Wire[])=>branch.reduce((sum,w)=>sum+wireResistance(w,next.ambient),0)
    const target=Math.max(...branches.map(resistance))
    for(const branch of branches){
      const wire=branch.at(-1)!,extra=Math.max(0,(target-resistance(branch))/wireResistance({...wire,length:1,contactMilliOhm:0},next.ambient))
      wire.slack=(wire.slack??0)+extra;wire.length+=extra
    }
  }
  return next
}

const copperAreas = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240]

/** Size the complete outgoing/return path using the same resistance model as the sandbox.
 * This establishes a voltage-drop constraint, not installation ampacity compliance.
 */
export function sizeVoltageDropPath(wires: Wire[], current: number, voltage: number, fraction: number, temperature: number, label: string, minimumArea = 1.5): number {
  if (!wires.length || ![current, voltage, fraction, temperature].every(Number.isFinite) || current <= 0 || voltage <= 0 || fraction <= 0) throw new Error(`Invalid ${label} sizing inputs.`)
  const area = copperAreas.find(area => area >= minimumArea && current * wires.reduce((sum, wire) => sum + wireResistance({ ...wire, area }, temperature), 0) <= voltage * fraction)
  if (area === undefined) throw new Error(`${label}: no available conductor up to 240 mm² meets the ${(fraction * 100).toFixed(0)}% voltage-drop target. Shorten the route or revise the system architecture.`)
  wires.forEach(wire => { wire.area = area })
  return area
}

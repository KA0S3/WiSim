import { activeAt, scheduleDemand } from './appliances'
import type { Appliance, Requirements } from './model'

export type PhaseDesign = { name: string; angle: number; inverterW: number; demandW: number; startupW: number; appliances: Appliance[] }

export function designPhases(r: Requirements): PhaseDesign[] {
  if (!['single', 'split', 'three'].includes(r.phases)) throw new Error('Choose single, split or three-phase output.')
  if (r.phases === 'split' && r.region !== 'US') throw new Error('The split-phase designer uses the US 120/240 V profile. Select United States for split-phase output.')
  const count = r.phases === 'single' ? 1 : r.phases === 'split' ? 2 : 3
  const phases: PhaseDesign[] = Array.from({ length: count }, (_, i) => ({ name: 'ABC'[i], angle: i * (r.phases === 'split' ? 180 : 120), inverterW: 0, demandW: 0, startupW: 0, appliances: [] }))
  const appliances = [...(r.appliances ?? [])].sort((a, b) => b.watts * b.quantity - a.watts * a.quantity)
  for (const appliance of appliances) {
    const phase = appliance.phase === 'auto' ? [...phases].sort((a, b) => a.demandW - b.demandW)[0] : phases.find(item => item.name === appliance.phase)
    if (!phase) throw new Error(`${appliance.name} uses phase ${appliance.phase}, which is unavailable in this design.`)
    phase.appliances.push(appliance)
    const demand = scheduleDemand(phase.appliances)
    phase.demandW = demand.peakW; phase.startupW = demand.startupW
    // Resetting or selecting a schedule hour starts all enabled motors together.
    for(const hour of [0,...phase.appliances.flatMap(a=>[a.startHour,a.endHour%24])])phase.startupW=Math.max(phase.startupW,phase.appliances.filter(a=>activeAt(a.startHour,a.endHour,hour)).reduce((sum,a)=>sum+a.watts*a.quantity*(a.startupSeconds>0?a.startupMultiplier:1),0))
  }
  const margin = 1 + r.reserve / 100 + (r.priority === 'headroom' ? .2 : 0)
  for (const phase of phases) {
    if (!appliances.length) { phase.demandW = r.peakW / count; phase.startupW = phase.demandW }
    const rating = [1000, 2000, 3000, 5000, 8000, 12000].find(watts => watts >= Math.max(phase.demandW, phase.appliances.some(a=>a.startupSeconds>=2)?phase.startupW:0) * margin && watts * 2 >= phase.startupW * margin)
    if (!rating) throw new Error(`Phase ${phase.name} exceeds the available 12 kW continuous / 24 kW startup generic inverter range. Reassign demand across phases or revise appliances.`)
    phase.inverterW = rating
  }
  return phases
}

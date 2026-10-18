import type { SimulationProject, SimulationResult } from './simulation'

export type Scenario = {
  id: string
  title: string
  track: 'Foundations' | 'Solar' | 'Storage' | 'Troubleshooting'
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  objective: string
  hint: string
  success: string
  xp: number
}

export const SCENARIOS: Scenario[] = [
  { id: 'low-voltage', title: 'Low voltage shutdown', track: 'Foundations', difficulty: 'Beginner', objective: 'Find why the inverter input falls below its safe operating range.', hint: 'Inspect load demand and the complete positive/return cable path.', success: 'The simulated inverter remains above its configured low-voltage threshold.', xp: 100 },
  { id: 'cold-voc', title: 'Cold weather Voc', track: 'Solar', difficulty: 'Beginner', objective: 'Check whether a cold PV string exceeds controller input limits.', hint: 'Lower the cell temperature and watch the cold Voc reading.', success: 'The selected controller has safe cold-weather headroom.', xp: 100 },
  { id: 'fuse-selection', title: 'Fuse selection', track: 'Troubleshooting', difficulty: 'Intermediate', objective: 'Choose protection that is not exceeded by the modeled current.', hint: 'Compare the current reading with the fuse rating.', success: 'Protection current remains within the configured value.', xp: 150 },
  { id: 'charge-limit', title: 'Battery charge limit', track: 'Storage', difficulty: 'Intermediate', objective: 'Keep modeled charging within the battery profile.', hint: 'Use irradiance and controller limits to reduce charge current.', success: 'The battery charge limit is respected without hiding the evidence.', xp: 150 },
  { id: 'pump-surge', title: 'Pump startup surge', track: 'Troubleshooting', difficulty: 'Intermediate', objective: 'Make room for a short startup demand without an unnecessary steady overload.', hint: 'Compare continuous and startup demand separately.', success: 'The pump starts within the modeled surge capability.', xp: 175 },
  { id: 'cable-drop', title: 'Cable voltage drop', track: 'Foundations', difficulty: 'Advanced', objective: 'Reduce loss on a high-current cable run.', hint: 'Increase area or shorten the complete circuit path.', success: 'Voltage drop is reduced and the evidence explains why.', xp: 200 },
  { id: 'parallel-strings', title: 'Parallel string balance', track: 'Solar', difficulty: 'Intermediate', objective: 'Compare current contribution from two PV branches.', hint: 'Keep branch assumptions visible before combining them.', success: 'Both branches remain within their modeled current limits.', xp: 150 },
  { id: 'reverse-polarity', title: 'Reverse polarity check', track: 'Troubleshooting', difficulty: 'Beginner', objective: 'Identify an unsafe polarity before running the network.', hint: 'Start at the terminal markers, not the component label.', success: 'The invalid connection is corrected and explained.', xp: 100 },
  { id: 'controller-voc', title: 'Controller PV limit', track: 'Solar', difficulty: 'Intermediate', objective: 'Choose a string layout that stays below absolute PV input voltage.', hint: 'Cold Voc is higher than the nameplate operating voltage.', success: 'The string stays below the controller absolute limit.', xp: 150 },
  { id: 'battery-chemistry', title: 'Chemistry profile', track: 'Storage', difficulty: 'Beginner', objective: 'Select a battery profile that matches the intended charge limits.', hint: 'LiFePO₄ and lead-acid are not interchangeable rules.', success: 'Charge and discharge assumptions match the selected chemistry.', xp: 100 },
  { id: 'inverter-efficiency', title: 'Inverter efficiency', track: 'Foundations', difficulty: 'Beginner', objective: 'Account for DC input power instead of using AC demand directly.', hint: 'Input demand is higher than output demand when efficiency is below 100%.', success: 'The battery current reflects conversion loss.', xp: 100 },
  { id: 'shunt-placement', title: 'Shunt placement', track: 'Storage', difficulty: 'Intermediate', objective: 'Place the monitor so modeled current is measurable.', hint: 'A shunt should see the relevant return current.', success: 'The monitored path includes the intended loads and chargers.', xp: 150 },
  { id: 'generator-input', title: 'Generator input', track: 'Troubleshooting', difficulty: 'Advanced', objective: 'Match an AC source to the inverter/charger input assumptions.', hint: 'Nominal voltage and frequency are separate checks.', success: 'The source is accepted with any remaining assumptions called out.', xp: 200 },
  { id: 'thermal-estimate', title: 'Cable thermal estimate', track: 'Foundations', difficulty: 'Advanced', objective: 'Reduce sustained I²R loss in a long cable run.', hint: 'Heat follows loss, not the cable label alone.', success: 'The illustrative temperature trend moves in the safer direction.', xp: 200 },
  { id: 'load-profile', title: 'Load profile basics', track: 'Solar', difficulty: 'Beginner', objective: 'Match a steady load profile to the available generation.', hint: 'Compare source power, conversion demand and load demand.', success: 'The modeled source can support the selected steady load.', xp: 100 },
]

export type ScenarioEvaluation = { passed: boolean; evidence: string }

export function createScenarioProject(id: string, base: SimulationProject): SimulationProject {
  const project: SimulationProject = JSON.parse(JSON.stringify(base))
  project.scenario = { id, baseProjectId: 'local-current' }
  const load = project.nodes.find(node => node.kind === 'load')
  const cable = project.nodes.find(node => node.kind === 'cable')
  const fuse = project.nodes.find(node => node.kind === 'fuse')
  if (id === 'low-voltage' && load) load.watts = Math.max(load.watts ?? 120, 1800)
  if (id === 'cold-voc') project.temperature = -10
  if (id === 'fuse-selection' && fuse) fuse.watts = 5
  if (id === 'pump-surge' && load) { load.watts = 500; load.surge = 5 }
  if (id === 'cable-drop' && cable) { cable.area = 4; cable.length = 30 }
  if (id === 'controller-voc') project.temperature = -15
  if (id === 'generator-input') { project.acProfile = '230v-50hz'; project.acSourceVoltage = 120; project.acSourceFrequency = 60 }
  return project
}

export function evaluateScenario(id: string, result: SimulationResult): ScenarioEvaluation {
  const hasFault = result.diagnostics.some(event => event.severity === 'fault')
  const evaluations: Record<string, ScenarioEvaluation> = {
    'low-voltage': { passed: !result.overload && result.topologyValid, evidence: `Modeled DC demand is ${Math.round(result.inputPower)} W and the topology is ${result.topologyValid ? 'connected' : 'incomplete'}.` },
    'cold-voc': { passed: result.coldVoc < 100, evidence: `Cold-weather Voc is ${result.coldVoc.toFixed(1)} V against the simplified 100 V teaching limit.` },
    'fuse-selection': { passed: !result.diagnostics.some(event => event.id === 'protection-current'), evidence: `Estimated current is ${result.batteryCurrent.toFixed(1)} A; no modeled protection-current fault is active.` },
    'charge-limit': { passed: !result.controllerLimited, evidence: result.controllerLimited ? 'The controller is clipping available PV power.' : 'The modeled controller cap is not exceeded.' },
    'pump-surge': { passed: !result.overload, evidence: `Continuous modeled demand is ${Math.round(result.demand)} W with no inverter overload.` },
    'cable-drop': { passed: result.voltageDrop < 0.5, evidence: `Simplified positive/return voltage drop is ${result.voltageDrop.toFixed(2)} V.` },
    'parallel-strings': { passed: result.topologyValid && !hasFault, evidence: 'The connected network has no active modeled fault.' },
    'reverse-polarity': { passed: result.topologyValid, evidence: 'No disconnected terminal path is currently reported.' },
    'controller-voc': { passed: result.coldVoc < 100 && !result.controllerLimited, evidence: `Cold Voc is ${result.coldVoc.toFixed(1)} V and the controller is ${result.controllerLimited ? 'limited' : 'within the teaching limit'}.` },
    'battery-chemistry': { passed: Boolean(result.soc >= 8 && result.soc <= 100), evidence: `The illustrative battery SOC is ${Math.round(result.soc)}%.` },
    'inverter-efficiency': { passed: result.inputPower > result.demand, evidence: `DC input is ${Math.round(result.inputPower)} W for ${Math.round(result.demand)} W AC demand.` },
    'shunt-placement': { passed: result.topologyValid, evidence: 'The current project topology is connected for monitoring.' },
    'generator-input': { passed: result.topologyValid && !hasFault, evidence: 'The connected project has no active modeled fault.' },
    'thermal-estimate': { passed: result.cableLoss < 10, evidence: `Illustrative cable loss is ${result.cableLoss.toFixed(2)} W.` },
    'load-profile': { passed: result.pvPower >= result.demand, evidence: `Modeled PV output is ${Math.round(result.pvPower)} W for ${Math.round(result.demand)} W demand.` },
  }
  return evaluations[id] ?? { passed: false, evidence: 'This scenario has no evaluation rule yet.' }
}

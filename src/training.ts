export type TrainingLesson = {
  id: string
  title: string
  prompt: string
  options: string[]
  answer: number
  explanation: string
  hint: string
}

export type TrainingTrack = {
  id: string
  name: string
  description: string
  lessons: TrainingLesson[]
}

export type DesignLesson = { id: string; title: string; requirement: string; profile: '120v-60hz' | '230v-50hz' | 'split-120-240v-60hz' | 'three-phase-400v-50hz'; maxDemand: number; maxSurge: number; minimumSolar: number; minimumRuntimeSeconds: number; minimumEnergyWh: number }

export const DESIGN_LESSONS: DesignLesson[] = [
  { id: 'pv-backup-230v', title: 'Build a dependable 230 V backup', requirement: 'Support a 600 W essential load with 230 V / 50 Hz output, enough PV headroom, 30 seconds of modeled runtime, and no overload.', profile: '230v-50hz', maxDemand: 600, maxSurge: 1200, minimumSolar: 600, minimumRuntimeSeconds: 30, minimumEnergyWh: 5 },
  { id: 'split-phase-baseline', title: 'Inspect a split-phase requirement', requirement: 'Choose a split-phase profile and make the terminal limitation visible rather than fabricating a three-wire result.', profile: 'split-120-240v-60hz', maxDemand: 1000, maxSurge: 2000, minimumSolar: 1000, minimumRuntimeSeconds: 0, minimumEnergyWh: 0 },
]

export type DesignLessonEvaluation = { passed: boolean; evidence: string }

import type { SimulationProject, SimulationResult } from './simulation'

export function evaluateDesignLesson(id: string, project: SimulationProject, result: SimulationResult): DesignLessonEvaluation {
  const lesson = DESIGN_LESSONS.find(item => item.id === id)
  if (!lesson) return { passed: false, evidence: 'This design lesson is not defined.' }
  const profile = project.acProfile === lesson.profile
  const demand = result.demand <= lesson.maxDemand
  const surge = result.surgeDemand <= lesson.maxSurge
  const solar = result.pvPower >= lesson.minimumSolar
  const topology = result.topologyValid && result.network.unsupported.length === 0
  const runtime = result.runtimeSeconds >= lesson.minimumRuntimeSeconds
  const energy = result.demand * result.runtimeSeconds / 3600 >= lesson.minimumEnergyWh
  return { passed: profile && demand && surge && solar && topology && runtime && energy && !result.overload, evidence: `Profile ${profile ? 'matches' : 'does not match'}; demand ${Math.round(result.demand)}/${lesson.maxDemand} W; surge ${Math.round(result.surgeDemand)}/${lesson.maxSurge} W; PV ${Math.round(result.pvPower)}/${lesson.minimumSolar} W; runtime ${Math.round(result.runtimeSeconds)}/${lesson.minimumRuntimeSeconds} s; energy ${(result.demand * result.runtimeSeconds / 3600).toFixed(1)}/${lesson.minimumEnergyWh} Wh; topology ${topology ? 'supported' : 'incomplete'}.` }
}

export const TRAINING_TRACKS: TrainingTrack[] = [
  {
    id: 'basics', name: 'Electrical basics', description: 'Read voltage, current and power as one system.', lessons: [
      { id: 'basics-power', title: 'Power relationship', prompt: 'A 12 V load draws 10 A. What is its approximate DC power?', options: ['1.2 W', '120 W', '1,200 W'], answer: 1, explanation: 'Power is voltage × current: 12 × 10 = 120 W.', hint: 'Multiply volts by amps.' },
      { id: 'basics-drop', title: 'Voltage drop', prompt: 'Which change usually reduces cable voltage drop at the same current?', options: ['Use a smaller conductor', 'Shorten the run or increase conductor area', 'Increase contact resistance'], answer: 1, explanation: 'Resistance falls when the conductor is larger or the loop is shorter.', hint: 'Think about resistance in the complete path.' },
      { id: 'basics-safety', title: 'Evidence first', prompt: 'When a simulator reports a fault, what should you inspect first?', options: ['The measured evidence and active threshold', 'A guessed component brand', 'The canvas colour alone'], answer: 0, explanation: 'The measured value and rule identify the next useful check.', hint: 'Start with the number that triggered the event.' },
    ]
  },
  {
    id: 'solar', name: 'Solar generation', description: 'Understand irradiance, temperature and MPPT limits.', lessons: [
      { id: 'solar-voc', title: 'Cold Voc', prompt: 'With a negative Voc temperature coefficient, what happens as cells get colder?', options: ['Voc rises', 'Voc falls', 'Voc becomes zero'], answer: 0, explanation: 'A negative coefficient means lower temperature increases open-circuit voltage.', hint: 'Cold weather can create a higher voltage than the label.' },
      { id: 'solar-mppt', title: 'Controller limits', prompt: 'If available PV power exceeds the controller rating, what should a behavioural model show?', options: ['Unlimited output', 'Clipped/limited output with evidence', 'The battery instantly fails'], answer: 1, explanation: 'An MPPT can cap usable power; the surplus should remain visible as a limit.', hint: 'The controller is a bottleneck, not a magic multiplier.' },
      { id: 'solar-irradiance', title: 'Irradiance', prompt: 'What normally happens to PV output when irradiance is reduced?', options: ['Output decreases', 'Output always doubles', 'Only cable temperature changes'], answer: 0, explanation: 'The simplified source model scales available PV power with irradiance.', hint: 'Less sunlight means less available power.' },
    ]
  },
  {
    id: 'storage', name: 'Storage & batteries', description: 'Use chemistry, SOC and current limits responsibly.', lessons: [
      { id: 'storage-soc', title: 'State of charge', prompt: 'During a sustained net load with no charging, battery SOC should generally…', options: ['Rise', 'Fall', 'Stay fixed regardless of time'], answer: 1, explanation: 'SOC changes with net energy flow over simulated time.', hint: 'A battery supplying a load is discharging.' },
      { id: 'storage-limit', title: 'Charge current', prompt: 'If a battery charge limit is lower than available controller current, what is the safe model response?', options: ['Cap charging and show the limit', 'Hide the extra current', 'Ignore the configured battery profile'], answer: 0, explanation: 'The configured battery limit constrains charging and should produce visible evidence.', hint: 'Limits should affect the operating point, not disappear.' },
      { id: 'storage-chemistry', title: 'Chemistry profile', prompt: 'Why should LiFePO₄ and lead-acid use separate battery assumptions?', options: ['Their charge/discharge behaviour and limits differ', 'Chemistry only changes the icon', 'They always share identical limits'], answer: 0, explanation: 'Chemistry affects the educational charge and discharge boundaries.', hint: 'The profile is part of the model.' },
    ]
  },
  {
    id: 'troubleshooting', name: 'Troubleshooting', description: 'Turn symptoms into measured, testable fixes.', lessons: [
      { id: 'trouble-surge', title: 'Startup demand', prompt: 'How should a short motor startup event differ from continuous demand?', options: ['It is a separate surge check', 'It permanently replaces steady demand', 'It should be ignored'], answer: 0, explanation: 'Startup surge and steady operation test different limits.', hint: 'A brief event is not the same as running power.' },
      { id: 'trouble-topology', title: 'Disconnected path', prompt: 'If a component is disconnected from the source-to-load network, what should the app do?', options: ['Pretend it is powered', 'Explain that it is outside the active topology', 'Delete it silently'], answer: 1, explanation: 'Unsupported or disconnected layouts must be visible rather than showing invented readings.', hint: 'Visibility is safer than a plausible fake result.' },
      { id: 'trouble-interface', title: 'Communication links', prompt: 'Does sharing a manufacturer name prove that two devices can communicate?', options: ['Yes, always', 'No; the supported interface and device roles must match', 'Only if the wire is blue'], answer: 1, explanation: 'Compatibility is based on explicit supported interfaces and roles.', hint: 'Brand matching is not an interface rule.' },
    ]
  },
]

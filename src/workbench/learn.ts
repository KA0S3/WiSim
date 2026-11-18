import { blankProject, connect, makeDevice, uid, type Frame, type Project } from './model'

export type LearnRequirement = {
  id: string
  label: string
  check: (project: Project, frame: Frame | null | undefined, sample: Record<string, number>) => boolean
  evidence: (project: Project, frame: Frame | null | undefined, sample: Record<string, number>) => string
}

export type LearnScenarioDefinition = {
  id: string
  title: string
  client: string
  summary: string
  difficulty: 'Beginner' | 'Ready' | 'Advanced'
  ranges: Record<string, [number, number]>
  requirements: LearnRequirement[]
  task:'build'|'repair'
}

export type LearnDifficulty = LearnScenarioDefinition['difficulty']
export type LearnProgressState = {
  completedScenarioIds: string[]
  completedByDifficulty: Record<LearnDifficulty, string[]>
  completionCounts: Record<string, number>
  totalCompletions: number
}

export type LearnSessionState = {
  scenarioId: string
  runId: string
  sample: Record<string, number>
  startedAt: number
  completed: boolean
  completedAt?: number
  achievement?: string
}

export type LearnScenarioEvaluation = {
  allPassed: boolean
  checklist: Array<{ id: string; label: string; passed: boolean; evidence: string }>
  completed: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const lookup = (sample: Record<string, number>, key: string, fallback: number) => sample[key] ?? fallback
const deviceByKind = (project: Project, kind: 'pv' | 'mppt' | 'battery' | 'inverter' | 'load') => project.devices.find(device => device.kind === kind || kind==='load'&&['motor','dc-load'].includes(device.kind))
const powerOf = (project: Project, kind: 'pv' | 'mppt' | 'battery' | 'inverter' | 'load', frame: Frame | null | undefined) => {
  return project.devices.filter(device=>device.kind===kind||kind==='load'&&['motor','dc-load'].includes(device.kind)).reduce((total,device)=>{
    const power=kind==='inverter'||kind==='mppt'||!frame?device.spec.watts||0:Math.abs(frame.devices[device.id]?.power??0)
    return total+power
  },0)
}

const requirePowerBalance = (project: Project, frame: Frame | null | undefined, sample: Record<string, number>, key: 'pv' | 'mppt' | 'battery' | 'inverter' | 'load', minimum: number) => {
  const power = powerOf(project, key, frame)
  return power >= minimum
}

const scenario = (
  id: string,
  title: string,
  client: string,
  summary: string,
  difficulty: 'Beginner' | 'Ready' | 'Advanced',
  ranges: Record<string, [number, number]>,
  requirementList: LearnRequirement[],
): LearnScenarioDefinition => ({ id, title, client, summary, difficulty, ranges, requirements: requirementList,task:difficulty==='Beginner'?'build':'repair' })

const CORE_LEARN_SCENARIOS: LearnScenarioDefinition[] = [
  scenario('sunrise-solar-balance', 'Sunrise solar balance', 'Remote clinic', 'Keep the clinic load covered during a cool morning with a modest battery reserve.', 'Beginner', { sun: [62, 84], ambient: [12, 28], loadWatts: [500, 900], pvWatts: [680, 1200], soc: [40, 80], mpptWatts: [760, 1400] }, [
    { id: 'pv-coverage', label: 'PV generation covers the morning load', check: (project, frame, sample) => requirePowerBalance(project, frame, sample, 'pv', lookup(sample, 'loadWatts', 720) * 1.1), evidence: (project, frame) => `PV output is ${powerOf(project, 'pv', frame).toFixed(0)} W against the ${powerOf(project, 'load', frame).toFixed(0)} W load.` },
    { id: 'controller-limit', label: 'MPPT headroom stays ahead of the array output', check: (project, frame) => powerOf(project, 'mppt', frame) >= powerOf(project, 'pv', frame) * 0.85, evidence: (project, frame) => `MPPT rating is ${powerOf(project, 'mppt', frame).toFixed(0)} W while the PV array shows ${powerOf(project, 'pv', frame).toFixed(0)} W.` },
    { id: 'battery-reserve', label: 'Battery reserve sits within the safe operating window', check: (project, frame, sample) => { const battery = deviceByKind(project, 'battery'); return !!battery && (project.initialSoc ?? 50) >= lookup(sample, 'soc', 50) * 0.7 && (project.initialSoc ?? 50) <= 95 }, evidence: (project) => `The battery start state is ${project.initialSoc.toFixed(0)}% and remains within the scenario window.` },
  ]),
  scenario('battery-charge-window', 'Battery charge window', 'Off-grid cabin', 'Check the charge current stays inside the allowed charging band for the cabin battery.', 'Ready', { sun: [60, 92], ambient: [20, 34], loadWatts: [350, 650], pvWatts: [520, 980], soc: [35, 75], batteryAh: [70, 180], chargeVoltage: [13.8, 14.8] }, [
    { id: 'charge-setting', label: 'Battery charge voltage remains in range', check: (project) => { const battery = deviceByKind(project, 'battery'); return !!battery && (battery.spec.chargeVoltage === undefined || battery.spec.chargeVoltage >= 13.6 && battery.spec.chargeVoltage <= 14.8) }, evidence: (project) => `Battery charge setting is ${deviceByKind(project, 'battery')?.spec.chargeVoltage?.toFixed(2) ?? 'not set'} V.` },
    { id: 'pv-array-load', label: 'PV production remains above the household demand', check: (project, frame, sample) => requirePowerBalance(project, frame, sample, 'pv', lookup(sample, 'loadWatts', 500) * 1.08), evidence: (project, frame) => `PV input is ${powerOf(project, 'pv', frame).toFixed(0)} W and the cabin demand is ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'soc-health', label: 'Battery state of charge stays within the healthy range', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 85, evidence: (project) => `Initial state of charge is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('three-phase-farm-load', 'Three-phase farm load', 'Farm workshop', 'Match the workshop loads to a balanced three-phase source without distorting the profile assumptions.', 'Advanced', { sun: [50, 78], ambient: [15, 28], loadWatts: [1500, 2800], inverterWatts: [1800, 3200], sourceVoltage: [210, 240], frequency: [48, 52] }, [
    { id: 'ac-profile', label: 'AC profile matches a stable single-phase or three-phase assumption', check: (project) => { const inverter = deviceByKind(project, 'inverter'); return !!inverter && inverter.spec.voltage >= 210 && inverter.spec.voltage <= 240 }, evidence: (project) => `The inverter AC voltage is ${deviceByKind(project, 'inverter')?.spec.voltage.toFixed(0) ?? 0} V.` },
    { id: 'demand-within-rating', label: 'Load demand fits inside the inverter rating', check: (project, frame) => powerOf(project, 'inverter', frame) >= powerOf(project, 'load', frame) * 1.15, evidence: (project, frame) => `Inverter rating is ${powerOf(project, 'inverter', frame).toFixed(0)} W and the load is ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'source-stability', label: 'The source frequency remains within the intended operating window', check: (project) => { const inverter = deviceByKind(project, 'inverter'); return !!inverter && inverter.spec.frequency >= 48 && inverter.spec.frequency <= 52 }, evidence: (project) => `The source operating frequency is ${deviceByKind(project, 'inverter')?.spec.frequency.toFixed(0) ?? 0} Hz.` },
  ]),
  scenario('ev-night-charge', 'Night EV charge', 'Home owner', 'A slow overnight EV charge should remain below the charging profile used by the battery system.', 'Ready', { loadWatts: [800, 1500], batteryAh: [100, 220], soc: [30, 75], ambient: [10, 28], sun: [0, 25], inverterWatts: [1500, 2600] }, [
    { id: 'night-load', label: 'Night demand still fits the battery and inverter envelope', check: (project, frame, sample) => { const load = deviceByKind(project, 'load'); const inverter = deviceByKind(project, 'inverter'); return !!load && !!inverter && (load.spec.watts <= inverter.spec.watts) && (powerOf(project, 'inverter', frame) >= powerOf(project, 'load', frame) * 1.1) }, evidence: (project, frame) => `The load is ${powerOf(project, 'load', frame).toFixed(0)} W and the inverter is rated at ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'battery-available', label: 'The battery has enough reserve for overnight demand', check: (project) => (project.initialSoc ?? 50) >= 25 && (project.initialSoc ?? 50) <= 90, evidence: (project) => `Battery initial state of charge is ${project.initialSoc.toFixed(0)}%.` },
    { id: 'ambient-window', label: 'Outdoor temperature stays in the expected operating band', check: (project) => project.ambient >= -5 && project.ambient <= 35, evidence: (project) => `Ambient temperature is ${project.ambient.toFixed(0)} °C.` },
  ]),
  scenario('cooling-loop', 'Cooling loop', 'Office server room', 'Check the cooling loop is sized to match a server rack’s heat load without exposing the conversion stage.', 'Advanced', { ambient: [20, 32], loadWatts: [500, 1200], inverterWatts: [1200, 2200], pvWatts: [600, 1400], soc: [45, 90] }, [
    { id: 'rack-load', label: 'The server rack load falls inside the inverter rating', check: (project, frame) => { const inverter = deviceByKind(project, 'inverter'); const load = deviceByKind(project, 'load'); return !!inverter && !!load && Math.max(load.spec.watts, powerOf(project, 'load', frame)) <= inverter.spec.watts }, evidence: (project, frame) => `Load is ${powerOf(project, 'load', frame).toFixed(0)} W against an inverter rating of ${powerOf(project,'inverter',null).toFixed(0)} W.` },
    { id: 'pv-headroom', label: 'PV supply maintains a comfortable margin over the cooling demand', check: (project, frame) => powerOf(project, 'pv', frame) >= 1.2 * powerOf(project, 'load', frame), evidence: (project, frame) => `PV output is ${powerOf(project, 'pv', frame).toFixed(0)} W and the cooling load is ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'reserve-thermal', label: 'The battery reserve is large enough for the sample operation', check: (project) => (project.initialSoc ?? 50) >= 35, evidence: (project) => `Battery reserve is ${project.initialSoc.toFixed(0)}% at start.` },
  ]),
  scenario('microgrid-night', 'Microgrid night mode', 'School campus', 'The campus battery must continue to serve a steady evening draw while keeping a margin for startup.', 'Ready', { sun: [0, 18], ambient: [8, 26], loadWatts: [1200, 2500], batteryAh: [140, 280], soc: [35, 75], inverterWatts: [1800, 3000] }, [
    { id: 'night-battery', label: 'Battery reserve remains within the nightly operating window', check: (project) => (project.initialSoc ?? 50) >= 25 && (project.initialSoc ?? 50) <= 80, evidence: (project) => `Night reserve begins at ${project.initialSoc.toFixed(0)}%.` },
    { id: 'campus-load', label: 'The campus demand stays within the inverter power envelope', check: (project, frame) => { const load = deviceByKind(project, 'load'); const inverter = deviceByKind(project, 'inverter'); return !!load && !!inverter && load.spec.watts <= inverter.spec.watts && powerOf(project, 'load', frame) <= inverter.spec.watts }, evidence: (project, frame) => `Demand is ${powerOf(project, 'load', frame).toFixed(0)} W against an inverter rating of ${powerOf(project,'inverter',null).toFixed(0)} W.` },
    { id: 'sunset-safety', label: 'No PV output is required for this night-time scenario', check: (project, frame) => powerOf(project, 'pv', frame) <= 200, evidence: (project, frame) => `PV output is ${powerOf(project, 'pv', frame).toFixed(0)} W under night conditions.` },
  ]),
  scenario('dense-urban-heat', 'Dense urban heat', 'Building services', 'A small urban system must keep a cooling compressor inside a workable power envelope.', 'Ready', { ambient: [24, 38], loadWatts: [600, 1400], pvWatts: [700, 1600], soc: [40, 82], inverterWatts: [1500, 2300], sun: [40, 82] }, [
    { id: 'heat-evidence', label: 'High ambient gets recorded without exceeding the sample window', check: (project) => project.ambient >= 24 && project.ambient <= 38, evidence: (project) => `Ambient is ${project.ambient.toFixed(0)} °C.` },
    { id: 'array-support', label: 'PV supply still supports the building load', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.05, evidence: (project, frame) => `PV at ${powerOf(project, 'pv', frame).toFixed(0)} W supports a ${powerOf(project, 'load', frame).toFixed(0)} W load.` },
    { id: 'inverter-coverage', label: 'The inverter remains large enough for the load', check: (project, frame) => powerOf(project, 'inverter', frame) >= powerOf(project, 'load', frame), evidence: (project, frame) => `Inverter rating ${powerOf(project, 'inverter', frame).toFixed(0)} W covers the ${powerOf(project, 'load', frame).toFixed(0)} W demand.` },
  ]),
  scenario('field-solar-team', 'Field solar team', 'Mobile field office', 'A compact office needs steady power from a light solar array without overloading the battery pack.', 'Beginner', { sun: [55, 90], ambient: [12, 30], loadWatts: [400, 900], pvWatts: [500, 1100], batteryAh: [60, 140], soc: [35, 85] }, [
    { id: 'solar-coverage', label: 'The field office is covered by the sample PV output', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.1, evidence: (project, frame) => `The array provides ${powerOf(project, 'pv', frame).toFixed(0)} W for a load of ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'battery-window', label: 'Battery storage remains within the office operating window', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 90, evidence: (project) => `Battery reserve starts at ${project.initialSoc.toFixed(0)}%.` },
    { id: 'ambient-margin', label: 'Temperature remains moderate enough for the project assumptions', check: (project) => project.ambient >= 5 && project.ambient <= 35, evidence: (project) => `Ambient temperature is ${project.ambient.toFixed(0)} °C.` },
  ]),
  scenario('mobile-farm-pump', 'Mobile farm pump', 'Irrigation line', 'A pump and a small battery pack must stay in a workable operating band through the daylight cycle.', 'Advanced', { sun: [35, 82], ambient: [14, 36], loadWatts: [700, 1500], pvWatts: [900, 1700], soc: [30, 80], inverterWatts: [1800, 2600] }, [
    { id: 'pump-load', label: 'Pump demand remains below the inverter rating', check: (project, frame) => { const inverter = deviceByKind(project, 'inverter'); const load = deviceByKind(project, 'load'); return !!inverter && !!load && powerOf(project, 'load', frame) <= inverter.spec.watts }, evidence: (project, frame) => `Pump demand is ${powerOf(project, 'load', frame).toFixed(0)} W and inverter rating is ${powerOf(project,'inverter',null).toFixed(0)} W.` },
    { id: 'array-support', label: 'The PV array covers the daytime pump load', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.18, evidence: (project, frame) => `PV is ${powerOf(project, 'pv', frame).toFixed(0)} W versus demand ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'reserve-state', label: 'Battery state remains safe throughout the sampled run', check: (project) => (project.initialSoc ?? 50) >= 20 && (project.initialSoc ?? 50) <= 85, evidence: (project) => `Battery reserve is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('windy-battery-shift', 'Windy battery shift', 'Rural gateway', 'The gateway system must still keep enough reserves during a cloudy but breezy day.', 'Ready', { sun: [25, 52], ambient: [6, 22], loadWatts: [300, 650], pvWatts: [450, 1000], soc: [30, 75], batteryAh: [100, 200], mpptWatts: [700, 1200] }, [
    { id: 'reserve-fit', label: 'The battery reserve remains usable for the scenario', check: (project) => (project.initialSoc ?? 50) >= 25 && (project.initialSoc ?? 50) <= 80, evidence: (project) => `Battery reserve is ${project.initialSoc.toFixed(0)}%.` },
    { id: 'controller-usable', label: 'The controller stays within its operating window', check: (project, frame) => powerOf(project, 'mppt', frame) >= powerOf(project, 'pv', frame) * 0.8, evidence: (project, frame) => `MPPT output is ${powerOf(project, 'mppt', frame).toFixed(0)} W while PV is ${powerOf(project, 'pv', frame).toFixed(0)} W.` },
    { id: 'demand-coverage', label: 'The sample load is covered by the available system output', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.05, evidence: (project, frame) => `PV output ${powerOf(project, 'pv', frame).toFixed(0)} W covers the load ${powerOf(project, 'load', frame).toFixed(0)} W.` },
  ]),
  scenario('sales-lab-balance', 'Sales lab balance', 'Retail outlet', 'A light retail retail space must balance midday production and the day’s load without overstating the array.', 'Beginner', { sun: [58, 88], ambient: [18, 32], loadWatts: [450, 900], pvWatts: [640, 1200], soc: [40, 88], inverterWatts: [1000, 2200] }, [
    { id: 'midday-headroom', label: 'Middle-of-day solar remains above the retail load', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.1, evidence: (project, frame) => `PV is ${powerOf(project, 'pv', frame).toFixed(0)} W and the retail demand is ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'inverter-covers', label: 'The inverter remains sized above the observed load', check: (project, frame) => powerOf(project, 'inverter', frame) >= powerOf(project, 'load', frame) * 1.05, evidence: (project, frame) => `Inverter rating is ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'warehouse-battery', label: 'Storage begins in the healthy operating band', check: (project) => (project.initialSoc ?? 50) >= 35 && (project.initialSoc ?? 50) <= 90, evidence: (project) => `Battery start is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('pico-ev-stop', 'Pico EV stop', 'EV charging bay', 'Keep the public EV bay within its rated burst and daily load assumptions.', 'Advanced', { sun: [40, 85], ambient: [15, 32], loadWatts: [800, 1800], pvWatts: [900, 1800], soc: [35, 72], inverterWatts: [2000, 3500] }, [
    { id: 'bay-demand', label: 'The bay load fits inside the inverter envelope', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.8, evidence: (project, frame) => `Load ${powerOf(project, 'load', frame).toFixed(0)} W versus inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'daytime-array', label: 'The array covers the daytime operating point', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.08, evidence: (project, frame) => `PV output ${powerOf(project, 'pv', frame).toFixed(0)} W and load demand ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'reserve-healthy', label: 'The battery reserve starts in a safe band', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 80, evidence: (project) => `Battery reserve is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('housing-morning', 'Housing morning plan', 'Apartment block', 'A morning load profile should be covered while keeping battery margin for later in the day.', 'Beginner', { sun: [35, 75], ambient: [8, 26], loadWatts: [380, 740], pvWatts: [500, 1080], soc: [30, 70], inverterWatts: [1000, 2200] }, [
    { id: 'morning-coverage', label: 'Morning PV keeps the apartment load supported', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.12, evidence: (project, frame) => `PV ${powerOf(project, 'pv', frame).toFixed(0)} W covers the apartment load ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'inverter-margins', label: 'The inverter remains large enough for the expected morning load', check: (project, frame) => powerOf(project, 'inverter', frame) >= powerOf(project, 'load', frame) * 1.1, evidence: (project, frame) => `Inverter rating ${powerOf(project, 'inverter', frame).toFixed(0)} W covers the ${powerOf(project, 'load', frame).toFixed(0)} W load.` },
    { id: 'reserve-band', label: 'Initial battery reserve remains in range', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 80, evidence: (project) => `Battery reserve is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('garden-shed', 'Garden shed', 'Small workshop', 'A small workshop should stay inside the safe solar and battery envelope with a modest midday sun boost.', 'Beginner', { sun: [60, 90], ambient: [16, 32], loadWatts: [240, 540], pvWatts: [350, 700], soc: [40, 80], inverterWatts: [600, 1400] }, [
    { id: 'shed-load', label: 'Workshop demand is safely within inverter capacity', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.8, evidence: (project, frame) => `Workshop load ${powerOf(project, 'load', frame).toFixed(0)} W fits in a ${powerOf(project, 'inverter', frame).toFixed(0)} W inverter.` },
    { id: 'daylight-coverage', label: 'Daylight PV covers the sample load', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.2, evidence: (project, frame) => `PV is ${powerOf(project, 'pv', frame).toFixed(0)} W while the load is ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'state-window', label: 'Battery state starts in the healthy range', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 85, evidence: (project) => `Battery state is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('off-grid-cabinet', 'Off-grid cabinet', 'Telecom cabinet', 'A telecom cabinet should still keep a stable load under a moderate solar window and healthy reserve.', 'Ready', { sun: [38, 68], ambient: [8, 28], loadWatts: [180, 420], pvWatts: [280, 780], soc: [30, 80], batteryAh: [90, 180], inverterWatts: [600, 1200] }, [
    { id: 'cabinet-load', label: 'The cabinet load remains below the inverter envelope', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.85, evidence: (project, frame) => `Cabinet load ${powerOf(project, 'load', frame).toFixed(0)} W sits below inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'solar-support', label: 'The solar array covers the cabinet demand', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.1, evidence: (project, frame) => `PV at ${powerOf(project, 'pv', frame).toFixed(0)} W covers demand ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'reserve-match', label: 'Battery reserve starts within an acceptable band', check: (project) => (project.initialSoc ?? 50) >= 25 && (project.initialSoc ?? 50) <= 80, evidence: (project) => `Battery reserve begins at ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('dockside-warehouse', 'Dockside warehouse', 'Logistics hub', 'A daytime logistics hub needs a roomy solar envelope and enough battery headroom to survive a cloudy hour.', 'Advanced', { sun: [50, 88], ambient: [16, 30], loadWatts: [1200, 2200], pvWatts: [1500, 2600], soc: [35, 80], inverterWatts: [1800, 3000] }, [
    { id: 'logistics-load', label: 'Warehouse demand fits in the inverter window', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.9, evidence: (project, frame) => `Load ${powerOf(project, 'load', frame).toFixed(0)} W fits under inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'warehouse-array', label: 'The array keeps a margin above the building load', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.2, evidence: (project, frame) => `Array ${powerOf(project, 'pv', frame).toFixed(0)} W provides more than the ${powerOf(project, 'load', frame).toFixed(0)} W demand.` },
    { id: 'reserve-balance', label: 'Battery reserve remains available through the sample day', check: (project) => (project.initialSoc ?? 50) >= 35 && (project.initialSoc ?? 50) <= 85, evidence: (project) => `Initial battery reserve is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('health-centre-backup', 'Health centre backup', 'Community clinic', 'A community clinic needs a stable emergency reserve while keeping the day’s PV and battery values explicit.', 'Ready', { sun: [42, 82], ambient: [12, 30], loadWatts: [600, 1200], pvWatts: [800, 1600], soc: [38, 86], inverterWatts: [1200, 2500] }, [
    { id: 'clinic-load', label: 'Clinic load remains under the rated inverter output', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.9, evidence: (project, frame) => `Clinic load ${powerOf(project, 'load', frame).toFixed(0)} W sits below inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'clinic-array', label: 'PV output covers the sample clinic load', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.15, evidence: (project, frame) => `PV is ${powerOf(project, 'pv', frame).toFixed(0)} W for a ${powerOf(project, 'load', frame).toFixed(0)} W clinic load.` },
    { id: 'reserve-window', label: 'Battery reserve is healthy enough for the emergency plan', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 90, evidence: (project) => `Battery reserve is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('storm-season', 'Storm season', 'Rural home', 'A storm-season home must protect its battery reserve while the array remains limited by weather.', 'Advanced', { sun: [15, 45], ambient: [6, 20], loadWatts: [300, 900], pvWatts: [350, 950], soc: [28, 72], inverterWatts: [1000, 2000] }, [
    { id: 'storm-reserve', label: 'Battery reserve remains usable under poor sun conditions', check: (project) => (project.initialSoc ?? 50) >= 25 && (project.initialSoc ?? 50) <= 75, evidence: (project) => `Battery reserve is ${project.initialSoc.toFixed(0)}%.` },
    { id: 'storm-demand', label: 'Demand is still inside the inverter rating', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.85, evidence: (project, frame) => `Demand ${powerOf(project, 'load', frame).toFixed(0)} W sits below inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'limited-array', label: 'The sample array remains below the limit for the storm window', check: (project, frame) => powerOf(project, 'pv', frame) <= powerOf(project, 'mppt', frame) * 1.1, evidence: (project, frame) => `PV output ${powerOf(project, 'pv', frame).toFixed(0)} W remains under controller output ${powerOf(project, 'mppt', frame).toFixed(0)} W.` },
  ]),
  scenario('cold-start', 'Cold start', 'Mountain cabin', 'A colder ambient window should remain compatible with the chosen battery and inverter setup.', 'Ready', { sun: [30, 68], ambient: [-10, 12], loadWatts: [260, 650], pvWatts: [420, 1100], soc: [35, 75], inverterWatts: [900, 1900] }, [
    { id: 'cold-ambient', label: 'The ambient temperature remains inside the sample operating range', check: (project) => project.ambient >= -15 && project.ambient <= 15, evidence: (project) => `Ambient is ${project.ambient.toFixed(0)} °C.` },
    { id: 'cold-load', label: 'The cabin load remains below the inverter rating', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.85, evidence: (project, frame) => `Load ${powerOf(project, 'load', frame).toFixed(0)} W fits within inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'cold-solar', label: 'PV still supports the operating point in the cold window', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.08, evidence: (project, frame) => `PV is ${powerOf(project, 'pv', frame).toFixed(0)} W for a ${powerOf(project, 'load', frame).toFixed(0)} W load.` },
  ]),
  scenario('desert-hub', 'Desert hub', 'Remote telecom site', 'The site must hold enough reserve while the array frequently receives direct sun and a hot ambient window.', 'Advanced', { sun: [70, 100], ambient: [25, 45], loadWatts: [500, 1200], pvWatts: [900, 2000], soc: [40, 85], inverterWatts: [1500, 2800] }, [
    { id: 'hub-ambient', label: 'High ambient is recorded in the allowed range', check: (project) => project.ambient >= 25 && project.ambient <= 45, evidence: (project) => `Ambient is ${project.ambient.toFixed(0)} °C.` },
    { id: 'hub-array', label: 'The array keeps enough margin above the telecom demand', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.16, evidence: (project, frame) => `PV is ${powerOf(project, 'pv', frame).toFixed(0)} W compared to load ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'hub-reserve', label: 'Battery reserve stays in the healthy operating band', check: (project) => (project.initialSoc ?? 50) >= 35 && (project.initialSoc ?? 50) <= 90, evidence: (project) => `The battery reserve starts at ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('coastal-ferry', 'Coastal ferry', 'Harbour office', 'The harbour office should keep a moderate load with a steady battery reserve under a salt-air climate.', 'Ready', { sun: [45, 78], ambient: [18, 32], loadWatts: [350, 700], pvWatts: [500, 1200], soc: [30, 70], inverterWatts: [1000, 2000] }, [
    { id: 'harbour-load', label: 'The office load is inside the inverter envelope', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.9, evidence: (project, frame) => `Load ${powerOf(project, 'load', frame).toFixed(0)} W and inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'harbour-solar', label: 'The array covers the sample daytime demand', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.12, evidence: (project, frame) => `PV output ${powerOf(project, 'pv', frame).toFixed(0)} W covers the ${powerOf(project, 'load', frame).toFixed(0)} W load.` },
    { id: 'harbour-reserve', label: 'The battery reserve remains in the study range', check: (project) => (project.initialSoc ?? 50) >= 25 && (project.initialSoc ?? 50) <= 80, evidence: (project) => `Battery reserve starts at ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('rural-sensor-lab', 'Rural sensor lab', 'Remote monitoring site', 'A sensor site benefits from a modest array and a resilient battery reserve under a changing climate.', 'Beginner', { sun: [40, 75], ambient: [8, 26], loadWatts: [150, 400], pvWatts: [260, 700], soc: [35, 85], inverterWatts: [600, 1400] }, [
    { id: 'sensor-load', label: 'The monitoring load fits inside the inverter envelope', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.9, evidence: (project, frame) => `Load ${powerOf(project, 'load', frame).toFixed(0)} W uses inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'sensor-solar', label: 'PV remains above the sensor site load', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.15, evidence: (project, frame) => `PV ${powerOf(project, 'pv', frame).toFixed(0)} W covers demand ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'sensor-reserve', label: 'Storage starts within a healthy range', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 90, evidence: (project) => `Battery reserve is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('dry-gas-booster', 'Dry gas booster', 'Pump house', 'A pump house sample needs a robust load envelope with explicit solar and battery headroom.', 'Advanced', { sun: [35, 82], ambient: [12, 34], loadWatts: [600, 1600], pvWatts: [820, 1800], soc: [30, 75], inverterWatts: [1500, 2600] }, [
    { id: 'booster-load', label: 'Pump house demand remains below inverter capacity', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.85, evidence: (project, frame) => `Load ${powerOf(project, 'load', frame).toFixed(0)} W uses inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'booster-solar', label: 'PV cushion covers the pump load', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.18, evidence: (project, frame) => `PV ${powerOf(project, 'pv', frame).toFixed(0)} W covers demand ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'booster-reserve', label: 'Battery reserve starts inside a safe working band', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 80, evidence: (project) => `Battery reserve is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('holiday-home', 'Holiday home', 'Remote weekend retreat', 'A weekend retreat should stay robust through a bright midday cycle without overusing the battery reserve.', 'Ready', { sun: [50, 92], ambient: [15, 30], loadWatts: [320, 700], pvWatts: [420, 980], soc: [35, 80], inverterWatts: [900, 1800] }, [
    { id: 'retreat-load', label: 'The retreat load stays below the inverter rating', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.85, evidence: (project, frame) => `Load ${powerOf(project, 'load', frame).toFixed(0)} W fits under inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'retreat-solar', label: 'The midday array covers the weekend load', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.12, evidence: (project, frame) => `PV output ${powerOf(project, 'pv', frame).toFixed(0)} W covers demand ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'retreat-reserve', label: 'Battery reserve starts inside the sample operating band', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 85, evidence: (project) => `Battery reserve starts at ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('tiny-rental', 'Tiny rental', 'Guest house', 'A small guest house must keep a modest energy day in balance with a modest battery stack.', 'Beginner', { sun: [52, 88], ambient: [10, 28], loadWatts: [240, 550], pvWatts: [350, 900], soc: [30, 80], inverterWatts: [700, 1500] }, [
    { id: 'guest-load', label: 'Guest-house demand remains within the inverter envelope', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.9, evidence: (project, frame) => `Load ${powerOf(project, 'load', frame).toFixed(0)} W is within inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'guest-array', label: 'PV output clears the daytime load target', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.12, evidence: (project, frame) => `PV ${powerOf(project, 'pv', frame).toFixed(0)} W covers demand ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'guest-reserve', label: 'Battery reserve remains healthy at start', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 85, evidence: (project) => `Battery reserve is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('farm-storage-lab', 'Farm storage lab', 'Agricultural site', 'A farm site should handle both solar daytime output and a battery reserve for overnight work.', 'Ready', { sun: [60, 90], ambient: [18, 32], loadWatts: [800, 1800], pvWatts: [900, 2200], soc: [32, 78], inverterWatts: [1600, 3000] }, [
    { id: 'farm-load', label: 'The agricultural load fits under the inverter rating', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.85, evidence: (project, frame) => `Demand ${powerOf(project, 'load', frame).toFixed(0)} W within inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'farm-array', label: 'The farm PV array remains above the daytime demand', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.2, evidence: (project, frame) => `PV ${powerOf(project, 'pv', frame).toFixed(0)} W covers the load ${powerOf(project, 'load', frame).toFixed(0)} W.` },
    { id: 'farm-reserve', label: 'Battery reserve remains in the healthy operating window', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 80, evidence: (project) => `Battery reserve starts at ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('trail-crew-base', 'Trail crew base', 'Remote camp', 'A crew camp should remain within a realistic solar and battery envelope for a small shared load.', 'Ready', { sun: [45, 80], ambient: [10, 28], loadWatts: [300, 700], pvWatts: [500, 1000], soc: [32, 78], inverterWatts: [800, 1700] }, [
    { id: 'camp-load', label: 'The crew base remains within the inverter envelope', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.85, evidence: (project, frame) => `Load ${powerOf(project, 'load', frame).toFixed(0)} W uses inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'camp-array', label: 'PV output covers the sample camp demand', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.18, evidence: (project, frame) => `Array has ${powerOf(project, 'pv', frame).toFixed(0)} W for a ${powerOf(project, 'load', frame).toFixed(0)} W camp load.` },
    { id: 'camp-reserve', label: 'Battery reserve starts in a workable range', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 80, evidence: (project) => `Battery reserve is ${project.initialSoc.toFixed(0)}%.` },
  ]),
  scenario('shared-battery-cabin', 'Shared battery cabin', 'Forest cabin', 'A cabin with a shared battery bank should keep its chosen load and reserve in a realistic working window.', 'Beginner', { sun: [45, 76], ambient: [8, 22], loadWatts: [250, 600], pvWatts: [400, 900], soc: [35, 80], inverterWatts: [800, 1500] }, [
    { id: 'cabin-load', label: 'The shared cabin demand stays below the inverter rating', check: (project, frame) => powerOf(project, 'load', frame) <= powerOf(project, 'inverter', frame) * 0.85, evidence: (project, frame) => `Demand ${powerOf(project, 'load', frame).toFixed(0)} W sits below inverter ${powerOf(project, 'inverter', frame).toFixed(0)} W.` },
    { id: 'cabin-array', label: 'The sample array covers the cabin load', check: (project, frame) => powerOf(project, 'pv', frame) >= powerOf(project, 'load', frame) * 1.2, evidence: (project, frame) => `PV ${powerOf(project, 'pv', frame).toFixed(0)} W supports the ${powerOf(project, 'load', frame).toFixed(0)} W cabin load.` },
    { id: 'cabin-reserve', label: 'Battery reserve remains in the healthy range', check: (project) => (project.initialSoc ?? 50) >= 30 && (project.initialSoc ?? 50) <= 85, evidence: (project) => `Battery reserve starts at ${project.initialSoc.toFixed(0)}%.` },
  ]),
]

const additionalScenarioSpecs: Array<[string, string, string, string, LearnDifficulty, Record<string, [number, number]>, number, number]> = [
  ['rainwater-tank', 'Rainwater tank', 'Community garden', 'Run a small water transfer pump with daytime solar and a modest storage reserve.', 'Beginner', { sun: [52, 86], ambient: [14, 30], loadWatts: [260, 520], pvWatts: [520, 920], soc: [35, 78], inverterWatts: [800, 1500] }, 1.25, 1.45],
  ['mountain-radio', 'Mountain radio relay', 'Emergency communications team', 'Keep a remote radio relay within its power envelope through a cool daylight window.', 'Beginner', { sun: [40, 76], ambient: [-4, 14], loadWatts: [180, 360], pvWatts: [380, 700], soc: [40, 82], inverterWatts: [600, 1100] }, 1.25, 1.45],
  ['orchard-store', 'Orchard cold store', 'Family orchard', 'Balance a small produce store load against the available array and inverter ratings.', 'Beginner', { sun: [56, 90], ambient: [12, 29], loadWatts: [320, 620], pvWatts: [650, 1050], soc: [38, 82], inverterWatts: [1000, 1700] }, 1.25, 1.5],
  ['trailhead-shelter', 'Trailhead shelter', 'Park service', 'Supply a visitor shelter with a small daytime load and a healthy starting battery reserve.', 'Beginner', { sun: [45, 82], ambient: [6, 25], loadWatts: [150, 340], pvWatts: [360, 650], soc: [36, 80], inverterWatts: [600, 1000] }, 1.25, 1.45],
  ['market-kiosk', 'Market kiosk', 'Weekend market vendor', 'Keep a compact kiosk system sized for its daytime demand and expected reserve.', 'Beginner', { sun: [55, 88], ambient: [15, 32], loadWatts: [220, 460], pvWatts: [470, 820], soc: [35, 78], inverterWatts: [700, 1300] }, 1.25, 1.5],
  ['boat-house-lighting', 'Boathouse lighting', 'Small marina', 'Check the marina lighting system against its solar, inverter, and battery settings.', 'Beginner', { sun: [38, 70], ambient: [10, 27], loadWatts: [190, 390], pvWatts: [420, 760], soc: [38, 82], inverterWatts: [650, 1200] }, 1.25, 1.5],
  ['hilltop-sensor', 'Hilltop sensor station', 'Weather research group', 'Power a sensor station through a breezy highland day with explicit system margins.', 'Beginner', { sun: [42, 78], ambient: [2, 20], loadWatts: [120, 280], pvWatts: [310, 560], soc: [40, 84], inverterWatts: [500, 900] }, 1.25, 1.5],
  ['artisan-studio', 'Artisan studio', 'Ceramics workshop', 'Size a small studio system around its sample load and an adequate starting reserve.', 'Beginner', { sun: [50, 84], ambient: [13, 30], loadWatts: [350, 680], pvWatts: [720, 1150], soc: [34, 76], inverterWatts: [1100, 1900] }, 1.25, 1.5],
  ['orchard-irrigation', 'Orchard irrigation', 'Cooperative farm', 'Run an irrigation load within the inverter rating while retaining solar headroom.', 'Ready', { sun: [48, 82], ambient: [17, 34], loadWatts: [650, 1250], pvWatts: [1350, 2050], soc: [32, 75], inverterWatts: [1900, 3000] }, 1.28, 1.5],
  ['school-computer-room', 'School computer room', 'Rural school', 'Support a computer-room demand with a clear array margin and battery start window.', 'Ready', { sun: [44, 78], ambient: [10, 29], loadWatts: [720, 1380], pvWatts: [1500, 2300], soc: [36, 80], inverterWatts: [2100, 3300] }, 1.28, 1.5],
  ['dairy-milking-room', 'Dairy milking room', 'Family dairy', 'Check the electrical ratings for a daytime dairy load and its supporting solar array.', 'Ready', { sun: [52, 86], ambient: [9, 26], loadWatts: [900, 1650], pvWatts: [1850, 2700], soc: [34, 76], inverterWatts: [2500, 3800] }, 1.25, 1.5],
  ['clinic-vaccine-fridge', 'Clinic vaccine fridge', 'Mobile health team', 'Keep a clinic refrigeration load inside the system ratings with battery reserve available.', 'Ready', { sun: [40, 74], ambient: [18, 35], loadWatts: [420, 850], pvWatts: [900, 1450], soc: [42, 86], inverterWatts: [1300, 2200] }, 1.25, 1.5],
  ['remote-print-shop', 'Remote print shop', 'Village enterprise', 'Check that the workshop demand fits the inverter and the PV rating retains headroom.', 'Ready', { sun: [46, 80], ambient: [12, 30], loadWatts: [780, 1450], pvWatts: [1600, 2450], soc: [32, 74], inverterWatts: [2300, 3500] }, 1.25, 1.5],
  ['coastal-lighthouse', 'Coastal lighthouse', 'Harbour authority', 'Maintain a workable load and battery starting point for a coastal navigation site.', 'Ready', { sun: [38, 72], ambient: [12, 28], loadWatts: [520, 980], pvWatts: [1080, 1700], soc: [40, 84], inverterWatts: [1500, 2500] }, 1.25, 1.5],
  ['winter-greenhouse', 'Winter greenhouse', 'Horticulture team', 'Support greenhouse equipment in a low-sun window using the project’s actual ratings.', 'Ready', { sun: [18, 48], ambient: [0, 16], loadWatts: [600, 1150], pvWatts: [1250, 1900], soc: [42, 86], inverterWatts: [1750, 2800] }, 1.25, 1.5],
  ['bus-depot-auxiliary', 'Bus depot auxiliary', 'Transit operator', 'Check the auxiliary building load against its inverter and solar array ratings.', 'Ready', { sun: [50, 84], ambient: [8, 26], loadWatts: [1050, 1900], pvWatts: [2200, 3100], soc: [34, 78], inverterWatts: [2900, 4300] }, 1.25, 1.5],
  ['communications-shelter', 'Communications shelter', 'Regional network operator', 'Keep a communications shelter’s steady load inside the equipment rating envelope.', 'Ready', { sun: [34, 68], ambient: [5, 24], loadWatts: [480, 920], pvWatts: [1000, 1580], soc: [44, 88], inverterWatts: [1400, 2400] }, 1.25, 1.5],
  ['quarry-conveyor', 'Quarry conveyor controls', 'Stone works', 'Check the larger control-room load against the specified inverter and array margins.', 'Advanced', { sun: [42, 76], ambient: [8, 31], loadWatts: [1700, 2700], pvWatts: [3400, 4500], soc: [36, 78], inverterWatts: [4300, 6200] }, 1.25, 1.5],
  ['cold-chain-warehouse', 'Cold-chain warehouse', 'Food distributor', 'Review the ratings and reserve for a substantial warehouse refrigeration system.', 'Advanced', { sun: [44, 80], ambient: [20, 38], loadWatts: [2200, 3300], pvWatts: [4300, 5600], soc: [40, 82], inverterWatts: [5400, 7000] }, 1.25, 1.5],
  ['water-treatment-plant', 'Water treatment plant', 'Regional utility', 'Evaluate a high-demand treatment system with explicit PV and inverter sizing checks.', 'Advanced', { sun: [46, 82], ambient: [14, 32], loadWatts: [2400, 3600], pvWatts: [4700, 6200], soc: [34, 76], inverterWatts: [5800, 7200] }, 1.25, 1.5],
  ['remote-data-node', 'Remote data node', 'Research network', 'Keep a high-availability data node inside its system’s current equipment ratings.', 'Advanced', { sun: [38, 72], ambient: [6, 27], loadWatts: [1900, 3000], pvWatts: [3800, 5200], soc: [46, 88], inverterWatts: [4700, 6500] }, 1.25, 1.5],
  ['island-desalination', 'Island desalination', 'Island services team', 'Check a demanding desalination load against the modeled array, inverter, and battery state.', 'Advanced', { sun: [58, 94], ambient: [22, 40], loadWatts: [2100, 3200], pvWatts: [4200, 5500], soc: [40, 84], inverterWatts: [5100, 6800] }, 1.25, 1.5],
  ['rail-signal-cabin', 'Rail signal cabin', 'Rail infrastructure team', 'Review the system ratings and starting battery reserve for a remote signal cabin.', 'Advanced', { sun: [32, 66], ambient: [-8, 16], loadWatts: [1250, 2200], pvWatts: [2500, 3700], soc: [42, 86], inverterWatts: [3200, 5000] }, 1.25, 1.5],
  ['mountain-lodge', 'Mountain lodge', 'Alpine lodge operator', 'Support a lodge’s larger demand in a cool climate while keeping the modeled ratings aligned.', 'Advanced', { sun: [30, 66], ambient: [-12, 10], loadWatts: [1800, 2900], pvWatts: [3600, 5000], soc: [38, 82], inverterWatts: [4500, 6300] }, 1.25, 1.5],
  ['industrial-workshop', 'Industrial workshop', 'Small manufacturer', 'Check a workshop’s high load against the inverter and array nameplate ratings.', 'Advanced', { sun: [48, 84], ambient: [12, 33], loadWatts: [2600, 3700], pvWatts: [5100, 6500], soc: [35, 78], inverterWatts: [6200, 7500] }, 1.25, 1.5],
]

function additionalScenarioRequirements(solarMargin: number, inverterMargin: number): LearnRequirement[] {
  return [
    { id: 'pv-rating', label: `PV array rating provides at least ${solarMargin.toFixed(2)}x the load rating`, check: project => { const pv = deviceByKind(project, 'pv'); const load = deviceByKind(project, 'load'); return !!pv && !!load && powerOf(project,'pv',null) >= powerOf(project,'load',null) * solarMargin }, evidence: project => `PV array rating is ${powerOf(project,'pv',null).toFixed(0)} W against a ${powerOf(project,'load',null).toFixed(0)} W load rating.` },
    { id: 'inverter-rating', label: `Inverter rating provides at least ${inverterMargin.toFixed(2)}x the load rating`, check: project => { const inverter = deviceByKind(project, 'inverter'); const load = deviceByKind(project, 'load'); return !!inverter && !!load && powerOf(project,'inverter',null) >= powerOf(project,'load',null) * inverterMargin }, evidence: project => `Inverter rating is ${powerOf(project,'inverter',null).toFixed(0)} W against a ${powerOf(project,'load',null).toFixed(0)} W load rating.` },
    { id: 'battery-reserve', label: 'Battery start state stays near the sampled reserve', check: (project, _frame, sample) => { const battery = deviceByKind(project, 'battery'); const state = project.initialSoc ?? 50; const target = lookup(sample, 'soc', 50); return !!battery && state >= Math.max(10, target - 20) && state <= Math.min(95, target + 20) }, evidence: project => `Battery start state is ${project.initialSoc.toFixed(0)}%; the project includes ${deviceByKind(project, 'battery') ? 'a battery' : 'no battery'}.` },
  ]
}

export const LEARN_SCENARIOS: LearnScenarioDefinition[] = [
  ...CORE_LEARN_SCENARIOS,
  ...additionalScenarioSpecs.map(([id, title, client, summary, difficulty, ranges, solarMargin, inverterMargin]) => scenario(id, title, client, summary, difficulty, ranges, additionalScenarioRequirements(solarMargin, inverterMargin))),
]

const LEARN_DIFFICULTIES: LearnDifficulty[] = ['Beginner', 'Ready', 'Advanced']

export function emptyLearnProgress(): LearnProgressState {
  return { completedScenarioIds: [], completedByDifficulty: { Beginner: [], Ready: [], Advanced: [] }, completionCounts: {}, totalCompletions: 0 }
}

export function normalizeLearnProgress(value: unknown): LearnProgressState {
  const empty = emptyLearnProgress()
  if (!value || typeof value !== 'object') return empty
  const candidate = value as Partial<LearnProgressState>
  const completedByDifficulty = Object.fromEntries(LEARN_DIFFICULTIES.map(difficulty => [difficulty, Array.isArray(candidate.completedByDifficulty?.[difficulty]) ? candidate.completedByDifficulty[difficulty].filter((id): id is string => typeof id === 'string') : []])) as LearnProgressState['completedByDifficulty']
  const completionCounts = candidate.completionCounts && typeof candidate.completionCounts === 'object' ? Object.fromEntries(Object.entries(candidate.completionCounts).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] >= 0)) : {}
  return { completedScenarioIds: Array.isArray(candidate.completedScenarioIds) ? [...new Set(candidate.completedScenarioIds.filter((id): id is string => typeof id === 'string'))] : [], completedByDifficulty, completionCounts, totalCompletions: typeof candidate.totalCompletions === 'number' && Number.isFinite(candidate.totalCompletions) && candidate.totalCompletions >= 0 ? candidate.totalCompletions : 0 }
}

export function chooseLearnScenario(scenarios: LearnScenarioDefinition[], difficulty: LearnDifficulty, progress: LearnProgressState, random = Math.random): { scenario: LearnScenarioDefinition | null; progress: LearnProgressState; remaining: number; cycleReset: boolean } {
  const candidates = scenarios.filter(candidate => candidate.difficulty === difficulty)
  if (!candidates.length) return { scenario: null, progress, remaining: 0, cycleReset: false }
  const completed = new Set(progress.completedByDifficulty[difficulty])
  const eligible = candidates.filter(candidate => !completed.has(candidate.id))
  const cycleReset = eligible.length === 0
  const pool = cycleReset ? candidates : eligible
  const choiceIndex = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))
  const nextProgress = cycleReset ? { ...progress, completedByDifficulty: { ...progress.completedByDifficulty, [difficulty]: [] } } : progress
  return { scenario: pool[choiceIndex], progress: nextProgress, remaining: pool.length, cycleReset }
}

export function recordLearnScenarioCompletion(progress: LearnProgressState, scenarioDef: LearnScenarioDefinition): LearnProgressState {
  const difficultyCompleted = progress.completedByDifficulty[scenarioDef.difficulty]
  if (difficultyCompleted.includes(scenarioDef.id)) return progress
  return {
    completedScenarioIds: progress.completedScenarioIds.includes(scenarioDef.id) ? progress.completedScenarioIds : [...progress.completedScenarioIds, scenarioDef.id],
    completedByDifficulty: { ...progress.completedByDifficulty, [scenarioDef.difficulty]: [...difficultyCompleted, scenarioDef.id] },
    completionCounts: { ...progress.completionCounts, [scenarioDef.id]: (progress.completionCounts[scenarioDef.id] ?? 0) + 1 },
    totalCompletions: progress.totalCompletions + 1,
  }
}

export function sampleLearnScenarioRun(scenario: LearnScenarioDefinition, seed = `${scenario.id}-${Date.now()}`): Record<string, number> {
  const hash = [...seed].reduce((total, character) => total * 31 + character.charCodeAt(0), 17)
  const random = (() => {
    let value = Math.abs(hash) % 2147483647
    return () => {
      value = (value * 1664525 + 1013904223) % 4294967296
      return value / 4294967296
    }
  })()

  return Object.fromEntries(Object.entries(scenario.ranges).map(([key, [min, max]]) => [key, Number((min + (max - min) * random()).toFixed(2))]))
}

export function createLearnScenarioProject(base: Project, scenario: LearnScenarioDefinition, sample: Record<string, number> = sampleLearnScenarioRun(scenario), startingSystem: 'provided' | 'blank' = 'provided'): Project {
  const project = structuredClone(base)
  project.id = uid('project')
  project.name = scenario.title
  project.sun = clamp(lookup(sample, 'sun', 68), 0, 100)
  project.ambient = clamp(lookup(sample, 'ambient', 23), -30, 60)
  project.initialSoc = clamp(lookup(sample, 'soc', 60), 0, 100)

  const pv = makeDevice('pv', 170, 180, 'Array')
  pv.spec.watts = clamp(lookup(sample, 'pvWatts', 850), 100, 4000)
  pv.spec.voltage = clamp(lookup(sample, 'pvVoltage', 80), 20, 120)
  pv.spec.voc = Math.max(pv.spec.voltage * 1.2, 45)

  const mppt = makeDevice('mppt', 430, 180, 'MPPT controller')
  mppt.spec.watts = clamp(lookup(sample, 'mpptWatts', 1200), 200, 4000)

  const battery = makeDevice('battery', 660, 170, 'House battery')
  battery.spec.capacityAh = clamp(lookup(sample, 'batteryAh', 150), 20, 500)
  battery.spec.voltage = clamp(lookup(sample, 'batteryVoltage', sample.chargeVoltage?12:51.2), 12, 100)
  battery.spec.rating = clamp(lookup(sample, 'batteryRating', 80), 10, 250)

  mppt.spec.chargeVoltage = clamp(lookup(sample, 'chargeVoltage', battery.spec.voltage*1.125), 10, 120)
  if(sample.chargeVoltage)battery.spec.chargeVoltage=sample.chargeVoltage

  const inverter = makeDevice('inverter', 660, 340, 'Inverter')
  inverter.spec.watts = clamp(lookup(sample, 'inverterWatts', 2200), 300, 7000)
  inverter.spec.voltage = clamp(lookup(sample, 'inverterVoltage', 230), 120, 400)
  inverter.spec.cutoff = battery.spec.voltage*.85
  inverter.spec.frequency = clamp(lookup(sample, 'frequency', 50), 40, 80)

  const pump=/pump/i.test(scenario.id)
  const load = makeDevice(pump?'motor':'load', 940, 340, pump?'Client pump':'Client load')
  load.spec.watts = clamp(lookup(sample, 'loadWatts', 620), 40, 4000)
  load.spec.voltage = clamp(lookup(sample, 'loadVoltage', 230), 12, 400)

  project.devices = [pv, mppt, battery, inverter, load]
  project.wires = [
    connect(pv, 'p', mppt, 'pv+'),
    connect(pv, 'n', mppt, 'pv-'),
    connect(mppt, 'bat+', battery, 'p'),
    connect(mppt, 'bat-', battery, 'n'),
    connect(battery, 'p', inverter, 'dc+'),
    connect(battery, 'n', inverter, 'dc-'),
    connect(inverter, 'l', load, 'p'),
    connect(inverter, 'n', load, 'n'),
  ]
  if(startingSystem==='blank'){project.devices=[load];project.wires=[];project.groups=[]}
  project.learn = {
    scenarioId: scenario.id,
    runId: uid('learn-run'),
    sample,
    startedAt: Date.now(),
    completed: false,
  }

  return project
}

export function evaluateLearnScenario(project: Project, frame: Frame | null | undefined, scenarioDef: LearnScenarioDefinition, sample: Record<string, number> = project.learn?.sample ?? sampleLearnScenarioRun(scenarioDef)): LearnScenarioEvaluation {
  const checklist = scenarioDef.requirements.map(requirement => {
    const passed = project.devices.length>0 && requirement.check(project, frame, sample)
    return { id: requirement.id, label: requirement.label, passed, evidence: requirement.evidence(project, frame, sample) }
  })
  const load=deviceByKind(project,'load'),battery=deviceByKind(project,'battery'),inverter=deviceByKind(project,'inverter'),loadWatts=powerOf(project,'load',null)
  const target=lookup(sample,'loadWatts',620),delivered=frame?powerOf(project,'load',frame):0
  checklist.push({id:'client-supply',label:'Connect and power the specified client load',passed:!!load&&!!battery&&!!inverter&&loadWatts>=target*.99&&loadWatts<=target*1.01&&delivered>=loadWatts*.9,evidence:`Client demand is ${target.toFixed(0)} W. Connected load is ${loadWatts.toFixed(0)} W and receives ${delivered.toFixed(0)} W.`})
  if(project.learn?.task){
    const pv=project.devices.filter(d=>d.kind==='pv'),controllers=project.devices.filter(d=>d.kind==='mppt')
    const capacity=controllers.reduce((sum,d)=>sum+d.spec.watts,0),array=pv.reduce((sum,d)=>sum+d.spec.watts,0)
    const faults=frame?.findings?.filter(f=>f.severity==='fault')??[]
    const terminals=new Set(project.wires.flatMap(w=>[w.from+':'+w.fromPort,w.to+':'+w.toPort]))
    const required=project.devices.filter(d=>['battery','pv','mppt','inverter','load','motor','dc-load'].includes(d.kind))
    const open=required.flatMap(d=>d.ports.filter(p=>p.domain!=='earth'&&!terminals.has(d.id+':'+p.id)).map(p=>d.name+' '+p.label))
    checklist.push({id:'training-connections',label:'Wire both supply and return paths for every required device',passed:required.length>=5&&open.length===0,evidence:open.length?'Connect these terminals: '+open.join(', '):required.length<5?'Add the battery, array, controller and inverter to supply the provided client load.':'All required terminals have connections.'})
    checklist.push({id:'controller-capacity',label:'Install and size the solar controller for the array',passed:pv.length>0&&controllers.length>0&&capacity>=array,evidence:`Array rating is ${array.toFixed(0)} W. Controller capacity is ${capacity.toFixed(0)} W.`})
    checklist.push({id:'commissioning',label:'Commission the system with all equipment on and all faults cleared',passed:!!frame&&!!load&&!!battery&&!!inverter&&project.devices.every(d=>d.on)&&faults.length===0&&delivered>=target*.9&&(project.sun<30||powerOf(project,'pv',frame)>0),evidence:!frame?'Run the simulation to check your installation.':faults.length?faults.map(f=>f.title).join('. '):project.devices.some(d=>!d.on)?'Check the equipment switches.':'Check the client supply and the remaining task requirements.'})
  }
  const allPassed = checklist.every(item => item.passed)
  return { allPassed, checklist, completed: allPassed }
}

export function createLearnTrainingProject(scenario:LearnScenarioDefinition,sample:Record<string,number>):Project {
  const project=createLearnScenarioProject(blankProject(),scenario,sample,scenario.task==='build'?'blank':'provided')
  project.learn!.task=scenario.task
  if(scenario.task==='repair'){
    const inverter=deviceByKind(project,'inverter')!,controller=deviceByKind(project,'mppt')!,load=deviceByKind(project,'load')!
    inverter.on=false
    controller.spec.watts=Math.round(deviceByKind(project,'pv')!.spec.watts*.4)
    project.wires=project.wires.filter(w=>!(w.to===load.id&&w.toPort==='n'))
  }
  return project
}

export function markLearnCompletion(project: Project, scenario: LearnScenarioDefinition): Project {
  if (!project.learn) return { ...project, learn: { scenarioId: scenario.id, runId: `learn-${Date.now()}`, sample: sampleLearnScenarioRun(scenario), startedAt: Date.now(), completed: true, completedAt: Date.now(), achievement: `${scenario.title} achieved` } }
  return { ...project, learn: { ...project.learn, scenarioId: scenario.id, completed: true, completedAt: Date.now(), achievement: `${scenario.title} achieved` } }
}

export function trainingDeparture(previous:Project,next:Project):string|null {
  if(!previous.learn)return null
  if(next.learn?.runId!==previous.learn.runId)return 'You are leaving the current training session.'
  if(next.sun!==previous.sun||next.ambient!==previous.ambient||next.initialSoc!==previous.initialSoc||JSON.stringify(next.solarSite)!==JSON.stringify(previous.solarSite)||next.scheduleHour!==previous.scheduleHour)return 'This changes the client site conditions.'
  const loads=(p:Project)=>p.devices.filter(d=>['load','motor','dc-load'].includes(d.kind)).map(d=>[d.id,d.kind,d.on,d.spec.watts,d.spec.voltage,d.spec.surge,d.spec.startupSeconds,d.spec.inductance,d.schedule])
  if(JSON.stringify(loads(previous))!==JSON.stringify(loads(next)))return 'This changes the client equipment or demand.'
  const allowed=['battery','pv','mppt','inverter','load','motor','dc-load','fuse','switch','bus','ground']
  if(next.devices.some(d=>!previous.devices.some(old=>old.id===d.id)&&!allowed.includes(d.kind)))return 'This adds equipment outside the training brief.'
  if(JSON.stringify(previous.requirements)!==JSON.stringify(next.requirements))return 'This replaces the training design brief.'
  return null
}

/** Restore the client brief when opening training sessions saved by older versions. */
export function restoreLearnClient(project:Project):Project {
  if(!project.learn)return project
  const scenario=LEARN_SCENARIOS.find(s=>s.id===project.learn!.scenarioId)
  if(!scenario)return project
  const sample=project.learn.sample,loads=project.devices.filter(d=>['load','motor','dc-load'].includes(d.kind))
  const target=clamp(lookup(sample,'loadWatts',620),40,4000),total=loads.reduce((sum,d)=>sum+d.spec.watts,0)
  const next={...project,sun:clamp(lookup(sample,'sun',68),0,100),ambient:clamp(lookup(sample,'ambient',23),-30,60),initialSoc:clamp(lookup(sample,'soc',60),0,100)}
  if(!loads.length){
    const supplied=createLearnScenarioProject(blankProject(),scenario,sample,'blank').devices[0]
    return {...next,devices:[...project.devices,supplied]}
  }
  if(Math.abs(total-target)<.001)return next
  const ids=new Set(loads.map(d=>d.id))
  return {...next,devices:project.devices.map(d=>ids.has(d.id)?{...d,spec:{...d.spec,watts:total>0?d.spec.watts*target/total:target/loads.length}}:d)}
}

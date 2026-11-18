import {assertDesignConnections} from './connection-checks'
import { blankProject, connect, makeDevice, type Project, type Requirements } from './model'
import {buildDesignTopology} from './design-topology'
import {resolvedRequirements} from './appliances'
import {selectArray} from './design-options'
import {designPhases} from './design-phases'
import {applyBuilding} from './building-fit'
import {sizePlacedDesign,type DesignSizingPath} from './design-sizing'
import {synchronizeLengths} from './geometry'

export function solarProject(): Project {
  const p = blankProject(); p.name = 'The everyday energy system'
  const pv = makeDevice('pv', 0, 0, 'Rooftop solar')
  const mppt = makeDevice('mppt', 340, 0, 'Solar controller')
  const battery = makeDevice('battery', 0, 270, 'Home battery')
  const fuse = makeDevice('fuse', 340, 280, 'Battery protection')
  const inverter = makeDevice('inverter', 690, 230, 'Hybrid inverter')
  const load = makeDevice('load', 1050, 140, 'Essential loads')
  const motor = makeDevice('motor', 1050, 410, 'Water pump'); motor.on = false
  p.devices = [pv, mppt, battery, fuse, inverter, load, motor]
  p.wires = [connect(pv, 'p', mppt, 'pv+', 6, 8), connect(pv, 'n', mppt, 'pv-', 6, 8), connect(mppt, 'bat+', battery, 'p', 16, 2), connect(mppt, 'bat-', battery, 'n', 16, 2), connect(battery, 'p', fuse, 'p', 35, 1), connect(fuse, 'n', inverter, 'dc+', 35, 1), connect(battery, 'n', inverter, 'dc-', 35, 2), connect(inverter, 'l', load, 'p', 2.5, 10), connect(inverter, 'n', load, 'n', 2.5, 10), connect(inverter, 'l', motor, 'p', 2.5, 8), connect(inverter, 'n', motor, 'n', 2.5, 8)]
  p.devices.forEach((d, i) => { d.physical = [[-1.6, -.3, -1.5, -.4, .5, 1.6, 1.6][i], 0, [-.7, -.7, .7, .6, .25, -.65, .8][i]] })
  return p
}
export function chargingProject():Project {
  const project=blankProject();project.name='Shore power, stored for later'
  const grid=makeDevice('grid',0,100,'230 V shore supply'),charger=makeDevice('charger',360,100,'15 A battery charger'),battery=makeDevice('battery',720,100,'12.8 V service battery')
  battery.spec.voltage=12.8;battery.spec.capacityAh=100
  project.devices=[grid,charger,battery]
  project.wires=[connect(grid,'p',charger,'l',2.5,1),connect(grid,'n',charger,'n',2.5,1),connect(charger,'bat+',battery,'p',6,1),connect(charger,'bat-',battery,'n',6,1)]
  project.designNotes=['Generic AC rectifier, DC link and current-limited charging example. The charger enclosure uses a manufacturer dimensional reference; electrical firmware, charging stages and certified protection are not modelled.','This sandbox example does not select installation protection or prove compliance.']
  return project
}
export function circuitProject(): Project {
  const p = blankProject(); p.name = 'A little circuit, a lot to discover'
  const b = makeDevice('battery', 0, 150, '12 V supply'); b.spec.voltage = 12; b.spec.resistance = .01
  const s = makeDevice('switch', 340, 0, 'Circuit switch')
  const r = makeDevice('resistor', 670, 0, 'Charge resistor'); r.spec.resistance = 100
  const c = makeDevice('capacitor', 670, 280, 'Storage capacitor'); c.spec.capacitance = .001
  p.devices = [b, s, r, c]
  p.wires = [connect(b, 'p', s, 'p', 1.5, .3), connect(s, 'n', r, 'p', 1.5, .3), connect(r, 'n', c, 'p', 1.5, .3), connect(c, 'n', b, 'n', 1.5, .3)]
  return p
}
export function threePhaseProject(): Project {
  const p = blankProject(); p.name = 'Three phases. One connected system.'
  const g = makeDevice('three-phase', 0, 220, '400 / 230 V supply')
  const loads = [400, 750, 1200].map((watts, i) => { const d = makeDevice('load', 440, i * 230, `Phase ${'ABC'[i]} load`); d.spec.watts = watts; return d })
  p.devices = [g, ...loads]
  p.wires = loads.flatMap((l, i) => [connect(g, 'abc'[i], l, 'p', 2.5, 10), connect(g, 'n', l, 'n', 2.5, 10)])
  return p
}
export const defaultRequirements: Requirements = { context: 'home', region: 'ZA', dailyKwh: 8, peakW: 2400, autonomyHours: 12, sunHours: 4.5, cableLength: undefined, reserve: 20, priority: 'cost', phases: 'single' }

export function designSystem(r: Requirements): Project {
  r=resolvedRequirements(r)
  if (![r.dailyKwh, r.peakW, r.autonomyHours, r.sunHours, r.cableLength ?? 0, r.reserve].every(Number.isFinite) || r.dailyKwh <= 0 || r.peakW <= 0 || r.autonomyHours <= 0 || r.sunHours <= 0 || (r.cableLength ?? 0) < 0) throw new Error('Enter positive demand, autonomy, sunlight and route values.')
  if (r.reserve < 0 || r.reserve > 100) throw new Error('Capacity reserve must be between 0% and 100%.')
  if (r.sunHours > 24) throw new Error('Equivalent peak sun hours cannot exceed 24 hours per day.')
  if (r.dailyKwh * 1000 > r.peakW * 24) throw new Error('Daily energy exceeds what the simultaneous running demand could consume in 24 hours. Check both demand inputs.')
  if (!['ZA','GB','US'].includes(r.region) || !['home','mobile','workshop'].includes(r.context) || !['cost','headroom'].includes(r.priority)) throw new Error('Choose a supported region, installation context and design priority.')
  const margin = 1 + r.reserve / 100 + (r.priority === 'headroom' ? .2 : 0)
  const option = selectArray(r), phases = designPhases(r)
  const capacityWh = r.dailyKwh * 1000 * (r.autonomyHours / 24) / (.8 * .94) * margin
  const current = phases.reduce((sum, phase) => sum + (Math.max(phase.inverterW,phase.startupW) / .94 + 8) / 44, 0)
  const packs = Math.max(1, Math.ceil(capacityWh / 5120), Math.ceil(Math.max(current, option.chargeCurrent) / 100))
  const sizingPaths:DesignSizingPath[]=[]
  let p = buildDesignTopology(r, option, packs, phases,sizingPaths)
  if(r.building)p=synchronizeLengths(sizePlacedDesign(applyBuilding(p,r.building,true),sizingPaths))
  if(p.fitIssues?.length)throw new Error(`The design cannot be placed and routed: ${p.fitIssues.join(' ')}`)
  p.name = `${r.context === 'mobile' ? 'Mobile' : r.context === 'workshop' ? 'Workshop' : 'Home'} energy · ${r.region}`
  p.designNotes = [
    `Sized for ${r.dailyKwh.toFixed(2)} kWh/day, ${r.peakW.toFixed(0)} W simultaneous demand and ${r.autonomyHours} hours of average-load autonomy.`,
    `${packs} individual 5.12 kWh battery packs. Assumptions include 80% usable storage, 94% inverter efficiency and 100 A charge/discharge per generic pack.`,
    `${option.modules} individual ${option.panel.name} modules, ${option.strings} strings of ${option.series} modules and ${option.controllers} independent ${option.controller.name} controllers.`,
    `Module temperatures ${r.coldTemperature ?? -10} to ${r.hotTemperature ?? 70} °C. String cold Voc ${option.coldVoc.toFixed(1)} V and estimated hot Vmp ${option.hotVmp.toFixed(1)} V. Hot Vmp uses Pmax/Isc coefficients as an approximation.`,
    `PV input current uses 1.25 × hot Isc as a design allowance. Controller nameplate power and full output current at 44 V constrain string assignment. Panel footprint ${option.area.toFixed(2)} m² excludes access gaps and roof-shape packing.`,
    'Ranking minimises module count plus three units per controller, then excess nameplate power and footprint. This is an equipment-count objective. Installed prices are unavailable.',
    `${r.phases} output with phase angles ${phases.map(phase => phase.angle).join('/')} degrees. Generic inverters require manufacturer-supported coordination before equipment selection.`,
    'PV string/collector voltage-drop targets are 0.5%/1.5% at estimated hot Vmp. Battery branch/main and controller paths target 0.5%/1.5% at 44 V. AC branches target 1% at rated phase output. Physical cable lengths, contacts and ambient resistance are included.',
    'Balanced parallel battery branches use equal loop lengths/areas and individual protection. Controller outputs and inverter supplies have independent protection.',
    'Daily appliance schedules control loads at the selected schedule hour. Startup demand sizes each phase inverter. Autonomy uses average daily energy. Weather, seasonal yield and time-series battery dispatch require further modelling.',
    'Provisional engineering proposal. Regional ampacity uses the saved cable construction and installation assumptions. Review fault ratings, protection selectivity, earthing, battery/BMS limits and exact end hardware in Electrical engineering.',
  ]
  assertDesignConnections(p)
  return p
}

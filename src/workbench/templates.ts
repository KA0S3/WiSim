import {assertDesignConnections} from './connection-checks'
import { blankProject, connect, makeDevice, type Project, type Requirements } from './model'
import {buildDesignTopology} from './design-topology'

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
export const defaultRequirements: Requirements = { context: 'home', region: 'ZA', dailyKwh: 8, peakW: 2400, autonomyHours: 12, sunHours: 4.5, cableLength: 3, reserve: 20, priority: 'cost', phases: 'single' }

export function designSystem(r: Requirements): Project {
  if (![r.dailyKwh, r.peakW, r.autonomyHours, r.sunHours, r.cableLength, r.reserve].every(Number.isFinite) || r.dailyKwh <= 0 || r.peakW <= 0 || r.autonomyHours <= 0 || r.sunHours <= 0 || r.cableLength <= 0) throw new Error('Enter positive demand, autonomy, sunlight and route values.')
  if (r.reserve < 0 || r.reserve > 100) throw new Error('Capacity reserve must be between 0% and 100%.')
  if (r.sunHours > 24) throw new Error('Equivalent peak sun hours cannot exceed 24 hours per day.')
  if (r.dailyKwh * 1000 > r.peakW * 24) throw new Error('Daily energy exceeds what the simultaneous running demand could consume in 24 hours. Check both demand inputs.')
  if (!['ZA','GB','US'].includes(r.region) || !['home','mobile','workshop'].includes(r.context) || !['cost','headroom'].includes(r.priority)) throw new Error('Choose a supported region, installation context and design priority.')
  if (r.phases !== 'single') throw new Error('Automatic multi-phase equipment selection is not yet validated. Use the three-phase sandbox template to explore those networks.')
  let p = blankProject(); p.name = `${r.context === 'mobile' ? 'Mobile' : r.context === 'workshop' ? 'Workshop' : 'Home'} energy · ${r.region}`; p.requirements = { ...r }
  const margin = 1 + r.reserve / 100 + (r.priority === 'headroom' ? .2 : 0)
  const inverterW = [1000, 2000, 3000, 5000, 8000, 12000].find(w => w >= r.peakW * margin)
  if (!inverterW) throw new Error('This demand exceeds the current 12 kW design library. Reduce demand or build a custom system in the sandbox.')
  const capacityWh = r.dailyKwh * 1000 * (r.autonomyHours / 24) / (.8 * .94) * margin
  const modules = Math.max(2, Math.ceil(r.dailyKwh * 1000 / (r.sunHours * .78) * margin / 400 / 2) * 2)
  const pvW = modules * 400
  const current = (inverterW / .94 + 8) / 44
  const controllerCurrent = Math.ceil(pvW * .96 / 44 / 10) * 10
  // Generic pack assumption: 100 A continuous charge and discharge per pack.
  const packs = Math.max(1, Math.ceil(capacityWh / 5120), Math.ceil(Math.max(current, controllerCurrent) / 100))
  if (![capacityWh, packs, modules, controllerCurrent].every(Number.isFinite)) throw new Error('The requested system exceeds numerical sizing limits.')
  const name=p.name;p=buildDesignTopology(r,modules,packs,inverterW,controllerCurrent);p.name=name
  p.designNotes=['Sized for '+r.dailyKwh+' kWh/day and '+r.autonomyHours+' hours of average-load autonomy.',packs+' individual 5.12 kWh battery packs; '+packs*5.12+' kWh nominal storage, 80% usable capacity and 94% inverter efficiency assumed.',modules+' individual generic 400 W panels in '+modules/2+' parallel two-panel series strings, with individual string protection.', 'PV string/collector cable drops target 0.5%/1.5% at 80 V. Battery branch/main paths target 0.5%/1.5% at 44 V minimum input. Controller output targets 1.5%; AC output targets 1% at inverter rated output. Contacts and ambient conductor resistance are included.', 'Parallel battery branches use equal outgoing/return loop lengths and equal cross-sections; each pack has separate generic protection. Battery count meets energy and generic continuous charge/discharge limits of 100 A per pack.', 'Cable lengths follow physical terminal positions plus saved slack; the requested battery route is a minimum one-way main run. Actual geometry can require longer cables.', 'Provisional engineering design: regional ampacity, protection coordination, earthing, equipment compatibility and terminations require verification.','Generic equipment specifications; no manufacturer suitability or installed-price optimum is claimed.']
  assertDesignConnections(p)
  return p
}

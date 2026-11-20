import { blankProject, makeDevice, connect, type Device, type Project, type Requirements, type Wire } from './model'
import { physicalWirePoints, routeLength, synchronizeLengths } from './geometry'
import { sizeVoltageDropPath,type DesignSizingPath } from './design-sizing'
import { createEquipmentGroup } from './equipment-groups'
import { applyCatalogRecord } from './catalog-device'
import type { ArrayOption } from './design-options'
import type { PhaseDesign } from './design-phases'
import { scheduleDemand } from './appliances'
import {defaultInstallation,sizeAmpacity} from './ampacity'

export function auxiliaryChargeCurrent(r: Requirements): number {
  return r.acInput === 'shore' || r.acInput === 'generator' ? 10 : 0
}

export function buildDesignTopology(r: Requirements, option: ArrayOption, packs: number, phases: PhaseDesign[], paths:DesignSizingPath[]=[]): Project {
  if (!Number.isSafeInteger(packs) || packs < 1) throw new Error('Battery pack quantity must be a positive integer.')
  const sizePath=(wires:Wire[],current:number,voltage:number,fraction:number,temperature:number,label:string,minimumArea=1.5)=>{
    paths.push({wireIds:wires.map(w=>w.id),current,voltage,fraction,temperature,label,minimumArea})
    sizeVoltageDropPath(wires,current,voltage,fraction,temperature,label,minimumArea)
    const protection=p.devices.filter(d=>d.kind==='fuse'&&wires.some(w=>w.from===d.id||w.to===d.id)).sort((a,b)=>b.spec.rating-a.spec.rating)[0]
    for(const w of wires){w.installation??=defaultInstallation(r.region);w.installation.designCurrent=Math.max(w.installation.designCurrent??0,current);if(protection)w.installation.protectionId=protection.id}
    sizeAmpacity(wires,r.region,current,protection?.spec.rating??current)
    return Math.max(...wires.map(w=>w.area))
  }
  let p = blankProject(); p.requirements = { ...r, arrayOptionId: option.id };p.engineering={region:r.region}
  if (r.appliances?.length) p.scheduleHour = scheduleDemand(r.appliances).peakHour
  const add = (kind: Device['kind'], x: number, y: number, name: string, physical: Device['physical']) => {
    const device = makeDevice(kind, x, y, name); device.physical = physical; p.devices.push(device); return device
  }
  const minimumLength = (wire: Wire, minimum: number) => {
    const measured = routeLength(physicalWirePoints(p, wire))
    wire.lengthMode = 'physical'; wire.slack = Math.max(0, minimum - measured); wire.length = measured + wire.slack
    return wire
  }
  const wire = (a: Device, ap: string, b: Device, bp: string, minimum = 0, color?: string) => {
    const conductor = minimumLength(connect(a, ap, b, bp), r.cableLength === undefined ? 0 : minimum)
    if (color) conductor.color = color
    p.wires.push(conductor); return conductor
  }
  const positiveColor = '#d47c62', negativeColor = '#738496'
  const bankY = Math.max(option.strings * 600 + 900, 2400)
  const positive = add('bus', 3900, bankY, 'Battery positive bus', [.5, .5, 1])
  const negative = add('bus', 3900, bankY + 600, 'Battery negative bus', [.5, .2, 1])
  let stringIndex = 0
  for (const [controllerIndex, stringCount] of option.stringsPerController.entries()) {
    const memberIds: string[] = [], offset = controllerIndex * 4, y = stringIndex * 600
    const plus = add('bus', 1950, y, `PV ${controllerIndex + 1} positive collector`, [offset + 2, .8, -.5])
    const minus = add('bus', 1950, y + 600, `PV ${controllerIndex + 1} negative collector`, [offset + 2, .4, -.5])
    memberIds.push(plus.id, minus.id)
    const initial = add('mppt', 2600, y + 300, 'Solar controller', [offset + 2.8, .8, 0])
    const controller = applyCatalogRecord(initial, option.controller)
    controller.name = `${option.controller.name} / MPPT ${controllerIndex + 1}`
    controller.spec.voltage = option.series * option.panel.moduleVmp!
    controller.spec.watts = option.series * stringCount * option.panel.power!
    p.devices[p.devices.indexOf(initial)] = controller
    for (let string = 0; string < stringCount; string++, stringIndex++) {
      const panels: Device[] = []
      for (let module = 0; module < option.series; module++) {
        const initialPanel = add('pv', module * 550, stringIndex * 600, 'Panel', [offset + module * 1.3, 1.1, -string * 2.5])
        const panel = applyCatalogRecord(initialPanel, option.panel)
        panel.name = `PV string ${stringIndex + 1} / panel ${module + 1}`; panel.rotation = [-Math.PI / 2, 0, 0]
        p.devices[p.devices.indexOf(initialPanel)] = panel; panels.push(panel); memberIds.push(panel.id)
      }
      const protection = add('fuse', option.series * 550, stringIndex * 600, `PV string ${stringIndex + 1} protection`, [offset + 2, .8, -string * 2.5])
      const fuseA = [10, 15, 20, 25, 30, 40, 50].find(value => value >= option.stringIsc * 1.25 && (option.panel.maxSeriesFuseA === undefined || value <= option.panel.maxSeriesFuseA))
      if (!fuseA) throw new Error('No string protection rating fits the panel current and series-fuse limit.')
      protection.spec.rating = fuseA; memberIds.push(protection.id)
      const path = [wire(panels[0], 'p', protection, 'p'), wire(protection, 'n', plus, 'p', 0, positiveColor), wire(panels.at(-1)!, 'n', minus, 'p', 0, negativeColor)]
      for (let i = 0; i < panels.length - 1; i++) path.push(wire(panels[i], 'n', panels[i + 1], 'p'))
      sizePath(path, option.stringIsc, option.hotVmp, .005, p.ambient, `PV string ${stringIndex + 1}`, 4)
    }
    sizePath([wire(plus, 'n', controller, 'pv+', 2, positiveColor), wire(minus, 'n', controller, 'pv-', 2, negativeColor)], stringCount * option.stringIsc, option.hotVmp, .015, p.ambient, `MPPT ${controllerIndex + 1} collector`, 4)
    const protection = add('fuse', 3250, y + 300, `MPPT ${controllerIndex + 1} output protection`, [offset + 3, .5, .5])
    protection.spec.rating = option.controller.batteryFuseMinimumA ?? Math.ceil(controller.spec.rating * 1.25 / 5) * 5
    sizePath([wire(controller, 'bat+', protection, 'p', 1), wire(protection, 'n', positive, 't', 1, positiveColor), wire(controller, 'bat-', negative, 't', 2, negativeColor)], controller.spec.rating, 44, .015, p.ambient, `MPPT ${controllerIndex + 1} output`, 6)
    p = createEquipmentGroup(p, memberIds, `Solar array ${controllerIndex + 1} / ${option.series * stringCount} panels`)
  }
  const branches: Wire[][] = [], batteryIds = [positive.id, negative.id]
  for (let i = 0; i < packs; i++) {
    const battery = add('battery', 2600, bankY + i * 600, `Battery pack ${i + 1} / 5.12 kWh`, [i * .6, 0, 2])
    Object.assign(battery.spec, { voltage: 51.2, capacityAh: 100, rating: 100, resistance: .015 })
    const protection = add('fuse', 3250, bankY + i * 600, `Battery pack ${i + 1} protection`, [i * .6, .3, 1.7]); protection.spec.rating = 125
    batteryIds.push(battery.id, protection.id)
    branches.push([wire(battery, 'p', protection, 'p'), wire(protection, 'n', positive, 'p', 0, positiveColor), wire(battery, 'n', negative, 'p', 0, negativeColor)])
  }
  const branchLength = Math.max(1, ...branches.flatMap(path => [path[0].length + path[1].length, path[2].length]))
  const inputCurrent = phases.reduce((sum, phase) => sum + (Math.max(phase.inverterW,phase.startupW) / .94 + 8) / 44, 0)
  const chargeCurrent = auxiliaryChargeCurrent(r)
  for (const path of branches) {
    minimumLength(path[1], branchLength - path[0].length); minimumLength(path[2], branchLength)
    sizePath(path, Math.max(inputCurrent, option.chargeCurrent + chargeCurrent) / packs, 44, .005, p.ambient, 'Parallel battery branch', 10)
  }
  const neutral = phases.length > 1 ? add('bus', 6500, bankY + 900, 'AC shared neutral', [4, .5, 1]) : null
  const voltage = r.region === 'US' ? 120 : 230, frequency = r.region === 'US' ? 60 : 50
  if (chargeCurrent > 0) {
    const y = bankY + Math.max(packs, phases.length * 3) * 600 + 600
    const generator = r.acInput === 'generator'
    const source = add(generator ? 'generator' : 'grid', 650, y, generator ? 'Portable generator' : 'Grid / shore supply', [-2, 0, .1])
    Object.assign(source.spec, { voltage, frequency })
    const acFuse = add('fuse', 1300, y, 'AC input protection', [-1.3, .5, .1])
    const charger = add('charger', 1950, y, '48 V auxiliary battery charger', [-.7, .5, .1])
    Object.assign(charger.spec, { voltage, frequency, chargeVoltage: 57.6, rating: chargeCurrent })
    // The rectifier draws pulsed AC current. Size this generic input with a 0.5 power factor allowance.
    const acCurrent = (57.6 * chargeCurrent / charger.spec.efficiency + charger.spec.idleWatts!) / (voltage * .5)
    acFuse.spec.rating = Math.ceil(acCurrent * 1.25 / 5) * 5
    acFuse.ports = [{ ...acFuse.ports[0], label: 'L in' }, { ...acFuse.ports[1], label: 'L out' }]
    sizePath([wire(source, 'p', acFuse, 'p'), wire(acFuse, 'n', charger, 'l', 0, '#a78053'), wire(source, 'n', charger, 'n')], acCurrent, voltage, .01, p.ambient, 'Auxiliary AC input')
    const dcFuse = add('fuse', 2600, y, 'Auxiliary charger DC protection', [-.2, .5, .4])
    dcFuse.spec.rating = Math.ceil(chargeCurrent * 1.25 / 5) * 5
    sizePath([wire(charger, 'bat+', dcFuse, 'p'), wire(dcFuse, 'n', positive, 't', 0, positiveColor), wire(charger, 'bat-', negative, 't', 0, negativeColor)], chargeCurrent, 44, .015, p.ambient, 'Auxiliary charger output', 4)
  }
  for (const [phaseIndex, phase] of phases.entries()) {
    const y = bankY + phaseIndex * 1500, z = 1 + phaseIndex * 1.2
    const protection = add('fuse', 4550, y, phases.length === 1 ? 'Main battery protection' : `Phase ${phase.name} battery protection`, [1, .5, z])
    protection.spec.rating = Math.ceil(((phase.inverterW / .94 + 8) / 44) * 1.25 / 25) * 25
    const inverter = add('inverter', 5200, y, `${phase.inverterW / 1000} kW inverter / phase ${phase.name}`, [1.5, .2, z])
    Object.assign(inverter.spec, { watts: phase.inverterW, rating: phase.inverterW * 2, voltage, frequency, phaseDegrees: phase.angle })
    sizePath([wire(positive, 'n', protection, 'p', (r.cableLength ?? 0) / 2, positiveColor), wire(protection, 'n', inverter, 'dc+', (r.cableLength ?? 0) / 2, positiveColor), wire(negative, 'n', inverter, 'dc-', r.cableLength ?? 0, negativeColor)], (phase.inverterW / .94 + 8) / 44, 44, .015, p.ambient, `Phase ${phase.name} inverter supply`, 10)
    const acProtection = add('fuse', 5800, y, `Phase ${phase.name} AC output protection`, [2.2, .5, z]); acProtection.spec.rating = Math.ceil(Math.max(phase.inverterW,phase.startupW) / voltage * 1.25 / 5) * 5
    const output = wire(inverter, 'l', acProtection, 'p', 1, '#a78053')
    const neutralFeed = neutral ? wire(inverter, 'n', neutral, 'p', 1, '#6291bc') : null
    output.area = 1.5
    if (neutralFeed) neutralFeed.area = 1.5
    const items = r.appliances?.length ? phase.appliances : [{ id: 'aggregate', name: `Essential loads / phase ${phase.name}`, watts: phase.demandW, quantity: 1, startHour: 0, endHour: 24, startupMultiplier: 1, startupSeconds: 0, phase: 'auto' as const }]
    for (const [index, item] of items.entries()) {
      const load = add(item.startupMultiplier > 1 ? 'motor' : 'load', 6500 + index * 600, y + index * 300, item.name, [3 + index * .5, 0, z + .5])
      if(r.appliances?.length)load.applianceId=item.id
      Object.assign(load.spec, { voltage, frequency, watts: item.watts * item.quantity, surge: item.startupMultiplier, startupSeconds: item.startupSeconds })
      if (r.appliances?.length) load.schedule = { startHour: item.startHour, endHour: item.endHour }
      const path = [output, wire(acProtection, 'n', load, 'p', 5, '#a78053'), wire(neutral ?? inverter, 'n', load, 'n', 5, '#6291bc')]
      if (neutralFeed) path.push(neutralFeed)
      sizePath(path, phase.inverterW / voltage, voltage, .01, p.ambient, `Phase ${phase.name} AC branch`, Math.max(output.area, neutralFeed?.area ?? 1.5))
    }
  }
  if (packs > 1) p = createEquipmentGroup(p, batteryIds, `Battery bank / ${packs} packs`)
  const extraColumns=Math.max(0,option.series-2)*550
  if(extraColumns){for(const d of p.devices)if(d.kind!=='pv'&&!d.name.startsWith('PV string ')&&d.x>=1950)d.x+=extraColumns;for(const g of p.groups??[])if(g.x>=1950)g.x+=extraColumns}
  if (p.devices.length > 500 || p.wires.length > 2000) throw new Error('This proposal exceeds the 500-equipment / 2000-conductor project capacity. Reduce the design or divide the installation.')
  return synchronizeLengths(p)
}

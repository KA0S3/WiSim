export type Kind = 'battery' | 'pv' | 'mppt' | 'inverter' | 'charger' | 'load' | 'dc-load' | 'motor' | 'grid' | 'three-phase' | 'resistor' | 'capacitor' | 'inductor' | 'diode' | 'switch' | 'fuse' | 'bus' | 'ground'
export type Domain = 'dc' | 'ac' | 'earth'
import {validBuilding,type BuildingLayout,type PlanPoint} from './building-model'
export type Port = { id: string; label: string; domain: Domain; side: 'left' | 'right' | 'top' | 'bottom'; offset: number; anchor?:[number,number,number] }
import {physicalProfile} from './profiles'
import {validEngineering,validInstallation,validProtection,validBatteryLimits,validTermination,type Engineering,type Installation,type Protection,type BatteryLimits,type Termination} from './engineering-model'
export type Spec = {
  voltage: number; watts: number; capacityAh: number; resistance: number; rating: number;
  efficiency: number; frequency: number; capacitance: number; inductance: number;
  surge: number; startupSeconds: number; cutoff: number; voc: number; isc: number;
  width: number; height: number; depth: number; chargeVoltage?:number; idleWatts?:number;
  mppCurrent?:number;vocTemperatureCoefficientPerC?:number;powerTemperatureCoefficientPerC?:number;iscTemperatureCoefficientPerC?:number;
  maxSeriesFuseA?:number;pvMaxOperatingVoltage?:number;pvMaxShortCircuitCurrent?:number;pvMaxPower?:number;pvStartHeadroom?:number;pvRunHeadroom?:number;
  phaseDegrees?:number;dcMaxVoltage?:number;dcMaxCurrent?:number;
}
export type Triple = [number,number,number]
export type StructureKind = 'wall' | 'roof' | 'rail' | 'box' | 'floor'
export type Structure = {id:string;reference?:string;kind:StructureKind;name:string;position:Triple;rotation:Triple;size:Triple;color:string;polygons?:PlanPoint[][];building?:{id:string;floor:number;stage:'wall'|'floor'|'roof';wallId?:string;roomId?:string}}
export type Mount = {structureId:string;face:'front'|'inside'|'back';offset:Triple;rotation:Triple}
export type SolarSite={enabled:boolean;latitude:number;longitude:number;date:string;utcOffsetMinutes:number;diffuseFraction:number}
export type Device = { applianceId?:string; id: string; reference?:string; kind: Kind; name: string; model?: string; physicalProfile?:string; x: number; y: number; physical: Triple; rotation?:Triple; mount?:Mount; spec: Spec; on: boolean; ports: Port[]; schedule?:{startHour:number;endHour:number};protection?:Protection;batteryLimits?:BatteryLimits }
export type Wire = { reference?:string; lengthMode?: 'manual' | 'physical'; route3d?: [number, number, number][]; autoRoute?:{supportIds:string[];error?:string}; slack?: number; id: string; from: string; fromPort: string; to: string; toPort: string; area: number; length: number; material: 'copper' | 'aluminium'; contactMilliOhm: number; color: string;installation?:Installation;terminations?:{from?:Termination;to?:Termination} }
export type Appliance = {id:string;name:string;watts:number;quantity:number;startHour:number;endHour:number;startupMultiplier:number;startupSeconds:number;phase:'auto'|'A'|'B'|'C'}
export type Requirements = { context: 'home' | 'mobile' | 'workshop'; region: 'ZA' | 'GB' | 'US'; dailyKwh: number; peakW: number; autonomyHours: number; sunHours: number; cableLength?: number; reserve: number; priority: 'cost' | 'headroom'; phases: 'single' | 'split' | 'three'; coldTemperature?:number;hotTemperature?:number;maxPanelArea?:number;panelId?:string;arrayOptionId?:string;panelWatts?:number;panelCount?:number;stringCount?:number;appliances?:Appliance[];building?:BuildingLayout }
export type EquipmentGroup = {id:string;name:string;kind:'pv-array'|'battery-bank'|'conversion-stack';members:string[];collapsed:boolean;x:number;y:number}
export type Project = { schemaVersion: 4; id: string; name: string; devices: Device[]; wires: Wire[]; groups?:EquipmentGroup[]; structures?:Structure[]; building?:BuildingLayout; fitIssues?:string[]; solarSite?:SolarSite; nextReferences?:{device:number;wire:number;structure:number}; sun: number; ambient: number; initialSoc: number; requirements?: Requirements; scheduleHour?:number; engineering?:Engineering; designNotes?: string[]; learn?: { scenarioId: string; runId: string; sample: Record<string, number>; startedAt: number; completed: boolean; task?:'build'|'repair'; completedAt?: number; achievement?: string } }
export type DeviceReading = { voltage: number; current: number; power: number; state: 'active' | 'idle' | 'open' | 'warning' | 'tripped'; soc?: number; exposure?:number; inputVoltage?:number; inputCurrent?:number; inputPower?:number; storedEnergyJ?:number }
export type WireReading = { current: number; drop: number; loss: number; resistance: number }
export type Finding = { id: string; severity: 'info' | 'warning' | 'fault'; title: string; detail: string; target?: string }
export type NumericSeries=number[]|Float64Array
export type Frame = { revision: number; time: number; durationMs: number; devices: Record<string, DeviceReading>; wires: Record<string, WireReading>; terminals: Record<string, number>; waveforms: Record<string, NumericSeries>; times: NumericSeries; measurements?:Record<string,{ac:boolean;frequency:number|null;observationFrequency?:number|null}>; findings: Finding[]; engine: string }
export type RuntimeState = { time: number; soc: Record<string, number>; capacitors: Record<string, number>; inductors: Record<string, number>; trips: string[]; tripCauses?: Record<string,string>; overloadSeconds: Record<string, number>; nodes: Record<string, number>; starts: Record<string, number>; enabled: Record<string, boolean> }
export const emptyState = (): RuntimeState => ({ time: 0, soc: {}, capacitors: {}, inductors: {}, trips: [], overloadSeconds: {}, nodes: {}, starts: {}, enabled: {} })
export const uid = (prefix = 'id') => `${prefix}-${crypto.randomUUID().slice(0, 8)}`
const p = (id: string, label: string, domain: Domain, side: Port['side'], offset: number): Port => ({ id, label, domain, side, offset })
const pair = (domain: Domain = 'dc'): Port[] => [p('p', domain === 'ac' ? 'L' : '+', domain, 'left', 0.35), p('n', domain === 'ac' ? 'N' : '−', domain, 'left', 0.75)]
export const definitions: Record<Kind, { label: string; category: string; description: string; color: string; ports: Port[]; spec: Partial<Spec> }> = {
  battery: { label: 'Battery', category: 'Sources', description: 'Storage · internal resistance & SOC', color: '#267663', ports: pair(), spec: { voltage: 51.2, capacityAh: 100, resistance: 0.015, rating: 100, width: .44, height: .5, depth: .17 } },
  pv: { label: 'Solar array', category: 'Sources', description: 'PV · irradiance & temperature', color: '#376c97', ports: [p('p', '+', 'dc', 'right', .35), p('n', '−', 'dc', 'right', .75)], spec: { watts: 1200, voltage: 80, voc: 96, isc: 16, width: 1.05, height: 1.75, depth: .035 } },
  grid: { label: 'Grid / shore', category: 'Sources', description: 'Single-phase AC supply', color: '#647a83', ports: [p('p', 'L', 'ac', 'right', .35), p('n', 'N', 'ac', 'right', .75)], spec: { width: 0.28, height: 0.34, depth: 0.12, voltage: 230, frequency: 50, resistance: .05 } },
  'three-phase': { label: 'Three-phase source', category: 'Sources', description: 'A / B / C / N · 120° phase separation', color: '#465d74', ports: [p('a', 'A', 'ac', 'right', .2), p('b', 'B', 'ac', 'right', .4), p('c', 'C', 'ac', 'right', .6), p('n', 'N', 'ac', 'right', .8)], spec: { width: 0.4, height: 0.44, depth: 0.16, voltage: 230, frequency: 50, resistance: .05 } },
  mppt: { label: 'Solar controller', category: 'Conversion', description: 'PV operating-point model · current limit', color: '#c49a4c', ports: [p('pv+', 'PV+', 'dc', 'left', .35), p('pv-', 'PV−', 'dc', 'left', .75), p('bat+', 'BAT+', 'dc', 'right', .35), p('bat-', 'BAT−', 'dc', 'right', .75)], spec: { width: 0.24, height: 0.3, depth: 0.12, watts: 1200, voltage: 80, rating: 35, efficiency: .96, voc: 150 } },
  charger: {label:'AC battery charger',category:'Conversion',description:'AC to DC / current-limited charging',color:'#77609a',ports:[p('l','AC L','ac','left',.35),p('n','AC N','ac','left',.75),p('bat+','BAT+','dc','right',.35),p('bat-','BAT-','dc','right',.75)],spec:{ width: 0.18, height: 0.28, depth: 0.11,voltage:230,chargeVoltage:14.4,rating:15,efficiency:.9,idleWatts:2,capacitance:.001,resistance:1}},
  inverter: { label: 'Inverter', category: 'Conversion', description: 'DC → AC · efficiency & low-voltage cutoff', color: '#3079b5', ports: [p('dc+', 'DC+', 'dc', 'left', .35), p('dc-', 'DC−', 'dc', 'left', .75), p('l', 'L', 'ac', 'right', .35), p('n', 'N', 'ac', 'right', .75)], spec: { voltage: 230, watts: 3000, rating: 6000, efficiency: .94, cutoff: 44, frequency: 50, resistance: .06, width: .32, height: .55, depth: .19 } },
  load: { label: 'AC appliance', category: 'Loads', description: 'Resistive AC appliance', color: '#d7ba83', ports: pair('ac'), spec: { width: 0.24, height: 0.3, depth: 0.16, voltage: 230, watts: 600 } },
  'dc-load': { label: 'DC appliance', category: 'Loads', description: 'Resistive DC load / bleeder', color: '#c48256', ports: pair(), spec: { width: 0.18, height: 0.16, depth: 0.12, voltage: 51.2, watts: 120 } },
  motor: { label: 'Motor / pump', category: 'Loads', description: 'Inductive load · configurable startup', color: '#687b8f', ports: pair('ac'), spec: { width: 0.36, height: 0.28, depth: 0.32, voltage: 230, watts: 750, surge: 4, startupSeconds: .8, inductance: .02 } },
  resistor: { label: 'Resistor', category: 'Components', description: 'Linear resistor / discharge load', color: '#ad8663', ports: [p('p', '1', 'dc', 'left', .5), p('n', '2', 'dc', 'right', .5)], spec: { width: 0.16, height: 0.07, depth: 0.07, resistance: 100 } },
  capacitor: { label: 'Capacitor', category: 'Components', description: 'Charge storage · retained transient state', color: '#51769a', ports: [p('p', '+', 'dc', 'left', .5), p('n', '−', 'dc', 'right', .5)], spec: { width: 0.1, height: 0.18, depth: 0.1, capacitance: .001, voltage: 100 } },
  inductor: { label: 'Inductor', category: 'Components', description: 'Magnetic energy · retained transient state', color: '#b57648', ports: [p('p', '1', 'dc', 'left', .5), p('n', '2', 'dc', 'right', .5)], spec: { width: 0.16, height: 0.15, depth: 0.12, inductance: .01, resistance: .1 } },
  diode: { label: 'Diode', category: 'Components', description: 'Generic silicon junction', color: '#404c58', ports: [p('p', 'A', 'dc', 'left', .5), p('n', 'K', 'dc', 'right', .5)], spec: { width: 0.12, height: 0.05, depth: 0.05,} },
  switch: { label: 'Isolator', category: 'Distribution', description: 'Open / closed electrical path', color: '#d8d8cf', ports: [p('p', 'IN', 'dc', 'left', .5), p('n', 'OUT', 'dc', 'right', .5)], spec: { width: 0.09, height: 0.15, depth: 0.08, resistance: .001 } },
  fuse: { label: 'Fuse', category: 'Distribution', description: 'Generic timed overcurrent protection', color: '#d2bd83', ports: [p('p', 'IN', 'dc', 'left', .5), p('n', 'OUT', 'dc', 'right', .5)], spec: { width: 0.07, height: 0.13, depth: 0.065, rating: 100, resistance: .001 } },
  bus: { label: 'Busbar', category: 'Distribution', description: 'Single-potential distribution bar', color: '#957151', ports: [p('p', '1', 'dc', 'left', .5), p('n', '2', 'dc', 'right', .5), p('t', '3', 'dc', 'top', .5), p('b', '4', 'dc', 'bottom', .5)], spec: { resistance: .0001, width: .2, height: .04, depth: .03 } },
  ground: { label: 'Earth reference', category: 'Distribution', description: 'Explicit electrical reference', color: '#829b51', ports: [p('p', 'PE', 'earth', 'top', .5)], spec: { width: 0.12, height: 0.06, depth: 0.1,} },
}
export function makeDevice(kind: Kind, x: number, y: number, name?: string): Device {
  const d = definitions[kind]
  return { id: uid(kind), kind, name: name ?? d.label, physicalProfile:undefined, x, y, physical: [x / 400, 0, y / 400], on: true, ports: structuredClone(d.ports), spec: { voltage: 51.2, watts: 100, capacityAh: 100, resistance: .01, rating: 100, efficiency: .95, frequency: 50, capacitance: .001, inductance: .01, surge: 1, startupSeconds: 0, cutoff: 0, voc: 100, isc: 10, width: .25, height: .22, depth: .1, ...d.spec } }
}
export function connect(a: Device, ap: string, b: Device, bp: string, area = 16, length = 2): Wire {
  const port = a.ports.find(p => p.id === ap)
  return { id: uid('wire'), from: a.id, fromPort: ap, to: b.id, toPort: bp, area, length, material: 'copper', contactMilliOhm: .2, color: port?.domain === 'ac' ? (ap === 'n' ? '#6291bc' : '#a78053') : ap.includes('-') || ap === 'n' ? '#738496' : '#d47c62' }
}
export function wireResistance(w: Wire, temperature: number) { return ((w.material === 'copper' ? .0175 : .0287) * w.length / w.area) * (1 + .00393 * (temperature - 20)) + w.contactMilliOhm / 1000 }
export function blankProject(): Project { return { schemaVersion: 4, id: uid('project'), name: 'Untitled workbench', devices: [], wires: [], sun: 85, ambient: 25, initialSoc: 80 } }
export function validateProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false
  const p = value as Project
  const validId = (id: unknown): id is string => typeof id === 'string' && /^[\w-]+$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id)
  if (p.schemaVersion !== 4 || !validId(p.id) || typeof p.name !== 'string' || !Array.isArray(p.devices) || !Array.isArray(p.wires) || p.devices.length > 500 || p.wires.length > 2000) return false
  if (![p.sun, p.ambient, p.initialSoc].every(Number.isFinite) || p.sun < 0 || p.sun > 100 || p.initialSoc < 0 || p.initialSoc > 100 || p.ambient < -100 || p.ambient > 150) return false
  const ids = new Set<string>()
  if(p.building!==undefined&&!validBuilding(p.building)||p.requirements?.building!==undefined&&!validBuilding(p.requirements.building))return false
  if(p.fitIssues!==undefined&&(!Array.isArray(p.fitIssues)||p.fitIssues.some(issue=>typeof issue!=='string')))return false
  if(p.engineering!==undefined&&!validEngineering(p.engineering))return false
  if(p.solarSite!==undefined){const s=p.solarSite;if(!s||typeof s.enabled!=='boolean'||![s.latitude,s.longitude,s.utcOffsetMinutes,s.diffuseFraction].every(Number.isFinite)||Math.abs(s.latitude)>90||Math.abs(s.longitude)>180||Math.abs(s.utcOffsetMinutes)>840||s.diffuseFraction<0||s.diffuseFraction>1||typeof s.date!=='string'||!Number.isFinite(Date.parse(s.date)))return false}
  const refs=new Set<string>()
  for(const [items,prefix]of [[p.devices,'D'],[p.wires,'W'],[p.structures??[],'S']] as const){
    if(!Array.isArray(items))return false
    for(const item of items)if(item?.reference!==undefined){if(typeof item.reference!=='string'||!new RegExp('^'+prefix+'[1-9][0-9]{0,8}$').test(item.reference)||refs.has(item.reference))return false;refs.add(item.reference)}
  }
  if(p.nextReferences!==undefined&&(!p.nextReferences||!['device','wire','structure'].every(k=>Number.isSafeInteger(p.nextReferences![k as keyof typeof p.nextReferences])&&p.nextReferences![k as keyof typeof p.nextReferences]>0&&p.nextReferences![k as keyof typeof p.nextReferences]<=1e9)))return false
  const triple=(v:unknown):v is Triple=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)
  const validSchedule=(s:{startHour:number;endHour:number})=>s&&Number.isFinite(s.startHour)&&Number.isFinite(s.endHour)&&s.startHour>=0&&s.startHour<24&&s.endHour>=0&&s.endHour<=24
  if(p.scheduleHour!==undefined&&(!Number.isFinite(p.scheduleHour)||p.scheduleHour<0||p.scheduleHour>=24))return false
  if(p.requirements?.appliances!==undefined){
    const appliances=p.requirements.appliances
    if(!Array.isArray(appliances)||appliances.length>100||new Set(appliances.map(a=>a?.id)).size!==appliances.length)return false
    for(const a of appliances)if(!a||!validId(a.id)||typeof a.name!=='string'||!a.name.trim()||!validSchedule(a)||![a.watts,a.quantity,a.startupMultiplier,a.startupSeconds].every(Number.isFinite)||a.watts<=0||!Number.isSafeInteger(a.quantity)||a.quantity<1||a.startupMultiplier<1||a.startupSeconds<0||!['auto','A','B','C'].includes(a.phase))return false
  }
  if(p.structures!==undefined){
    if(!Array.isArray(p.structures)||p.structures.length>5000)return false
    for(const s of p.structures){
      if(!s||!validId(s.id)||ids.has(s.id)||!['wall','roof','rail','box','floor'].includes(s.kind)||typeof s.name!=='string'||!triple(s.position)||!triple(s.rotation)||!triple(s.size)||s.size.some(n=>n<=0)||!/^#[0-9a-f]{6}$/i.test(s.color))return false
      if(s.polygons!==undefined&&(!Array.isArray(s.polygons)||s.polygons.length>5000||s.polygons.some(poly=>!Array.isArray(poly)||poly.length<3||poly.length>5000||poly.some(point=>!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)))))return false
      if(s.building!==undefined&&(!s.building||!validId(s.building.id)||!Number.isSafeInteger(s.building.floor)||s.building.floor<0||!['wall','floor','roof'].includes(s.building.stage)||s.building.wallId!==undefined&&!validId(s.building.wallId)||s.building.roomId!==undefined&&!validId(s.building.roomId)))return false
      ids.add(s.id)
    }
  }
  for (const d of p.devices) {
    if (!d || !validId(d.id) || ids.has(d.id) || !Object.hasOwn(definitions,d.kind) || typeof d.name !== 'string' || typeof d.on !== 'boolean' || ![d.x, d.y].every(Number.isFinite) || !d.spec || !Array.isArray(d.physical) || d.physical.length !== 3 || !d.physical.every(Number.isFinite)) return false
    ids.add(d.id)
    if(d.protection!==undefined&&(d.kind!=='fuse'||!validProtection(d.protection))||d.batteryLimits!==undefined&&(d.kind!=='battery'||!validBatteryLimits(d.batteryLimits)))return false
    if(d.schedule!==undefined&&!validSchedule(d.schedule))return false
    if(d.spec.phaseDegrees!==undefined&&(!Number.isFinite(d.spec.phaseDegrees)||d.spec.phaseDegrees<0||d.spec.phaseDegrees>=360))return false
    if(d.physicalProfile!==undefined&&physicalProfile(d.physicalProfile)?.kind!==d.kind)return false
    if(d.spec.chargeVoltage!==undefined&&(!Number.isFinite(d.spec.chargeVoltage)||d.spec.chargeVoltage<=0))return false
    if(d.spec.idleWatts!==undefined&&(!Number.isFinite(d.spec.idleWatts)||d.spec.idleWatts<0))return false
    for(const k of ['dcMaxVoltage','dcMaxCurrent','mppCurrent','maxSeriesFuseA','pvMaxOperatingVoltage','pvMaxShortCircuitCurrent','pvMaxPower','pvStartHeadroom','pvRunHeadroom'] as const)if(d.spec[k]!==undefined&&(!Number.isFinite(d.spec[k])||d.spec[k]!<=0))return false
    for(const k of ['vocTemperatureCoefficientPerC','powerTemperatureCoefficientPerC','iscTemperatureCoefficientPerC'] as const)if(d.spec[k]!==undefined&&(!Number.isFinite(d.spec[k])||Math.abs(d.spec[k]!)>.02))return false
    if(d.rotation!==undefined&&!triple(d.rotation))return false
    if(d.mount){const structure=p.structures?.find(s=>s.id===d.mount!.structureId);if(!structure||!['front','inside','back'].includes(d.mount.face)||d.mount.face==='inside'&&structure.kind!=='box'||d.mount.face==='back'&&structure.kind!=='wall'||!triple(d.mount.offset)||!triple(d.mount.rotation))return false}
    for (const key of Object.keys(makeDevice(d.kind, 0, 0).spec) as (keyof Spec)[]) {const n=d.spec[key];if(typeof n!=='number'||!Number.isFinite(n)||n<0)return false}
    if (d.spec.voltage <= 0 || d.spec.width <= 0 || d.spec.height <= 0 || d.spec.depth <= 0 || d.spec.efficiency <= 0 || d.spec.efficiency > 1 || d.spec.frequency <= 0 || d.spec.capacityAh <= 0) return false
    const expected = [...definitions[d.kind].ports,...(d.kind!=='ground'&&Array.isArray(d.ports)&&d.ports.some(p=>p?.id==='pe')?[{id:'pe',domain:'earth'}]:[])]
    if(Array.isArray(d.ports)&&d.ports.some(port=>port?.anchor!==undefined&&(!triple(port.anchor)||port.anchor.some(n=>Math.abs(n)>1))))return false
    if (!Array.isArray(d.ports) || d.ports.length !== expected.length || d.ports.some((port, i) => !port || port.id !== expected[i].id || port.domain !== expected[i].domain || typeof port.label !== 'string' || !['left','right','top','bottom'].includes(port.side) || !Number.isFinite(port.offset) || port.offset < 0 || port.offset > 1)) return false
  }
  const wires = new Set<string>()
  for (const w of p.wires) {
    if (!w || !validId(w.id) || ids.has(w.id) || wires.has(w.id)) return false
    wires.add(w.id)
    if(w.installation!==undefined&&!validInstallation(w.installation)||w.terminations!==undefined&&(!w.terminations||Object.keys(w.terminations).some(k=>!['from','to'].includes(k))||Object.values(w.terminations).some(t=>!validTermination(t))))return false
    if(w.lengthMode!==undefined&&!['manual','physical'].includes(w.lengthMode))return false
    if(w.autoRoute!==undefined&&(!w.autoRoute||w.lengthMode!=='physical'||!Array.isArray(w.autoRoute.supportIds)||w.autoRoute.supportIds.length>500||w.autoRoute.supportIds.some(id=>!validId(id))||w.autoRoute.error!==undefined&&typeof w.autoRoute.error!=='string'))return false
    if(w.slack!==undefined&&(!Number.isFinite(w.slack)||w.slack<0))return false
    if(w.route3d!==undefined&&(!Array.isArray(w.route3d)||w.route3d.length>1000||w.route3d.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))))return false
    if (!p.devices.find(d => d.id === w.from)?.ports.some(t => t.id === w.fromPort) || !p.devices.find(d => d.id === w.to)?.ports.some(t => t.id === w.toPort)) return false
    if (![w.area, w.length, w.contactMilliOhm].every(Number.isFinite) || w.area <= 0 || w.length < 0 || w.contactMilliOhm < 0 || !['copper', 'aluminium'].includes(w.material) || !/^#[0-9a-f]{6}$/i.test(w.color)) return false
  }
  if(p.groups!==undefined){
    if(!Array.isArray(p.groups)||p.groups.length>250)return false
    const members=new Set<string>()
    for(const g of p.groups){
      if(!g||!validId(g.id)||ids.has(g.id)||wires.has(g.id)||!['pv-array','battery-bank','conversion-stack'].includes(g.kind)||typeof g.name!=='string'||typeof g.collapsed!=='boolean'||![g.x,g.y].every(Number.isFinite)||!Array.isArray(g.members)||g.members.length<2)return false
      ids.add(g.id)
      const sources=g.kind==='conversion-stack'?['inverter','charger','mppt']:[g.kind==='pv-array'?'pv':'battery']
      if(!g.members.some(id=>p.devices.some(d=>d.id===id&&sources.includes(d.kind))))return false
      for(const id of g.members){const d=p.devices.find(d=>d.id===id);if(!d||members.has(id)||![...sources,'fuse','switch','bus'].includes(d.kind))return false;members.add(id)}
    }
  }
  if(p.learn!==undefined){
    const learn=p.learn
    if(learn?.task!==undefined&&!['build','repair'].includes(learn.task))return false
    if(!learn||typeof learn!=='object'||!validId(learn.scenarioId)||typeof learn.runId!=='string'||!Number.isFinite(learn.startedAt)||typeof learn.completed!=='boolean'||(learn.completedAt!==undefined&&!Number.isFinite(learn.completedAt))||learn.achievement!==undefined&&typeof learn.achievement!=='string')return false
    if(!learn.sample||typeof learn.sample!=='object'||Object.values(learn.sample).some(n=>!Number.isFinite(n)))return false
  }
  return true
}

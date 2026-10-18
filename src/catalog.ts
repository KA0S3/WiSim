import type { Terminal } from './simulation'

export type CatalogRecord = {
  id: string
  name: string
  family: string
  kind: 'pv' | 'battery' | 'mppt' | 'inverter' | 'load' | 'cable' | 'fuse' | 'bus' | 'ac-source' | 'transfer'
  status: 'verified' | 'partially verified' | 'reference only' | 'custom'
  productFamily?: string
  voltage?: number
  power?: number
  surge?: number
  pvVoc?: number
  current?: number
  chargeCurrent?: number
  dischargeCurrent?: number
  acVoltage?: number
  acFrequency?: number
  source?: string
  sourceChecked?: string
  interfaces?: Array<'VE.Direct' | 'VE.Bus' | 'VE.Can' | 'BMS' | 'GX'>
  terminalLayout?: Terminal[]
}

const sourcePages = {
  mppt: 'https://www.victronenergy.com/solar-charge-controllers',
  multi: 'https://www.victronenergy.com/inverters-chargers/multiplus-12v-24v-48v-800va-3kva',
  quattro: 'https://www.victronenergy.com/inverters-chargers/quattro',
  phoenix: 'https://www.victronenergy.com/inverters-chargers/phoenix-inverter',
  monitor: 'https://www.victronenergy.com/battery-monitors',
}

const namedVictronRecords: CatalogRecord[] = [
  ...['75/10', '75/15', '100/15', '100/20', '100/30', '100/50', '150/35', '150/45', '150/60', '150/70', '150/85', '250/60', '250/70', '250/85', '250/100'].map(model => ({ id: `victron-mppt-${model.replace('/', '-')}`, name: `SmartSolar MPPT ${model}`, family: 'Victron charge controllers', productFamily: 'SmartSolar MPPT', kind: 'mppt' as const, status: 'partially verified' as const, current: Number(model.split('/')[1]), pvVoc: Number(model.split('/')[0]), interfaces: ['VE.Direct' as const], source: sourcePages.mppt })),
  ...['12/800/35-16', '12/1200/50-16', '12/1600/70-16', '12/2000/80-30', '12/3000/120-50', '24/800/16', '24/1200/25', '24/1600/40-16', '24/2000/50', '24/3000/70-50', '24/5000/120-100', '48/3000/35-16', '48/5000/70-100'].map(model => ({ id: `victron-multiplus-${model.replace(/\//g, '-')}`, name: `MultiPlus ${model}`, family: 'Victron inverter/chargers', productFamily: 'MultiPlus', kind: 'inverter' as const, status: 'partially verified' as const, interfaces: ['VE.Bus' as const], source: sourcePages.multi })),
  ...['12/3000/120-50', '24/5000/120-100', '48/5000/70-100', '48/8000', '48/10000', '48/15000'].map(model => ({ id: `victron-quattro-${model.replace(/\//g, '-')}`, name: `Quattro ${model}`, family: 'Victron inverter/chargers', productFamily: 'Quattro', kind: 'inverter' as const, status: 'partially verified' as const, interfaces: ['VE.Bus' as const], source: sourcePages.quattro })),
  ...['12/500', '12/800', '12/1200', '12/1600', '12/2000', '12/3000', '24/1200', '24/1600', '24/2000', '24/3000', '24/5000', '48/1200', '48/3000', '48/5000'].map(model => ({ id: `victron-phoenix-${model.replace('/', '-')}`, name: `Phoenix Inverter ${model}`, family: 'Victron inverters', productFamily: 'Phoenix Inverter', kind: 'inverter' as const, status: 'partially verified' as const, interfaces: ['VE.Direct' as const], source: sourcePages.phoenix })),
  ...['300A', '500A', '1000A', '2000A'].flatMap(current => [{ id: `victron-smartshunt-${current}`, name: `SmartShunt IP21 ${current}`, family: 'Victron monitors', productFamily: 'SmartShunt', kind: 'bus' as const, status: 'partially verified' as const, current: Number.parseInt(current), interfaces: ['VE.Direct' as const], source: sourcePages.monitor }, { id: `victron-smartshunt-ip65-${current}`, name: `SmartShunt IP65 ${current}`, family: 'Victron monitors', productFamily: 'SmartShunt', kind: 'bus' as const, status: 'partially verified' as const, current: Number.parseInt(current), interfaces: ['VE.Direct' as const], source: sourcePages.monitor }]),
  ...['BMV-700', 'BMV-702', 'BMV-712 Smart', 'BMV-702 BLACK', 'BMV-700H', 'BMV-710H Smart'].map(model => ({ id: `victron-${model.toLowerCase().replace(/ /g, '-')}`, name: model, family: 'Victron monitors', productFamily: 'BMV', kind: 'bus' as const, status: 'partially verified' as const, interfaces: ['VE.Direct' as const], source: sourcePages.monitor })),
].map(record => record.source ? { ...record, sourceChecked: '2026-10-17' } : record)

const additionalVictronRecords: CatalogRecord[] = [
  ...['12/12-30', '12/24-15', '24/12-30', '24/24-17'].map(model => ({ id: `victron-orion-tr-smart-${model.replace('/', '-')}`, name: `Orion-Tr Smart ${model}`, family: 'Victron DC-DC converters', productFamily: 'Orion-Tr Smart', kind: 'mppt' as const, status: 'partially verified' as const, source: 'https://www.victronenergy.com/dc-dc-converters/orion-tr-dc-dc-converters-isolated' })),
  ...['12/15', '12/30', '24/16', '24/25'].map(model => ({ id: `victron-blue-smart-ip22-${model.replace('/', '-')}`, name: `Blue Smart IP22 Charger ${model}`, family: 'Victron chargers', productFamily: 'Blue Smart IP22 Charger', kind: 'mppt' as const, status: 'partially verified' as const, source: 'https://www.victronenergy.com/chargers/blue-smart-ip22-charger' })),
  ...['Cerbo GX', 'Cerbo-S GX', 'GX Touch 50'].map(model => ({ id: `victron-${model.toLowerCase().replace(/ /g, '-')}`, name: model, family: 'Victron communication centres', productFamily: 'GX Communication', kind: 'bus' as const, status: 'partially verified' as const, interfaces: ['VE.Direct', 'VE.Bus', 'VE.Can', 'GX'] as Array<'VE.Direct' | 'VE.Bus' | 'VE.Can' | 'BMS' | 'GX'>, source: 'https://www.victronenergy.com/communication-centres/cerbo-gx' })),
  ...['M8', 'M10'].map(model => ({ id: `victron-lynx-distributor-${model.toLowerCase()}`, name: `Lynx Distributor ${model}`, family: 'Victron distribution', productFamily: 'Lynx Distribution', kind: 'bus' as const, status: 'partially verified' as const, interfaces: ['VE.Can'] as Array<'VE.Direct' | 'VE.Bus' | 'VE.Can' | 'BMS' | 'GX'>, source: 'https://www.victronenergy.com/distribution-systems/lynx-distributor' })),
  ...['12/24V-65A', '12/24V-100A', '48V-100A'].map(model => ({ id: `victron-batteryprotect-${model.replace(/[\/]/g, '-')}`, name: `BatteryProtect ${model}`, family: 'Victron protection', productFamily: 'BatteryProtect', kind: 'fuse' as const, status: 'partially verified' as const, source: 'https://www.victronenergy.com/protection/batteryprotect' })),
  ...['V2', 'NG'].map(model => ({ id: `victron-ve-bus-bms-${model.toLowerCase()}`, name: `VE.Bus BMS ${model}`, family: 'Victron battery management', productFamily: 'VE.Bus BMS', kind: 'battery' as const, status: 'partially verified' as const, interfaces: ['VE.Bus', 'BMS'] as Array<'VE.Direct' | 'VE.Bus' | 'VE.Can' | 'BMS' | 'GX'>, source: 'https://www.victronenergy.com/battery-management/ve-bus-bms' })),
]

export const CATALOG_RECORDS: CatalogRecord[] = [
  { id: 'generic-pv-400', name: 'Generic PV Array 400 W', family: 'PV equipment', kind: 'pv', status: 'reference only', voltage: 36, power: 400, pvVoc: 44 },
  { id: 'generic-lifepo4-200', name: 'Generic LiFePO₄ 200 Ah', family: 'Batteries', kind: 'battery', status: 'reference only', voltage: 12.8, current: 150, chargeCurrent: 50, dischargeCurrent: 150 },
  { id: 'generic-mppt-100-30', name: 'Generic MPPT 100/30', family: 'Charge controllers', kind: 'mppt', status: 'reference only', voltage: 12, power: 430, current: 30 },
  { id: 'generic-inverter-1000', name: 'Generic Inverter 1000 W', family: 'Inverters', kind: 'inverter', status: 'reference only', voltage: 12, power: 1000, surge: 2000 },
  { id: 'victron-smartsolar-100-30', name: 'SmartSolar MPPT 100/30', family: 'Victron charge controllers', kind: 'mppt', status: 'verified', voltage: 12, power: 440, current: 30, pvVoc: 100, interfaces: ['VE.Direct'], terminalLayout: [{ id: 'pv+', label: 'PV +', domain: 'dc', role: 'pv', direction: 'sink' }, { id: 'pv-', label: 'PV −', domain: 'dc', role: 'negative', direction: 'sink' }, { id: 'bat+', label: 'BAT +', domain: 'dc', role: 'positive', direction: 'source' }, { id: 'bat-', label: 'BAT −', domain: 'dc', role: 'negative', direction: 'source' }], source: 'https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_100-30__100-50/en/technical-specifications.html', sourceChecked: '2026-10-18' },
  { id: 'victron-multiplus-12-1200', name: 'MultiPlus 12/1200/50', family: 'Victron inverter/chargers', kind: 'inverter', status: 'verified', voltage: 12, power: 1000, surge: 2400, acVoltage: 230, acFrequency: 50, interfaces: ['VE.Bus'], terminalLayout: [{ id: 'dc+', label: 'DC +', domain: 'dc', role: 'positive', direction: 'bidirectional' }, { id: 'dc-', label: 'DC −', domain: 'dc', role: 'negative', direction: 'bidirectional' }, { id: 'ac-in-l', label: 'AC IN L', domain: 'ac', role: 'ac-line', direction: 'sink' }, { id: 'ac-in-n', label: 'AC IN N', domain: 'ac', role: 'ac-neutral', direction: 'sink' }, { id: 'ac-out-l', label: 'AC OUT L', domain: 'ac', role: 'ac-line', direction: 'source' }, { id: 'ac-out-n', label: 'AC OUT N', domain: 'ac', role: 'ac-neutral', direction: 'source' }, { id: 'pe', label: 'PE', domain: 'earth', role: 'ac-earth', direction: 'bidirectional' }, { id: 'control', label: 'VE.Bus', domain: 'data', role: 'control', direction: 'bidirectional' }], source: 'https://www.victronenergy.com/upload/documents/Datasheet-MultiPlus-500VA-2000VA-EN.pdf', sourceChecked: '2026-10-18' },
  { id: 'victron-smartsolar-75-15', name: 'SmartSolar MPPT 75/15', family: 'Victron charge controllers', kind: 'mppt', status: 'verified', voltage: 12, power: 220, current: 15, pvVoc: 75, interfaces: ['VE.Direct'], terminalLayout: [{ id: 'pv+', label: 'PV +', domain: 'dc', role: 'pv', direction: 'sink' }, { id: 'pv-', label: 'PV −', domain: 'dc', role: 'negative', direction: 'sink' }, { id: 'bat+', label: 'BAT +', domain: 'dc', role: 'positive', direction: 'source' }, { id: 'bat-', label: 'BAT −', domain: 'dc', role: 'negative', direction: 'source' }], source: 'https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_75-10_up_to_100-20/en/technical-specifications.html', sourceChecked: '2026-10-18' },
  { id: 'victron-smartshunt-500', name: 'SmartShunt 500A', family: 'Victron monitors', kind: 'bus', status: 'partially verified', voltage: 12, current: 500, interfaces: ['VE.Direct'], source: 'https://www.victronenergy.com/battery-monitors/smartshunt' },
  { id: 'generic-cable-16', name: 'Generic Copper Cable 16 mm²', family: 'Cables', kind: 'cable', status: 'reference only', voltage: 12, current: 80 },
  { id: 'generic-cable-35', name: 'Generic Copper Cable 35 mm²', family: 'Cables', kind: 'cable', status: 'reference only', voltage: 12, current: 140 },
  { id: 'generic-fuse-40', name: 'Generic Fuse 40 A', family: 'Protection', kind: 'fuse', status: 'reference only', voltage: 12, current: 40 },
  { id: 'generic-breaker-63', name: 'Generic DC Breaker 63 A', family: 'Protection', kind: 'fuse', status: 'reference only', voltage: 48, current: 63 },
  { id: 'generic-isolator', name: 'Generic DC Isolator', family: 'Switchgear', kind: 'bus', status: 'reference only', voltage: 48, current: 100 },
  { id: 'generic-busbar', name: 'Generic Busbar Distribution', family: 'Distribution', kind: 'bus', status: 'reference only', voltage: 48, current: 250 },
  { id: 'generic-shunt', name: 'Generic 500 A Shunt', family: 'Monitors', kind: 'bus', status: 'reference only', voltage: 48, current: 500 },
  { id: 'generic-bms', name: 'Generic LiFePO₄ BMS', family: 'Battery management', kind: 'battery', status: 'reference only', voltage: 12.8, current: 150, chargeCurrent: 50, dischargeCurrent: 150 },
  { id: 'generic-gx-monitor', name: 'Generic System Monitor', family: 'Monitoring and control', kind: 'bus', status: 'reference only', voltage: 12 },
  { id: 'generic-ac-source', name: 'Generic AC Source', family: 'AC sources', kind: 'ac-source', status: 'reference only', voltage: 230, power: 3000 },
  { id: 'generic-grid-source', name: 'Generic Grid / Shore Source', family: 'AC sources', kind: 'ac-source', status: 'reference only', voltage: 230, power: 3000 },
  { id: 'generic-transfer', name: 'Generic Transfer Switch', family: 'AC sources', kind: 'transfer', status: 'reference only', voltage: 230, current: 16 },
  { id: 'generic-dcdc', name: 'Generic DC-DC Converter', family: 'Converters', kind: 'mppt', status: 'reference only', voltage: 12, power: 240, current: 20 },
  { id: 'generic-charger', name: 'Generic AC Battery Charger', family: 'Chargers', kind: 'mppt', status: 'reference only', voltage: 12, power: 360, current: 30 },
  { id: 'generic-pump', name: 'Generic Pump Load', family: 'Loads', kind: 'load', status: 'reference only', voltage: 230, power: 750 },
  { id: 'generic-heater', name: 'Generic Resistive Heater', family: 'Loads', kind: 'load', status: 'reference only', voltage: 230, power: 1500 },
  { id: 'generic-electronics', name: 'Generic Electronics Load', family: 'Loads', kind: 'load', status: 'reference only', voltage: 230, power: 120 },
  ...namedVictronRecords,
  ...additionalVictronRecords,
].map(record => record.source ? { ...record, sourceChecked: (record as CatalogRecord).sourceChecked ?? '2026-10-17' } as CatalogRecord : record as CatalogRecord)

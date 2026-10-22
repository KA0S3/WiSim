import type { CatalogRecord } from './catalog'
import { validateProjectModel, type SimulationNode } from './simulation'

const KEY = 'wiresim-custom-catalogue'

const KINDS = new Set(['pv', 'mppt', 'battery', 'inverter', 'load', 'fuse', 'cable', 'bus', 'ac-source', 'transfer'])
const isSimulationKind = (kind: string): kind is SimulationNode['kind'] => KINDS.has(kind)
const POSITIVE_FIELDS = [
  'voltage', 'power', 'surge', 'capacityAh', 'energyWh', 'maxChargeCurrentA',
  'maxDischargeCurrentA', 'maxTransferCurrentA', 'maxVoltageDC', 'maxInterruptCurrentA',
  'moduleVoc', 'moduleVmp', 'moduleIsc', 'moduleImp', 'pvVoc', 'current',
  'chargeCurrent', 'dischargeCurrent', 'acVoltage', 'acFrequency', 'maximumEfficiencyPercent',
] as const

export function validateCustomRecord(value: unknown): value is CatalogRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Partial<CatalogRecord>
  if (record.status !== 'custom' || typeof record.id !== 'string' || !record.id.trim() ||
      typeof record.name !== 'string' || !record.name.trim() || typeof record.family !== 'string' ||
      !record.family.trim() || typeof record.kind !== 'string' || !isSimulationKind(record.kind)) return false
  for (const field of POSITIVE_FIELDS) {
    const candidate = record[field]
    if (candidate !== undefined && (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate <= 0)) return false
  }
  for (const table of [record.nominalPvPowerWByBatteryVoltage, record.maxOutputPowerWByBatteryVoltage, record.continuousLoadCurrentAByBatteryVoltage]) {
    if (table !== undefined && (!table || typeof table !== 'object' || Array.isArray(table) ||
      Object.entries(table).some(([voltage, amount]) => !['12', '24', '48'].includes(voltage) || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0))) return false
  }
  if (record.supportedBatteryVoltages !== undefined && (!Array.isArray(record.supportedBatteryVoltages) ||
      record.supportedBatteryVoltages.some(voltage => ![12, 24, 48].includes(voltage)))) return false
  if (record.terminalLayout !== undefined) {
    if (!Array.isArray(record.terminalLayout) || record.terminalLayout.length === 0) return false
    if (record.terminalLayout.some(terminal => terminal.direction !== undefined && !['source', 'sink', 'bidirectional'].includes(terminal.direction))) return false
    const probe = { nodes: [{ id: 'catalogue-validation', name: record.name, kind: record.kind, x: 0, y: 0, terminals: record.terminalLayout }], wires: [], irradiance: 100, temperature: 25 }
    if (validateProjectModel(probe).errors.length) return false
  }
  return true
}

export function loadCustomRecords(): CatalogRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter(validateCustomRecord) : []
  } catch {
    return []
  }
}

export function saveCustomRecord(record: Omit<CatalogRecord, 'status'>): CatalogRecord | null {
  const custom = { ...record, status: 'custom' as const }
  if (!validateCustomRecord(custom)) return null
  try {
    const records = [...loadCustomRecords().filter(item => item.id !== custom.id), custom]
    localStorage.setItem(KEY, JSON.stringify(records))
    return custom
  } catch {
    return null
  }
}

export function saveCustomRecords(records: CatalogRecord[]): boolean {
  try {
    if (!Array.isArray(records) || records.some(record => record?.status === 'custom' && !validateCustomRecord(record))) return false
    localStorage.setItem(KEY, JSON.stringify(records.filter(validateCustomRecord)))
    return true
  } catch {
    return false
  }
}

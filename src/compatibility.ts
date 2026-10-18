import type { CatalogRecord } from './catalog'
import type { SimulationNode, Terminal } from './simulation'

export type InterfaceRequirement = 'none' | 'VE.Direct' | 'VE.Bus' | 'VE.Can' | 'BMS' | 'GX'
export type CompatibilityStatus = 'pass' | 'fail' | 'needs verification'

export function checkNominalVoltage(voltage: number | undefined, nominal: 12 | 24 | 48): CompatibilityStatus {
  if (voltage == null) return 'needs verification'
  const ranges: Record<12 | 24 | 48, [number, number]> = { 12: [10, 16], 24: [20, 32], 48: [40, 64] }
  const [minimum, maximum] = ranges[nominal]
  return voltage >= minimum && voltage <= maximum ? 'pass' : 'fail'
}

/** Exact relationship checks; brand names alone never imply compatibility. */
export function checkInterface(record: CatalogRecord, requirement: InterfaceRequirement): CompatibilityStatus {
  if (requirement === 'none') return 'pass'
  if (!record.interfaces) return 'needs verification'
  return record.interfaces.includes(requirement) ? 'pass' : 'fail'
}

export type RequirementCheck = { label: string; status: CompatibilityStatus; evidence: string }
export type EquivalentMatch = { record: CatalogRecord; checks: RequirementCheck[]; status: CompatibilityStatus; score: number }

function checkMinimum(actual: number | undefined, required: number | undefined, label: string): RequirementCheck | null {
  if (required == null) return null
  if (actual == null) return { label, status: 'needs verification', evidence: `No documented ${label.toLowerCase()} value` }
  return { label, status: actual >= required ? 'pass' : 'fail', evidence: `${actual} meets ${required} minimum` }
}

/** Contextual matching deliberately keeps unknown source fields visible. */
export function compareRecord(record: CatalogRecord, node: SimulationNode): EquivalentMatch {
  const checks: RequirementCheck[] = []
  const nominal: 12 | 24 | 48 = (node.voltage ?? 12.8) <= 16 ? 12 : (node.voltage ?? 12.8) <= 32 ? 24 : 48
  const voltage = checkNominalVoltage(record.voltage, nominal)
  checks.push({ label: 'Nominal voltage', status: voltage, evidence: voltage === 'needs verification' ? 'Nominal voltage is not documented' : voltage === 'pass' ? 'Within the modeled nominal range' : 'Outside the modeled nominal range' })
  for (const check of [checkMinimum(record.power, node.watts, 'Continuous power'), checkMinimum(record.surge, node.surge, 'Surge power'), checkMinimum(record.current, node.chargeLimit, 'Current limit')]) if (check) checks.push(check)
  if (node.kind === 'inverter' && node.acProfile) checks.push({ label: 'AC profile', status: record.acVoltage == null || record.acFrequency == null ? 'needs verification' : 'pass', evidence: record.acVoltage == null || record.acFrequency == null ? 'AC voltage/frequency not documented' : `${record.acVoltage} V / ${record.acFrequency} Hz documented` })
  const status: CompatibilityStatus = checks.some(check => check.status === 'fail') ? 'fail' : checks.some(check => check.status === 'needs verification') ? 'needs verification' : 'pass'
  const score = checks.reduce((total, check) => total + (check.status === 'pass' ? 2 : check.status === 'needs verification' ? 1 : 0), 0)
  return { record, checks, status, score }
}

export function applyRecordToNode(node: SimulationNode, record: CatalogRecord): SimulationNode {
  return { ...node, modelId: record.id, name: record.name, watts: record.power ?? node.watts, surge: record.surge ?? node.surge, voltage: record.voltage ?? node.voltage, chargeLimit: record.chargeCurrent ?? node.chargeLimit, dischargeLimit: record.dischargeCurrent ?? node.dischargeLimit, terminals: record.terminalLayout ?? node.terminals }
}

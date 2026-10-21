import type { CatalogRecord } from './catalog'
import { AC_PROFILES, type ACProfileId, type SimulationNode, type Terminal } from './simulation'

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
export function compareRecord(record: CatalogRecord, node: SimulationNode, selectedAcProfile?: ACProfileId): EquivalentMatch {
  const checks: RequirementCheck[] = []
  if (node.kind !== 'pv' && node.kind !== 'fuse') {
    const nominal: 12 | 24 | 48 = (node.voltage ?? 12.8) <= 16 ? 12 : (node.voltage ?? 12.8) <= 32 ? 24 : 48
    const voltage = record.supportedBatteryVoltages?.length
      ? record.supportedBatteryVoltages.includes(nominal) ? 'pass' : 'fail'
      : checkNominalVoltage(record.voltage, nominal)
    checks.push({ label: 'Nominal voltage', status: voltage, evidence: voltage === 'needs verification' ? 'Nominal voltage is not documented' : voltage === 'pass' ? `Manufacturer lists ${nominal} V battery support` : `Manufacturer does not list ${nominal} V battery support` })
  }
  for (const check of [
    checkMinimum(record.power, node.watts, node.kind === 'pv' ? 'Module power' : 'Continuous power'),
    checkMinimum(record.surge, node.surge, 'Surge power'),
    checkMinimum(record.current, node.chargeLimit, 'Current limit'),
    checkMinimum(record.capacityAh, node.kind === 'battery' ? node.capacity : undefined, 'Battery capacity'),
    checkMinimum(record.maxDischargeCurrentA, node.kind === 'battery' ? node.dischargeLimit : undefined, 'Maximum discharge current'),
  ]) if (check) checks.push(check)
  const acProfileId = selectedAcProfile ?? node.acProfile
  if (node.kind === 'inverter' && acProfileId) {
    const profile = AC_PROFILES[acProfileId]
    if (record.acVoltage == null || record.acFrequency == null) checks.push({ label: 'AC profile', status: 'needs verification', evidence: `${record.acVoltage == null ? 'AC voltage' : 'AC frequency'} not documented; selected profile is ${profile?.label ?? acProfileId}` })
    else if (!profile) checks.push({ label: 'AC profile', status: 'needs verification', evidence: `Selected AC profile ${acProfileId} is unsupported` })
    else {
      const matches = Math.abs(record.acVoltage - profile.voltage) <= 0.01 && record.acFrequency === profile.frequency
      checks.push({ label: 'AC profile', status: matches ? 'pass' : 'fail', evidence: `${record.acVoltage} V / ${record.acFrequency} Hz ${matches ? 'matches' : 'does not match'} selected ${profile.label}` })
    }
  }
  const status: CompatibilityStatus = checks.some(check => check.status === 'fail') ? 'fail' : checks.some(check => check.status === 'needs verification') ? 'needs verification' : 'pass'
  const score = checks.reduce((total, check) => total + (check.status === 'pass' ? 2 : check.status === 'needs verification' ? 1 : 0), 0)
  return { record, checks, status, score }
}

export function applyRecordToNode(node: SimulationNode, record: CatalogRecord): SimulationNode {
  if (record.status !== 'verified') throw new Error(`Cannot apply ${record.name}: its manufacturer data is not fully verified`)
  return { ...node, modelId: record.id, name: record.name, watts: record.kind === 'fuse' ? node.watts : record.power ?? node.watts, powerLimitByVoltage: record.kind === 'mppt' ? record.nominalPvPowerWByBatteryVoltage ?? node.powerLimitByVoltage : node.powerLimitByVoltage, supportedBatteryVoltages: record.kind === 'mppt' ? record.supportedBatteryVoltages ?? node.supportedBatteryVoltages : node.supportedBatteryVoltages, currentLimitA: record.kind === 'fuse' ? record.current ?? node.currentLimitA ?? node.watts : node.currentLimitA, surge: record.surge ?? node.surge, voltage: record.kind === 'pv' ? record.moduleVoc ?? record.voltage ?? node.voltage : record.voltage ?? node.voltage, acVoltage: record.kind === 'inverter' ? record.acVoltage ?? node.acVoltage : node.acVoltage, acFrequency: record.kind === 'inverter' ? record.acFrequency ?? node.acFrequency : node.acFrequency, capacity: record.capacityAh ?? node.capacity, chemistry: record.chemistry ?? node.chemistry, chargeLimit: record.chargeCurrent ?? node.chargeLimit, dischargeLimit: record.maxDischargeCurrentA ?? record.dischargeCurrent ?? node.dischargeLimit, terminals: record.terminalLayout ?? node.terminals }
}

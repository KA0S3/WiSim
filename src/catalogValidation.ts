import type { CatalogRecord, InstallationRuleSet } from './catalog'

export type CatalogReport = {
  total: number
  verified: number
  componentTypes: number
  duplicateIds: string[]
  structuralErrors: string[]
}

const validUrl = (value: string | undefined): boolean => {
  if (!value) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export function validateCatalogue(records: CatalogRecord[], ruleSets: InstallationRuleSet[]): CatalogReport {
  const ids = records.map(record => record.id)
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
  const ruleSetIds = new Set(ruleSets.map(ruleSet => ruleSet.id))
  const structuralErrors = [
    ...duplicateIds.map(id => `duplicate id: ${id}`),
    ...ruleSets.filter(ruleSet => !ruleSet.id || !validUrl(ruleSet.source) || !ruleSet.rules.length).map(ruleSet => `invalid installation rule set: ${ruleSet.id || '(missing id)'}`),
    ...ruleSets.flatMap(ruleSet => ruleSet.rules.filter(rule => !rule.id || !rule.text || !validUrl(rule.source)).map(rule => `invalid installation rule: ${ruleSet.id}/${rule.id || '(missing id)'}`)),
  ]

  for (const record of records) {
    const prefix = `record ${record.id}`
    const statusValues = ['verified', 'partially verified', 'reference only']
    if (!record.id || !record.name || !record.brand || !record.family || !record.productModel || !record.componentType || !statusValues.includes(record.status)) structuralErrors.push(`${prefix} is missing a valid exact-model identity or evidence status`)
    if (!validUrl(record.source)) structuralErrors.push(`${prefix} is missing an HTTPS manufacturer source`)
    if (record.status === 'custom') structuralErrors.push(`${prefix} must be stored outside the manufacturer catalogue`)
    if (record.status === 'verified' && !['pv', 'battery', 'mppt', 'inverter', 'load', 'cable', 'fuse', 'bus', 'ac-source', 'transfer'].includes(record.kind)) structuralErrors.push(`${prefix} cannot be simulation-verified with non-simulation component kind ${record.kind}`)
    if (record.additionalSpecs?.some(spec => !spec.label || (typeof spec.value === 'number' ? !Number.isFinite(spec.value) : !spec.value) || !validUrl(spec.source))) structuralErrors.push(`${prefix} has an invalid additional specification`)
    if (record.price && (!Number.isFinite(record.price.amount) || record.price.amount <= 0 || !['sale', 'regular', 'MSRP', 'displayed'].includes(record.price.priceType) || (record.price.regularAmount != null && (!Number.isFinite(record.price.regularAmount) || record.price.regularAmount <= 0)) || !record.price.currency || !record.price.region || !validUrl(record.price.source) || !/^\d{4}-\d{2}-\d{2}$/.test(record.price.sourceChecked))) structuralErrors.push(`${prefix} has invalid or unsourced price data`)
    if (record.status !== 'verified') {
      if (!record.missingData?.length) structuralErrors.push(`${prefix} must list the data still needing verification`)
      continue
    }
    const terminals = record.terminalLayout ?? []
    const terminalIds = terminals.map(terminal => terminal.id)
    const duplicateTerminals = terminalIds.filter((id, index) => terminalIds.indexOf(id) !== index)
    const positionKeys = terminals.map(terminal => `${terminal.side}:${terminal.order}`)
    const duplicatePositions = positionKeys.filter((position, index) => positionKeys.indexOf(position) !== index)

    if (!/^#[\da-f]{6}$/i.test(record.brandColors?.primary ?? '') || !/^#[\da-f]{6}$/i.test(record.brandColors?.secondary ?? '')) structuralErrors.push(`${prefix} has invalid brand colors`)
    if (!validUrl(record.brandColorsSource) || !validUrl(record.source) || !validUrl(record.terminalLayoutSource)) structuralErrors.push(`${prefix} is missing an HTTPS source for specifications, appearance, or terminals`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.sourceChecked ?? '')) structuralErrors.push(`${prefix} has no review date`)
    const supportedVoltages = record.supportedBatteryVoltages ?? []
    if (supportedVoltages.some(voltage => !Number.isFinite(voltage) || voltage <= 0)) structuralErrors.push(`${prefix} has invalid supported battery voltages`)
    if (!terminals.length || duplicateTerminals.length) structuralErrors.push(`${prefix} has missing or duplicate terminals`)
    if (duplicatePositions.length || terminals.some(terminal => !terminal.side || !Number.isInteger(terminal.order) || (terminal.order ?? 0) < 1)) structuralErrors.push(`${prefix} has missing or duplicate terminal positions`)
    if (!record.installationRuleSetId || !ruleSetIds.has(record.installationRuleSetId)) structuralErrors.push(`${prefix} references a missing installation rule set`)
    if (record.nominalPvPowerWByBatteryVoltage && Object.entries(record.nominalPvPowerWByBatteryVoltage).some(([voltage, power]) => !supportedVoltages.includes(Number(voltage)) || !Number.isFinite(power) || power <= 0)) structuralErrors.push(`${prefix} has invalid PV power-by-voltage data`)
    if (record.maxOutputPowerWByBatteryVoltage && Object.entries(record.maxOutputPowerWByBatteryVoltage).some(([voltage, power]) => !supportedVoltages.includes(Number(voltage)) || !Number.isFinite(power) || power <= 0)) structuralErrors.push(`${prefix} has invalid output-power-by-voltage data`)
    if (record.continuousLoadCurrentAByBatteryVoltage && Object.entries(record.continuousLoadCurrentAByBatteryVoltage).some(([voltage, current]) => !supportedVoltages.includes(Number(voltage)) || !Number.isFinite(current) || current <= 0)) structuralErrors.push(`${prefix} has invalid load-output current-by-voltage data`)
    if (record.kind === 'mppt' && (record.pvVoc == null || record.current == null || record.chargeCurrent == null || !record.nominalPvPowerWByBatteryVoltage)) structuralErrors.push(`${prefix} is missing verified solar-controller limits`)
    if (record.kind === 'pv' && (record.power == null || record.moduleVoc == null || record.moduleVmp == null || record.moduleIsc == null || record.moduleImp == null || !record.connectorType)) structuralErrors.push(`${prefix} is missing verified PV-module ratings or connector type`)
    if (record.kind === 'battery' && (record.voltage == null || record.capacityAh == null)) structuralErrors.push(`${prefix} is missing nominal battery voltage or capacity`)
    if (record.kind === 'inverter' && (record.voltage == null || record.power == null || record.acVoltage == null || record.acFrequency == null)) structuralErrors.push(`${prefix} is missing inverter DC/AC ratings`)
    if (record.kind === 'fuse' && record.current == null) structuralErrors.push(`${prefix} is missing its rated current`)
  }

  return {
    total: records.length,
    verified: records.filter(record => record.status === 'verified').length,
    componentTypes: new Set(records.map(record => record.componentType)).size,
    duplicateIds,
    structuralErrors,
  }
}

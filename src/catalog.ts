import database from './catalog-data.json' with { type: 'json' }
import type { SimulationNode, Terminal } from './simulation'

export type CatalogSource = {
  kind: 'technical-specification' | 'installation-manual' | 'terminal-diagram' | 'appearance-reference'
  url: string
}

export type InstallationRule = {
  id: string
  text: string
  source: string
}

export type InstallationRuleSet = {
  id: string
  source: string
  rules: InstallationRule[]
}

export type CatalogRecord = {
  id: string
  name: string
  brand?: string
  brandColors?: { primary: string; secondary: string }
  brandColorsSource?: string
  productColorName?: string
  family: string
  productFamily?: string
  componentType?: string
  kind: SimulationNode['kind']
  status: 'verified' | 'partially verified' | 'reference only' | 'custom'
  productModel?: string
  voltage?: number
  power?: number
  surge?: number
  capacityAh?: number
  energyWh?: number
  chemistry?: 'LiFePO4' | 'lead-acid'
  maxChargeCurrentA?: number
  maxDischargeCurrentA?: number
  maxTransferCurrentA?: number
  maxVoltageDC?: number
  maxInterruptCurrentA?: number
  moduleVoc?: number
  moduleVmp?: number
  moduleIsc?: number
  moduleImp?: number
  connectorType?: string
  waveform?: string
  pvVoc?: number
  current?: number
  chargeCurrent?: number
  dischargeCurrent?: number
  acVoltage?: number
  acFrequency?: number
  supportedBatteryVoltages?: number[]
  nominalPvPowerWByBatteryVoltage?: Record<string, number>
  maxOutputPowerWByBatteryVoltage?: Record<string, number>
  maxPvShortCircuitCurrentA?: number
  continuousLoadCurrentAByBatteryVoltage?: Record<string, number>
  maximumEfficiencyPercent?: number
  installationRuleSetId?: string
  terminalLayoutSource?: string
  source?: string
  sourceChecked?: string
  missingData?: string[]
  interfaces?: Array<'VE.Direct' | 'VE.Bus' | 'VE.Can' | 'BMS' | 'GX'>
  terminalLayout?: Terminal[]
}

export type VerifiedCatalogRecord = CatalogRecord & {
  brand: string
  brandColors: { primary: string; secondary: string }
  brandColorsSource: string
  componentType: string
  status: 'verified'
  installationRuleSetId: string
  terminalLayoutSource: string
  source: string
  sourceChecked: string
  terminalLayout: Terminal[]
}

export type CatalogDatabase = {
  schemaVersion: number
  lastReviewed: string
  policy: string
  installationRuleSets: InstallationRuleSet[]
  records: CatalogRecord[]
}

export const CATALOG_DATABASE = database as CatalogDatabase
export const CATALOG_RECORDS = CATALOG_DATABASE.records
export const VERIFIED_CATALOG_RECORDS = CATALOG_RECORDS.filter((record): record is VerifiedCatalogRecord => record.status === 'verified')
export const INSTALLATION_RULE_SETS = CATALOG_DATABASE.installationRuleSets

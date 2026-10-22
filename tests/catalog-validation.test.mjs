import test from 'node:test'
import assert from 'node:assert/strict'
import { CATALOG_RECORDS, INSTALLATION_RULE_SETS } from '../src/catalog.ts'
import { validateCatalogue } from '../src/catalogValidation.ts'

test('catalogue validator accepts sourced in-progress candidates and validates verified product details', () => {
  const report = validateCatalogue(CATALOG_RECORDS, INSTALLATION_RULE_SETS)
  assert.ok(report.total >= 50, `expected broad exact-model coverage, got ${report.total}`)
  assert.ok(report.verified < report.total)
  assert.ok(report.componentTypes >= 5, `expected at least five component types, got ${report.componentTypes}`)
  assert.deepEqual(report.duplicateIds, [])
  assert.deepEqual(report.structuralErrors, [])
})

test('catalogue validator requires a research checklist for partial records', () => {
  const report = validateCatalogue(
    [{ ...CATALOG_RECORDS[0], id: 'incomplete', status: 'partially verified', brandColors: { primary: 'blue', secondary: '#fff' }, terminalLayout: [] }],
    INSTALLATION_RULE_SETS,
  )
  assert.ok(report.structuralErrors.some(error => error.includes('list the data still needing verification')))
})

test('catalogue validator still enforces full evidence for records marked verified', () => {
  const report = validateCatalogue(
    [{ ...CATALOG_RECORDS[0], id: 'incomplete-verified', brandColors: { primary: 'blue', secondary: '#fff' }, terminalLayout: [] }],
    INSTALLATION_RULE_SETS,
  )
  assert.ok(report.structuralErrors.some(error => error.includes('invalid brand colors')))
  assert.ok(report.structuralErrors.some(error => error.includes('missing or duplicate terminals')))
})

test('catalogue stores source-backed extended specifications and dated regional prices', () => {
  const battery = CATALOG_RECORDS.find(record => record.id === 'victron-lithium-smart-12-8-330')
  const pricedBattery = CATALOG_RECORDS.find(record => record.id === 'battle-born-bb10012')
  const phoenix = CATALOG_RECORDS.find(record => record.id === 'victron-phoenix-48-1600')

  assert.equal(battery?.energyWh, 4220)
  assert.ok(battery?.additionalSpecs?.some(spec => spec.label === 'Cycle life at 80/70/50% depth of discharge'))
  assert.equal(pricedBattery?.price?.currency, 'USD')
  assert.equal(pricedBattery?.price?.amount, 799)
  assert.equal(pricedBattery?.price?.priceType, 'sale')
  assert.equal(phoenix?.power, 1300)
  assert.equal(phoenix?.surge, 3000)
  assert.equal(phoenix?.voltage, 48)
})

test('catalogue validator rejects unsupported sources for extended specs and prices', () => {
  const sourceRecord = CATALOG_RECORDS.find(record => record.id === 'battle-born-bb10012')
  assert.ok(sourceRecord)
  const report = validateCatalogue(
    [{
      ...sourceRecord,
      id: 'bad-sources',
      additionalSpecs: [{ label: 'Cycle life', value: 3000, unit: 'cycles', source: 'http://example.com/specs' }],
      price: {
        amount: sourceRecord.price?.amount ?? 1,
        priceType: sourceRecord.price?.priceType ?? 'sale',
        currency: sourceRecord.price?.currency ?? 'USD',
        region: sourceRecord.price?.region ?? 'US',
        source: 'http://example.com/price',
        sourceChecked: sourceRecord.price?.sourceChecked ?? '2026-10-22',
      },
    }],
    INSTALLATION_RULE_SETS,
  )

  assert.ok(report.structuralErrors.some(error => error.includes('invalid additional specification')))
  assert.ok(report.structuralErrors.some(error => error.includes('invalid or unsourced price data')))
})

test('non-simulation component types cannot be marked as verified simulation models', () => {
  const report = validateCatalogue(
    [{
      ...CATALOG_RECORDS[0],
      id: 'verified-non-simulation-accessory',
      kind: 'communication-interface',
    }],
    INSTALLATION_RULE_SETS,
  )
  assert.ok(report.structuralErrors.some(error => error.includes('non-simulation component kind')))
})

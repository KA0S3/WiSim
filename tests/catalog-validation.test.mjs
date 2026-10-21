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

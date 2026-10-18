import test from 'node:test'
import assert from 'node:assert/strict'
import { CATALOG_RECORDS } from '../src/catalog.ts'
import { validateCatalogue } from '../src/catalogValidation.ts'

test('catalogue validator reports coverage and catches structural problems', () => {
  const report = validateCatalogue(CATALOG_RECORDS)
  assert.ok(report.victron >= 60)
  assert.ok(report.generic >= 20)
  assert.ok(report.families >= 10)
  assert.equal(report.duplicateIds.length, 0)
  assert.equal(report.sourceMissing.length, 0)
  assert.ok(CATALOG_RECORDS.filter(record => record.source).every(record => record.sourceChecked))
  assert.ok(report.review.length > 0)
})

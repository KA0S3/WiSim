import { CATALOG_RECORDS } from '../src/catalog.ts'
import { validateCatalogue } from '../src/catalogValidation.ts'

const report = validateCatalogue(CATALOG_RECORDS)
console.log(`Catalogue: ${report.total} records · ${report.victron} Victron · ${report.generic} generic · ${report.families} families`)
console.log(`Source-linked Victron: ${report.victron - report.sourceMissing.length}/${report.victron}`)
console.log(`Records needing review: ${report.review.length}`)
if (report.structuralErrors.length) {
  console.error('Structural errors:')
  for (const error of report.structuralErrors) console.error(`- ${error}`)
  process.exitCode = 1
}
if (report.victron < 60 || report.generic < 20 || report.families < 10) {
  console.log('Coverage target: still incomplete; see goal.md for the honest release gate.')
}

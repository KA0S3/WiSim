import { CATALOG_RECORDS, INSTALLATION_RULE_SETS } from '../src/catalog.ts'
import { validateCatalogue } from '../src/catalogValidation.ts'

const report = validateCatalogue(CATALOG_RECORDS, INSTALLATION_RULE_SETS)
console.log(`Product catalogue: ${report.verified} verified / ${report.total} total models · ${report.componentTypes} component types · ${INSTALLATION_RULE_SETS.length} sourced installation rule sets`)
if (report.structuralErrors.length) {
  console.error('Structural errors:')
  for (const error of report.structuralErrors) console.error(`- ${error}`)
  process.exitCode = 1
}

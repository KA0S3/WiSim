import type { CatalogRecord } from './catalog'

export type CatalogReport = {
  total: number
  generic: number
  victron: number
  families: number
  sourceMissing: string[]
  duplicateIds: string[]
  review: string[]
  structuralErrors: string[]
}

export function validateCatalogue(records: CatalogRecord[]): CatalogReport {
  const ids = records.map(record => record.id)
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
  const victron = records.filter(record => record.id.startsWith('victron-'))
  const generic = records.filter(record => record.status === 'reference only')
  const sourceMissing = victron.filter(record => !record.source).map(record => record.id)
  const review = records.filter(record => record.status !== 'verified' || !record.source).map(record => record.id)
  const structuralErrors = [
    ...duplicateIds.map(id => `duplicate id: ${id}`),
    ...sourceMissing.map(id => `Victron record has no source: ${id}`),
    ...records.filter(record => !record.name || !record.family).map(record => `record missing name/family: ${record.id}`),
  ]
  return { total: records.length, generic: generic.length, victron: victron.length, families: new Set(records.map(record => record.productFamily).filter(Boolean)).size, sourceMissing, duplicateIds, review, structuralErrors }
}

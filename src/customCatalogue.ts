import type { CatalogRecord } from './catalog'

const KEY = 'wiresim-custom-catalogue'

export function loadCustomRecords(): CatalogRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter(record => record && record.status === 'custom' && typeof record.id === 'string') : []
  } catch {
    return []
  }
}

export function saveCustomRecord(record: Omit<CatalogRecord, 'status'>): CatalogRecord | null {
  const custom = { ...record, status: 'custom' as const }
  try {
    const records = [...loadCustomRecords().filter(item => item.id !== custom.id), custom]
    localStorage.setItem(KEY, JSON.stringify(records))
    return custom
  } catch {
    return null
  }
}

export function saveCustomRecords(records: CatalogRecord[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.filter(record => record.status === 'custom')))
    return true
  } catch {
    return false
  }
}

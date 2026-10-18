import type { SimulationProject } from './simulation'

export const PROJECT_SCHEMA_VERSION = 2
const DATABASE = 'solar-wiresim'
const STORE = 'projects'
const CURRENT = 'current'
const LOCAL_KEY = 'wiresim-project'

export function isProject(value: unknown): value is SimulationProject {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SimulationProject>
  return Array.isArray(candidate.nodes) && Array.isArray(candidate.wires) && typeof candidate.irradiance === 'number' && typeof candidate.temperature === 'number'
}

export function parseProject(value: unknown): SimulationProject | null {
  if (isProject(value)) return value
  if (value && typeof value === 'object' && 'project' in value) {
    const envelope = value as { schemaVersion?: unknown; project?: unknown }
    if (typeof envelope.schemaVersion === 'number' && envelope.schemaVersion <= PROJECT_SCHEMA_VERSION && isProject(envelope.project)) return migrateProject(envelope.project, envelope.schemaVersion)
  }
  return null
}

function migrateProject(project: SimulationProject, version: number): SimulationProject {
  if (version >= 2) return project
  // v1 wires had only component endpoints. Preserve them as visibly unresolved
  // legacy links instead of guessing a terminal pair during import.
  return { ...project, wires: project.wires.map(wire => ({ ...wire, domain: wire.domain ?? 'dc' })) }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise(resolve => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

export async function loadProject(): Promise<SimulationProject | null> {
  const database = await openDatabase()
  if (database) {
    const value = await new Promise<unknown>(resolve => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(CURRENT)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    })
    database.close()
    const parsed = parseProject(value)
    if (parsed) return parsed
  }
  try { return parseProject(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null')) } catch { return null }
}

export async function saveProject(project: SimulationProject): Promise<boolean> {
  let localSaved = true
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(project)) } catch { localSaved = false }
  const database = await openDatabase()
  if (!database) return localSaved
  const databaseSaved = await new Promise<boolean>(resolve => {
    try {
      const transaction = database.transaction(STORE, 'readwrite')
      transaction.onabort = () => resolve(false)
      const request = transaction.objectStore(STORE).put({ schemaVersion: PROJECT_SCHEMA_VERSION, project }, CURRENT)
      request.onsuccess = () => resolve(true)
      request.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
  database.close()
  return localSaved && databaseSaved
}

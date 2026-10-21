import type { SimulationProject } from './simulation'

export const PROJECT_SCHEMA_VERSION = 3
const DATABASE = 'solar-wiresim'
const STORE = 'projects'
const CURRENT = 'current'
const LOCAL_KEY = 'wiresim-project'

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isEndpoint = (value: unknown) => isRecord(value) && typeof value.nodeId === 'string' && typeof value.terminalId === 'string'

export function isProject(value: unknown): value is SimulationProject {
  if (!isRecord(value)) return false
  const candidate = value as Partial<SimulationProject>
  const validNode = (node: unknown) => isRecord(node) &&
    (node.terminals == null || Array.isArray(node.terminals) && node.terminals.every(isRecord)) &&
    (node.powerLimitByVoltage == null || isRecord(node.powerLimitByVoltage)) &&
    (node.supportedBatteryVoltages == null || Array.isArray(node.supportedBatteryVoltages))
  const validWire = (wire: unknown) => isRecord(wire) &&
    (wire.points == null || Array.isArray(wire.points) && wire.points.every(isRecord))
  const validProbe = (probe: unknown) => isRecord(probe) && typeof probe.id === 'string' && isEndpoint(probe.positive) &&
    (probe.negative == null || isEndpoint(probe.negative)) && ['voltage', 'current', 'resistance', 'continuity'].includes(String(probe.mode))
  const validEvent = (event: unknown) => isRecord(event)
  return Array.isArray(candidate.nodes) && candidate.nodes.every(validNode) &&
    Array.isArray(candidate.wires) && candidate.wires.every(validWire) &&
    (candidate.probes == null || Array.isArray(candidate.probes) && candidate.probes.every(validProbe)) &&
    (candidate.events == null || Array.isArray(candidate.events) && candidate.events.every(validEvent)) &&
    typeof candidate.irradiance === 'number' && typeof candidate.temperature === 'number'
}

export function parseProject(value: unknown): SimulationProject | null {
  if (isProject(value)) return migrateProject(value, 2)
  if (value && typeof value === 'object' && 'project' in value) {
    const envelope = value as { schemaVersion?: unknown; project?: unknown }
    if (typeof envelope.schemaVersion === 'number' && envelope.schemaVersion >= 1 && envelope.schemaVersion <= PROJECT_SCHEMA_VERSION && isProject(envelope.project)) return migrateProject(envelope.project, envelope.schemaVersion)
  }
  return null
}

function migrateProject(project: SimulationProject, version: number): SimulationProject {
  let migrated = project
  // v1 wires had only component endpoints. Preserve them as visibly unresolved
  // legacy links instead of guessing a terminal pair during import.
  if (version < 2) migrated = { ...migrated, wires: migrated.wires.map(wire => ({ ...wire, domain: wire.domain ?? 'dc' })) }
  // Fuse ratings were stored in `watts` even though the bounded solver has
  // always treated that number as amperes. Add an explicit field and keep the
  // legacy property untouched so older exports remain lossless.
  if (version < 3) migrated = { ...migrated, nodes: migrated.nodes.map(node => node.kind === 'fuse' && node.currentLimitA == null && node.watts != null ? { ...node, currentLimitA: node.watts } : node) }
  // Invalid model data remains loadable so live diagnostics can explain it.
  return migrated
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

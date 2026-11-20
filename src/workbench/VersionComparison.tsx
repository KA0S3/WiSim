import { equipmentSpecification } from './export-data'
import { useState } from 'react'
import { connectionFindings } from './connection-checks'
import { engineeringFindings, engineeringSummary } from './engineering'
import { synchronizeLengths } from './geometry'
import { definitions, type Project } from './model'
import { loadProjectVersion, type ProjectVersion } from './project-library'

type Version = Omit<ProjectVersion, 'project'>

function describe(input: Project) {
  const project = synchronizeLengths(input)
  const equipment = new Map<string, number>()
  for (const device of project.devices) {
    const name = device.model ?? definitions[device.kind].label
    equipment.set(name, (equipment.get(name) ?? 0) + 1)
  }
  const references = new Map(project.devices.map(device => [device.id, device.reference ?? device.name]))
  return {
    Equipment: Array.from(equipment, ([name, count]) => count + ' × ' + name).sort(),
    Ratings: project.devices.map(device => [device.reference, device.name, equipmentSpecification(device)].join(' · ')).sort(),
    Connections: project.wires.map(w => w.reference + ' · ' + references.get(w.from) + '.' + w.fromPort + ' → ' + references.get(w.to) + '.' + w.toPort + ' · ' + w.length.toFixed(2) + ' m').sort(),
    'Total cable length': [project.wires.reduce((total, wire) => total + wire.length, 0).toFixed(2) + ' m'],
    Assumptions: [engineeringSummary(project), 'Sunlight ' + project.sun + '%', 'Ambient ' + project.ambient + ' °C', 'Initial charge ' + project.initialSoc + '%', ...(project.designNotes ?? [])],
    'Static findings': [...connectionFindings(project), ...engineeringFindings(project)].map(f => f.severity + ' · ' + (references.get(f.target ?? '') ?? project.wires.find(w => w.id === f.target)?.reference ?? 'System') + ' · ' + f.title + ' · ' + f.detail).sort()
  }
}

export function VersionComparison({versions}: {versions: Version[]}) {
  const [first, setFirst] = useState(versions[1]?.id ?? '')
  const [second, setSecond] = useState(versions[0]?.id ?? '')
  const [result, setResult] = useState<ReturnType<typeof describe>[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function compare() {
    setBusy(true)
    setError('')
    try { setResult((await Promise.all([loadProjectVersion(first), loadProjectVersion(second)])).map(describe)) }
    catch (cause) { setResult(null); setError(cause instanceof Error ? cause.message : 'Could not load versions.') }
    finally { setBusy(false) }
  }
  return <details><summary>Compare saved versions</summary>
    {['Earlier version', 'Later version'].map((label, i) => <label key={label} className="field">{label}
      <select disabled={busy} value={i ? second : first} onChange={e => { (i ? setSecond : setFirst)(e.target.value); setResult(null) }}>
        {versions.map(v => <option key={v.id} value={v.id}>{v.label} / {new Date(v.savedAt).toLocaleString()}</option>)}
      </select></label>)}
    <button disabled={busy || first === second} onClick={() => void compare()}>Compare</button>
    {error && <p role="alert">{error}</p>}
    {result && Object.entries(result[0]).map(([title, before]) => {
      const after = result[1][title as keyof ReturnType<typeof describe>]
      const changes = [...before.filter(item => !after.includes(item)).map(item => 'Removed · ' + item), ...after.filter(item => !before.includes(item)).map(item => 'Added · ' + item)]
      return <section key={title}><h4>{title}</h4>{changes.length ? <ul>{changes.map((line,i) => <li key={i}>{line}</li>)}</ul> : <p>Unchanged</p>}</section>
    })}
  </details>
}

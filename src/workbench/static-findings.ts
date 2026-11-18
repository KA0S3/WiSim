import { connectionFindings } from './connection-checks'
import type { Finding, Project } from './model'
import {withSchedules} from './appliances'
import {engineeringFindings} from './engineering'

/** Available before a solve, including when a mistaken circuit cannot converge. */
export function staticFindings(project: Project): Finding[] {
  project=withSchedules(project)
  const findings: Finding[] = [...connectionFindings(project),...engineeringFindings(project)]
  for (const wire of project.wires) if (wire.autoRoute?.error) findings.push({ id: `route-support-${wire.id}`, target: wire.id, severity: 'warning', title: 'Automatic cable route lost its support', detail: `${wire.autoRoute.error} The last validated cable length is retained for electrical calculations. Reposition supports/equipment and preview a valid route, or choose a manual route.` })
  const connected = new Set(project.wires.flatMap(wire => [`${wire.from}:${wire.fromPort}`, `${wire.to}:${wire.toPort}`]))
  for (const device of project.devices) {
    const missing = device.ports.filter(port => !connected.has(`${device.id}:${port.id}`))
    if (missing.length && !['bus', 'ground'].includes(device.kind)) findings.push({ id: `open-${device.id}`, severity: device.on && missing.length < device.ports.length ? 'warning' : 'info', title: 'Unconnected terminal', detail: `${device.name}: ${missing.map(port => port.label).join(', ')} ${missing.length === 1 ? 'is' : 'are'} unconnected. A complete outgoing and return path is needed for current.`, target: device.id })
  }
  return findings
}

import { acSourceKinds, type Project } from './model'
import type { ConnectionFinding } from './connection-checks'

/** Detect conductor/passive bypasses even when a short prevents a numerical solve. */
export function faultFindings(project: Project): ConnectionFinding[] {
  const parent = new Map<string, string>()
  const key = (id: string, port: string) => JSON.stringify([id, port])
  const root = (value: string): string => {
    const previous = parent.get(value)
    if (!previous) { parent.set(value, value); return value }
    if (previous === value) return value
    const result = root(previous); parent.set(value, result); return result
  }
  const join = (a: string, b: string) => { const left = root(a), right = root(b); if (left !== right) parent.set(left, right) }
  for (const wire of project.wires) join(key(wire.from, wire.fromPort), key(wire.to, wire.toPort))
  for (const device of project.devices) {
    if (device.on && ['bus', 'switch', 'fuse'].includes(device.kind)) for (const port of device.ports.filter(p=>p.domain!=='earth').slice(1)) join(key(device.id, device.ports[0].id), key(device.id, port.id))
  }
  const findings: ConnectionFinding[] = []
  const sources = project.devices.filter(device => device.on && acSourceKinds.has(device.kind))
  for (let i = 0; i < sources.length; i++) for (const other of sources.slice(i + 1)) {
    const device = sources[i]
    const livePorts = (kind: string) => kind === 'three-phase' ? ['a', 'b', 'c'] : kind === 'inverter' ? ['l'] : ['p']
    const sharedLive = livePorts(device.kind).some(a => livePorts(other.kind).some(b => root(key(device.id, a)) === root(key(other.id, b))))
    if (!sharedLive || root(key(device.id, 'n')) !== root(key(other.id, 'n'))) continue
    const conflict = device.spec.frequency !== other.spec.frequency || Math.abs(device.spec.voltage - other.spec.voltage) > 1
    findings.push({ id: `ac-source-conflict-${device.id}-${other.id}`, target: other.id, related: [device.id, other.id], severity: conflict ? 'fault' : 'warning', title: conflict ? 'Parallel AC sources have incompatible ratings' : 'Parallel AC sources need synchronisation review', detail: `${device.name} (${device.spec.voltage} V, ${device.spec.frequency} Hz) and ${other.name} (${other.spec.voltage} V, ${other.spec.frequency} Hz) share live and neutral paths. Verify transfer isolation, phase alignment and manufacturer parallel-operation support.` })
  }
  for (const device of project.devices) {
    if (!device.on) continue
    const pairs = device.kind === 'inverter' ? [['l', 'n']] : device.kind === 'mppt' ? [['pv+', 'pv-'], ['bat+', 'bat-']] : device.kind === 'charger' ? [['l', 'n'], ['bat+', 'bat-']] : device.kind === 'three-phase' ? [['a', 'n'], ['b', 'n'], ['c', 'n'], ['a', 'b'], ['b', 'c'], ['a', 'c']] : ['battery', 'pv', 'grid', 'generator', 'load', 'dc-load', 'motor', 'capacitor'].includes(device.kind) ? [['p', 'n']] : []
    for (const [a, b] of pairs) {
      if (root(key(device.id, a)) !== root(key(device.id, b))) continue
      const source = acSourceKinds.has(device.kind) || ['battery', 'pv', 'mppt', 'charger'].includes(device.kind)
      findings.push({ id: `short-${device.id}-${a}-${b}`, target: device.id, related: [device.id], severity: source ? 'fault' : 'warning', title: source ? 'Source terminals are shorted' : 'Equipment is bypassed by a conductor path', detail: `${device.name} terminals ${a} and ${b} are joined through conductors and closed distribution components. ${source ? 'Isolate the source and inspect the outgoing and return paths.' : 'This path bypasses the equipment. Check the intended wiring.'}` })
    }
    if (device.kind === 'fuse') {
      // Omit this fuse when looking for a path around its protected terminals.
      const adjacency = new Map<string, string[]>()
      const link = (a: string, b: string) => { adjacency.set(a, [...(adjacency.get(a) ?? []), b]); adjacency.set(b, [...(adjacency.get(b) ?? []), a]) }
      for (const wire of project.wires) link(key(wire.from, wire.fromPort), key(wire.to, wire.toPort))
      for (const other of project.devices) if (other.id !== device.id && other.on && ['bus', 'switch', 'fuse'].includes(other.kind)) for (const port of other.ports.filter(p=>p.domain!=='earth').slice(1)) link(key(other.id, other.ports[0].id), key(other.id, port.id))
      const queue = [key(device.id, 'p')], seen = new Set(queue)
      for (let i = 0; i < queue.length; i++) for (const next of adjacency.get(queue[i]) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next) }
      if (seen.has(key(device.id, 'n'))) findings.push({ id: `protection-bypass-${device.id}`, target: device.id, related: [device.id], severity: 'fault', title: 'Protection has a bypass path', detail: `${device.name} has a parallel conductor/distribution path around its terminals. Opening this protection cannot isolate that path. Review parallel feeds and the conductor arrangement.` })
    }
    if (device.kind === 'pv' && (device.spec.voltage >= device.spec.voc || device.spec.watts > device.spec.voltage * device.spec.isc)) findings.push({ id: `pv-ratings-${device.id}`, target: device.id, related: [device.id], severity: 'warning', title: 'PV ratings are inconsistent', detail: 'Operating voltage must be below open-circuit voltage, and nameplate power must fit below Vmp × Isc. Check the module/string ratings.' })
  }
  return findings
}

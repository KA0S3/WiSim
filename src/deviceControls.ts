import type { SimulationNode, SimulationProject } from './simulation'

/** Toggle the sandbox state of a modeled transfer switch or fuse. */
export function toggleDevicePath(project: SimulationProject, nodeId: string): SimulationProject {
  let changed = false
  const nodes = project.nodes.map((node): SimulationNode => {
    if (node.id !== nodeId) return node
    if (node.kind === 'transfer') {
      changed = true
      return { ...node, switchState: node.switchState === 'open' ? 'closed' : 'open' }
    }
    if (node.kind === 'fuse') {
      if (node.tripped && node.resettable === false) return node
      changed = true
      return { ...node, tripped: !node.tripped }
    }
    return node
  })
  return changed ? { ...project, nodes } : project
}

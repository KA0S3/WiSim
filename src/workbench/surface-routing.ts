import { Vector3 } from 'three/src/math/Vector3.js'
import {Matrix3} from 'three/src/math/Matrix3.js'
import {Matrix4} from 'three/src/math/Matrix4.js'
import {OBB} from 'three/examples/jsm/math/OBB.js'
import { terminalPosition, routeLength } from './geometry'
import { orientation, resolveMounts, shellThickness } from './spatial'
import type { Device, Project, Structure, Triple, Wire } from './model'
import {surfaceContains,segmentFits,surfacePolygons} from './surface-domain'

const clearance = .015, approachLimit = .4, epsilon = 1e-7
type Surface = { id: string; structure: Structure; face: string; origin: Vector3; u: Vector3; v: Vector3; normal: Vector3; width: number; height: number; margin: number; body:OBB }
type Node = { point: Vector3; surface: number }
type Link = { to: number; distance: number; points: Triple[] }
export type SupportedRoute = { points: Triple[]; supportIds: string[]; length: number }
const routeCache = new Map<string, Map<string, SupportedRoute>>()
const structureKey = (project:Project) => JSON.stringify(project.structures?.map(s=>[s.id,s.kind,s.position,s.rotation,s.size,s.polygons]))

function surfaces(project: Project): Surface[] {
  return (project.structures ?? []).filter(s=>!(s.building&&s.kind==='floor')).flatMap(structure => {
    const rotation = orientation(structure.rotation)
    const body=new OBB(new Vector3(...structure.position),new Vector3(...structure.size).multiplyScalar(.5).addScalar(.001),new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromQuaternion(rotation)))
    const u = new Vector3(1, 0, 0).applyQuaternion(rotation), v = new Vector3(0, 1, 0).applyQuaternion(rotation), normal = new Vector3(0, 0, 1).applyQuaternion(rotation)
    const faces = structure.kind === 'box' ? ['front', 'inside'] : structure.kind === 'wall' ? ['front', 'back'] : ['front']
    return faces.map(face => {
      const offset = face === 'inside' ? -structure.size[2] / 2 + shellThickness(structure) + clearance : (face === 'back' ? -1 : 1) * (structure.size[2] / 2 + clearance)
      return { id: `${structure.id}:${face}`, structure, face, origin: new Vector3(...structure.position).addScaledVector(normal, offset), u, v, normal: normal.clone(), width: structure.size[0], height: structure.size[1], margin: structure.size[2] / 2 + clearance + .03, body }
    })
  })
}

const local = (surface: Surface, point: Vector3) => {
  const delta = point.clone().sub(surface.origin)
  return [delta.dot(surface.u), delta.dot(surface.v), delta.dot(surface.normal)] as Triple
}
const world = (surface: Surface, x: number, y: number) => surface.origin.clone().addScaledVector(surface.u, x).addScaledVector(surface.v, y)
const within = (surface: Surface, point: Vector3) => {
  const [x, y, z] = local(surface, point)
  return Math.abs(z) < 1e-5 && Math.abs(x) <= surface.width / 2 + surface.margin && Math.abs(y) <= surface.height / 2 + surface.margin && (!surface.structure.polygons||surfaceContains(surface.structure,[x,y],.03))
}
const triple = (point: Vector3) => point.toArray() as Triple

/** Common points on finite support planes. No unsupported gap edge is added. */
function transitions(a: Surface, b: Surface, endpoints: Vector3[]): Vector3[] {
  const direction = a.normal.clone().cross(b.normal), squared = direction.lengthSq()
  if (squared < 1e-10) {
    if (Math.abs(b.origin.clone().sub(a.origin).dot(a.normal)) > epsilon) return []
    // Clip B's rectangle to A in A's plane, including rotated coplanar rails.
    let polygon = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => local(a, world(b, x * b.width / 2, y * b.height / 2)))
    for (const [axis, bound, sign] of [[0, a.width / 2, 1], [0, a.width / 2, -1], [1, a.height / 2, 1], [1, a.height / 2, -1]]) {
      const clipped: Triple[] = []
      for (let i = 0; i < polygon.length; i++) {
        const from = polygon[i], to = polygon[(i + 1) % polygon.length], start = from[axis] * sign - bound, end = to[axis] * sign - bound
        if (start <= epsilon) clipped.push(from)
        if ((start < 0) !== (end < 0)) {
          const fraction = start / (start - end)
          clipped.push(from.map((value, index) => value + (to[index] - value) * fraction) as Triple)
        }
      }
      polygon = clipped
      if (!polygon.length) return []
    }
    const points = polygon.map(([x, y]) => world(a, x, y))
    const centre = points.reduce((sum, point) => sum.add(point), new Vector3()).multiplyScalar(1 / points.length)
    const edgesA=surfacePolygons(a.structure),edgesB=surfacePolygons(b.structure).map(poly=>poly.map(([x,y])=>local(a,world(b,x,y))))
    for(const poly of [...edgesA,...edgesB])for(const [x,y] of poly)points.push(world(a,x,y))
    for(const pa of edgesA)for(const pb of edgesB)for(let i=0;i<pa.length;i++)for(let j=0;j<pb.length;j++){
      const p=pa[i],q=pb[j],r=[pa[(i+1)%pa.length][0]-p[0],pa[(i+1)%pa.length][1]-p[1]],s=[pb[(j+1)%pb.length][0]-q[0],pb[(j+1)%pb.length][1]-q[1]],den=r[0]*s[1]-r[1]*s[0]
      if(Math.abs(den)<epsilon)continue
      const t=((q[0]-p[0])*s[1]-(q[1]-p[1])*s[0])/den,u=((q[0]-p[0])*r[1]-(q[1]-p[1])*r[0])/den
      if(t>=0&&t<=1&&u>=0&&u<=1)points.push(world(a,p[0]+r[0]*t,p[1]+r[1]*t))
    }
    return [centre,...points].filter(point=>within(a,point)&&within(b,point))
  }
  const da = a.normal.dot(a.origin), db = b.normal.dot(b.origin)
  const origin = b.normal.clone().cross(direction).multiplyScalar(da).add(direction.clone().cross(a.normal).multiplyScalar(db)).multiplyScalar(1 / squared)
  direction.normalize()
  let low = -Infinity, high = Infinity
  for (const surface of [a, b]) {
    const start = local(surface, origin)
    for (const [axis, vector, extent] of [[0, surface.u, surface.width / 2 + surface.margin], [1, surface.v, surface.height / 2 + surface.margin]] as const) {
      const slope = direction.dot(vector)
      if (Math.abs(slope) < epsilon) { if (Math.abs(start[axis]) > extent) return []; continue }
      const first = (-extent - start[axis]) / slope, last = (extent - start[axis]) / slope
      low = Math.max(low, Math.min(first, last)); high = Math.min(high, Math.max(first, last))
    }
  }
  if (low > high + epsilon || !Number.isFinite(low) || !Number.isFinite(high)) return []
  const parameters = [low, high, ...endpoints.map(point => Math.max(low, Math.min(high, point.clone().sub(origin).dot(direction))))]
  for(const surface of [a,b]){
    const p=local(surface,origin),d=[direction.dot(surface.u),direction.dot(surface.v)]
    for(const poly of surfacePolygons(surface.structure))for(let i=0;i<poly.length;i++){
      const q=poly[i],r=poly[(i+1)%poly.length],s=[r[0]-q[0],r[1]-q[1]],den=d[0]*s[1]-d[1]*s[0]
      if(Math.abs(den)<epsilon)continue
      const t=((q[0]-p[0])*s[1]-(q[1]-p[1])*s[0])/den,u=((q[0]-p[0])*d[1]-(q[1]-p[1])*d[0])/den
      if(t>=low&&t<=high&&u>=0&&u<=1)parameters.push(t)
    }
  }
  return [...new Set(parameters.map(value => Math.round(value * 1e8) / 1e8))].map(value => origin.clone().addScaledVector(direction, value)).filter(point=>within(a,point)&&within(b,point))
}

function terminalSupports(device: Device, point: Vector3, planes: Surface[]): Array<{ surface: number; point: Vector3 }> {
  const candidates: Array<{ surface: number; point: Vector3; distance: number }> = []
  for (const [index, surface] of planes.entries()) {
    if (device.mount && (device.mount.structureId !== surface.structure.id || device.mount.face !== surface.face)) continue
    const [x, y, z] = local(surface, point)
    if (Math.abs(z) > approachLimit || Math.abs(x) > surface.width / 2 || Math.abs(y) > surface.height / 2) continue
    if(!surfaceContains(surface.structure,[x,y]))continue
    candidates.push({ surface: index, point: world(surface, x, y), distance: Math.abs(z) })
  }
  return candidates.sort((a, b) => a.distance - b.distance).slice(0, 8)
}

export function routeConductor(input: Project, wire: Wire, sceneKey=structureKey(input)): SupportedRoute {
  const project = resolveMounts(input)
  if (!project.structures?.some(structure => structure.kind === 'wall')) throw new Error('Add at least one wall before using supported auto-routing.')
  const from = project.devices.find(device => device.id === wire.from), to = project.devices.find(device => device.id === wire.to)
  if (!from || !to) throw new Error('The conductor has a missing equipment endpoint.')
  const start = new Vector3(...terminalPosition(from, wire.fromPort)), finish = new Vector3(...terminalPosition(to, wire.toPort))
  const cacheKey=JSON.stringify([triple(start),triple(finish),from.mount?.structureId,from.mount?.face,to.mount?.structureId,to.mount?.face])
  let sceneCache=routeCache.get(sceneKey)
  if(!sceneCache){sceneCache=new Map();routeCache.set(sceneKey,sceneCache);if(routeCache.size>2)routeCache.delete(routeCache.keys().next().value!)}
  const cached=sceneCache.get(cacheKey)
  if(cached)return structuredClone(cached)
  const planes = surfaces(project)
  const starts = terminalSupports(from, start, planes), finishes = terminalSupports(to, finish, planes)
  if (!starts.length || !finishes.length) throw new Error('An endpoint has no supported terminal approach. Mount equipment on a valid surface, within its edges and 0.4 m of the cable plane.')
  const nodes: Node[] = [{ point: start, surface: -1 }, { point: finish, surface: -1 }], adjacency: Link[][] = [[], []]
  const addNode = (surface: number, point: Vector3) => { const id = nodes.length; nodes.push({ surface, point }); adjacency.push([]); return id }
  const link = (a: number, b: number, points: Triple[]) => {
    const distance = routeLength(points)
    adjacency[a].push({ to: b, distance, points }); adjacency[b].push({ to: a, distance, points: [...points].reverse() })
  }
  for (const candidate of starts) link(0, addNode(candidate.surface, candidate.point), [triple(start), triple(candidate.point)])
  for (const candidate of finishes) link(addNode(candidate.surface, candidate.point), 1, [triple(candidate.point), triple(finish)])
  const corners = planes.map(surface => [-1, 1].flatMap(x => [-1, 1].map(y => world(surface, x * (surface.width / 2 + surface.margin), y * (surface.height / 2 + surface.margin)))))
  for (let a = 0; a < planes.length; a++) for (let b = a + 1; b < planes.length; b++) {
    // AABB rejection avoids constructing portals between distant building walls.
    const overlaps = [0, 1, 2].every(axis => Math.min(...corners[a].map(point => point.getComponent(axis))) <= Math.max(...corners[b].map(point => point.getComponent(axis))) + epsilon && Math.min(...corners[b].map(point => point.getComponent(axis))) <= Math.max(...corners[a].map(point => point.getComponent(axis))) + epsilon)
    if (!overlaps) continue
    if (!planes[a].body.intersectsOBB(planes[b].body)) continue
    for (const point of transitions(planes[a], planes[b], [start, finish])) link(addNode(a, point), addNode(b, point), [triple(point), triple(point)])
  }
  const onSurface = new Map<number, number[]>()
  nodes.forEach((node, index) => { if (node.surface >= 0) onSurface.set(node.surface, [...(onSurface.get(node.surface) ?? []), index]) })
  for (const [surfaceIndex, members] of onSurface) for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
    const a = members[i], b = members[j], surface = planes[surfaceIndex]
    const first = local(surface, nodes[a].point), last = local(surface, nodes[b].point)
    if(surface.structure.building&&surface.structure.kind==='wall'&&Math.abs(first[0]-last[0])>1){
      // Long house runs sit at the wall/ceiling junction; nearby equipment can share a short local wall run.
      const height=surface.height/2-.10,a=world(surface,first[0],height),b=world(surface,last[0],height)
      link(members[i],members[j],[triple(nodes[members[i]].point),triple(a),triple(b),triple(nodes[members[j]].point)])
      continue
    }
    for(const [x,y] of [[first[0],last[1]],[last[0],first[1]]]){
      const corner=world(surface,x,y)
      const fits=!surface.structure.polygons||segmentFits(surface.structure,[first[0],first[1]],[x,y],.03)&&segmentFits(surface.structure,[x,y],[last[0],last[1]],.03)
      if(within(surface,corner)&&fits){link(a,b,[triple(nodes[a].point),triple(corner),triple(nodes[b].point)]);break}
    }
  }
  const distance = nodes.map(() => Infinity), visited = new Set<number>(), previous = new Map<number, { node: number; link: Link }>()
  distance[0] = 0
  for (let step = 0; step < nodes.length; step++) {
    let current = -1
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || distance[i] < distance[current])) current = i
    if (current < 0 || !Number.isFinite(distance[current])) break
    if (current === 1) break
    visited.add(current)
    for (const edge of adjacency[current]) if (distance[current] + edge.distance < distance[edge.to] - epsilon) { distance[edge.to] = distance[current] + edge.distance; previous.set(edge.to, { node: current, link: edge }) }
  }
  if (!Number.isFinite(distance[1])) throw new Error('No connected supported path joins these endpoints. Add a touching wall, roof or rail to bridge the surfaces.')
  const segments: Triple[][] = [], supportIds = new Set<string>()
  let node = 1
  while (node !== 0) {
    const entry = previous.get(node)
    if (!entry) throw new Error('The supported route could not be reconstructed.')
    segments.unshift(entry.link.points)
    if (nodes[node].surface >= 0) supportIds.add(planes[nodes[node].surface].structure.id)
    node = entry.node
  }
  const points:Triple[]=[]
  for(const point of segments.flat()){
    if(points.length&&new Vector3(...point).distanceTo(new Vector3(...points.at(-1)!))<=epsilon)continue
    if(points.length>=2){
      const a=new Vector3(...points.at(-1)!).sub(new Vector3(...points.at(-2)!)),b=new Vector3(...point).sub(new Vector3(...points.at(-1)!))
      if(a.clone().cross(b).length()<epsilon&&a.dot(b)>=0)points.pop()
    }
    points.push(point)
  }
  if(points.length>1002)throw new Error('The supported route exceeds the saved 1000-bend capacity. Divide it into supported conductor runs.')
  const result={ points, supportIds: [...supportIds], length: routeLength(points) }
  sceneCache.set(cacheKey,structuredClone(result));if(sceneCache.size>2000)sceneCache.delete(sceneCache.keys().next().value!)
  return result
}

export function previewSupportedRoute(project: Project, wireId: string): Project {
  const wire = project.wires.find(item => item.id === wireId)
  if (!wire) throw new Error('Select a conductor to route.')
  const result = routeConductor(project, wire)
  return { ...project, wires: project.wires.map(item => item.id === wireId ? { ...item, route3d: result.points.slice(1, -1), lengthMode: 'physical', length: result.length + (item.slack ?? 0), autoRoute: { supportIds: result.supportIds } } : item) }
}

/** Recompute support relationships after equipment or structural edits. */
export function refreshSupportedRoutes(project: Project): Project {
  if (!project.wires.some(wire => wire.autoRoute)) return project
  const sceneKey=structureKey(project)
  return { ...project, wires: project.wires.map(wire => {
    if (!wire.autoRoute) return wire
    try {
      const result = routeConductor(project, wire, sceneKey)
      return { ...wire, route3d: result.points.slice(1, -1), length: result.length + (wire.slack ?? 0), autoRoute: { supportIds: result.supportIds } }
    } catch (cause) {
      return { ...wire, autoRoute: { ...wire.autoRoute, error: cause instanceof Error ? cause.message : String(cause) } }
    }
  }) }
}

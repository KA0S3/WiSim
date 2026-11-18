import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three/src/math/Vector3.js'
import { blankProject, makeDevice, connect, validateProject } from '../src/workbench/model.ts'
import { makeStructure, mountDevice, resolveMounts, updateStructure, removeStructure, orientation } from '../src/workbench/spatial.ts'
import { physicalWirePoints, routeLength, synchronizeLengths, setWireRoute } from '../src/workbench/geometry.ts'
import { routeConductor, previewSupportedRoute } from '../src/workbench/surface-routing.ts'
import { staticFindings } from '../src/workbench/static-findings.ts'
import { pasteSelection, selectionProject } from '../src/workbench/selection.ts'

function fixture() {
  let p = blankProject()
  const wall = makeStructure('wall'); wall.position = [0, 1.5, 0]; wall.size = [6, 3, .12]
  const a = makeDevice('battery', 0, 0), b = makeDevice('resistor', 300, 0)
  p.structures = [wall]; p.devices = [a, b]; p.wires = [connect(a, 'p', b, 'p')]
  p = mountDevice(mountDevice(p, a.id, wall.id), b.id, wall.id)
  p.devices[0].mount.offset = [-2, -.7, .01]; p.devices[1].mount.offset = [2, .6, .01]
  return resolveMounts(p)
}

function orthogonal(points, rotation = [0, 0, 0]) {
  const inverse = orientation(rotation).invert()
  for (let i = 1; i < points.length; i++) {
    const delta = new Vector3(...points[i]).sub(new Vector3(...points[i - 1])).applyQuaternion(inverse)
    assert.ok(delta.toArray().filter(value => Math.abs(value) > 1e-6).length <= 1, 'segment must follow one surface axis or its terminal normal')
  }
}

test('wall routing previews orthogonal supported paths without mutating the project', () => {
  const p = fixture(), before = structuredClone(p), preview = previewSupportedRoute(p, p.wires[0].id), wire = preview.wires[0]
  assert.deepEqual(p, before); assert.ok(wire.autoRoute.supportIds.includes(p.structures[0].id))
  assert.equal(wire.lengthMode, 'physical'); orthogonal(physicalWirePoints(preview, wire))
  assert.equal(wire.length, routeLength(physicalWirePoints(preview, wire)))
  assert.ok(validateProject(synchronizeLengths(preview)))
})

test('pitched roof routes use surface-local right angles and supported terminal approaches', () => {
  let p = fixture(); const roof = makeStructure('roof'); roof.size = [6, 4, .08]; roof.position = [0, 3, 0]; roof.rotation = [-Math.PI / 2 + .35, 0, 0]; p.structures.push(roof)
  for (const d of p.devices) p = mountDevice(p, d.id, roof.id)
  p.devices[0].mount.offset = [-1, -.5, .01]; p.devices[1].mount.offset = [1, .5, .01]; p = resolveMounts(p)
  const result = routeConductor(p, p.wires[0]); orthogonal(result.points, roof.rotation)
  assert.ok(result.supportIds.includes(roof.id))
})

test('touching perpendicular walls provide a connected surface transition', () => {
  let p = fixture(); p.structures[0].size = [4, 3, .12]; p.devices[0].mount.offset = [-1, 0, .01]
  const wall = makeStructure('wall'); wall.position = [2, 1.5, 2]; wall.size = [4, 3, .12]; wall.rotation = [0, -Math.PI / 2, 0]; p.structures.push(wall)
  p = mountDevice(p, p.devices[1].id, wall.id); p.devices[1].mount.offset = [0, .4, .01]
  const result = routeConductor(p, p.wires[0]); assert.equal(result.supportIds.length, 2)
  orthogonal(result.points)
})

test('roof and wall can meet at a pitched supported junction', () => {
  let p = fixture(); p.structures[0].size = [4, 3, .12]; p.devices[0].mount.offset = [-1, 0, .01]
  const roof = makeStructure('roof'), pitch = .35; roof.size = [4, 4, .08]; roof.rotation = [-Math.PI / 2 - pitch, 0, 0]; roof.position = [0, 3 + 2 * Math.sin(pitch), 2 * Math.cos(pitch)]; p.structures.push(roof)
  p = mountDevice(p, p.devices[1].id, roof.id)
  const result = routeConductor(p, p.wires[0]); assert.ok(result.supportIds.includes(roof.id)); assert.ok(result.supportIds.includes(p.structures[0].id))
})

test('concave roof routing finds either bend order regardless of endpoint direction',()=>{
 let p=fixture();p.structures[0].position=[50,1.5,50]
 const roof=makeStructure('roof');roof.position=[0,3,0];roof.size=[6,6,.08]
 roof.polygons=[[[-3,-3],[3,-3],[3,-1],[-1,-1],[-1,3],[-3,3]]];p.structures.push(roof)
 p=mountDevice(mountDevice(p,p.devices[0].id,roof.id),p.devices[1].id,roof.id)
 p.devices[0].mount.offset=[2,-2,.01];p.devices[1].mount.offset=[-2,2,.01];p=resolveMounts(p)
 const wire=p.wires[0],forward=routeConductor(p,wire),reverse=routeConductor(p,{...wire,from:wire.to,fromPort:wire.toPort,to:wire.from,toPort:wire.fromPort})
 assert.ok(Math.abs(forward.length-reverse.length)<1e-6)
 orthogonal(forward.points,roof.rotation);orthogonal(reverse.points,roof.rotation)
})

test('missing walls, unsupported terminals and disconnected surfaces give explicit failures', () => {
  const p = fixture(); assert.throws(() => routeConductor({ ...p, structures: [] }, p.wires[0]), /at least one wall/)
  const freestanding = structuredClone(p); delete freestanding.devices[0].mount; freestanding.devices[0].physical = [0, 0, 10]
  assert.throws(() => routeConductor(freestanding, p.wires[0]), /terminal approach/)
  const disconnected = structuredClone(p), wall = makeStructure('wall'); wall.position = [10, 1.5, 0]; disconnected.structures.push(wall)
  const mounted = mountDevice(disconnected, disconnected.devices[1].id, wall.id)
  assert.throws(() => routeConductor(mounted, mounted.wires[0]), /No connected supported path/)
})

test('routes follow moved supports and invalid supports retain the last validated length with a finding', () => {
  const original = fixture(), p = synchronizeLengths(previewSupportedRoute(original, original.wires[0].id)), wall = p.structures[0]
  const moved = synchronizeLengths(updateStructure(p, wall.id, { position: [1, 2.5, 1] }))
  assert.ok(!moved.wires[0].autoRoute.error)
  assert.ok(Math.abs(moved.wires[0].length - p.wires[0].length) < 1e-6)
  for (let i = 0; i < p.wires[0].route3d.length; i++) for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(moved.wires[0].route3d[i][axis] - p.wires[0].route3d[i][axis] - 1) < 1e-6)
  const invalid = synchronizeLengths(removeStructure(p, wall.id))
  assert.match(invalid.wires[0].autoRoute.error, /wall/); assert.equal(invalid.wires[0].length, p.wires[0].length)
  assert.ok(staticFindings(invalid).some(finding => finding.id === `route-support-${p.wires[0].id}`))
  assert.ok(validateProject(JSON.parse(JSON.stringify(invalid))))
  const manual = setWireRoute(p, p.wires[0].id, [[0, 1, .2]])
  assert.equal(manual.wires[0].autoRoute, undefined)
})

test('saved and copied routes preserve support relationships and measured lengths', () => {
  const original = fixture(), p = synchronizeLengths(previewSupportedRoute(original, original.wires[0].id))
  const restored = synchronizeLengths(JSON.parse(JSON.stringify(p)))
  assert.deepEqual(restored.wires, p.wires)
  const subset = selectionProject(p, p.devices.map(device => device.id), true), pasted = pasteSelection(blankProject(), subset).project
  assert.ok(validateProject(pasted)); assert.ok(!pasted.wires[0].autoRoute.error)
  assert.deepEqual(pasted.wires[0].autoRoute.supportIds, [pasted.structures[0].id])
  assert.ok(Math.abs(pasted.wires[0].length - p.wires[0].length) < 1e-6)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOrthogonalRoute, findOrthogonalCrossings, findCollinearOverlaps, routeStrokeObstacles } from '../src/routing.ts'

test('saved waypoints produce only orthogonal route segments', () => {
  const route = buildOrthogonalRoute({ x: 10, y: 20 }, { x: 180, y: 160 }, [{ x: 60, y: 80 }, { x: 120, y: 110 }])
  assert.equal(route.path.startsWith('M 10 20'), true)
  assert.equal(route.path.endsWith('L 180 160'), true)
  assert.ok(route.segments.length >= 6)
  assert.ok(route.segments.every(segment => segment.from.x === segment.to.x || segment.from.y === segment.to.y))
})

test('a direct route with no saved bends remains orthogonal', () => {
  const route = buildOrthogonalRoute({ x: 0, y: 10 }, { x: 90, y: 100 }, [])
  assert.ok(route.segments.length >= 2)
  assert.ok(route.segments.every(segment => segment.from.x === segment.to.x || segment.from.y === segment.to.y))
})

test('perpendicular route crossings are marked away from electrical endpoints', () => {
  const crossings = findOrthogonalCrossings(
    [{ from: { x: 0, y: 50 }, to: { x: 100, y: 50 } }],
    [{ from: { x: 50, y: 0 }, to: { x: 50, y: 100 } }],
  )
  assert.deepEqual(crossings, [{ x: 50, y: 50, orientation: 'horizontal' }])
  assert.deepEqual(findOrthogonalCrossings(
    [{ from: { x: 0, y: 50 }, to: { x: 100, y: 50 } }],
    [{ from: { x: 100, y: 0 }, to: { x: 100, y: 100 } }],
  ), [])
  assert.deepEqual(findOrthogonalCrossings(
    [{ from: { x: 0, y: 40 }, to: { x: 100, y: 40 } }],
    [{ from: { x: 0, y: 40 }, to: { x: 100, y: 40 } }],
  ), [])
})

test('collinear route overlaps are reported while endpoint touches are ignored', () => {
  assert.deepEqual(findCollinearOverlaps(
    [{ from: { x: 0, y: 20 }, to: { x: 100, y: 20 } }],
    [{ from: { x: 50, y: 20 }, to: { x: 150, y: 20 } }],
  ), [{ from: { x: 50, y: 20 }, to: { x: 100, y: 20 }, orientation: 'horizontal' }])
  assert.deepEqual(findCollinearOverlaps(
    [{ from: { x: 0, y: 20 }, to: { x: 50, y: 20 } }],
    [{ from: { x: 50, y: 20 }, to: { x: 100, y: 20 } }],
  ), [])
})

test('later routes maintain clearance from earlier wire segments when space permits', () => {
  const occupied = routeStrokeObstacles([{ from: { x: 40, y: 50 }, to: { x: 60, y: 50 } }])
  const route = buildOrthogonalRoute({ x: 0, y: 50 }, { x: 100, y: 50 }, [], occupied)
  assert.equal(route.blocked, false)
  assert.ok(route.points.some(point => point.y === 42 || point.y === 58))
  assert.ok(route.segments.every(segment => segment.from.x === segment.to.x || segment.from.y === segment.to.y))
})

test('routes avoid device rectangles and flag an impossible saved checkpoint', () => {
  const obstacles = [{ left: 40, top: 30, right: 60, bottom: 70 }]
  const route = buildOrthogonalRoute({ x: 0, y: 50 }, { x: 100, y: 50 }, [], obstacles)
  assert.equal(route.blocked, false)
  assert.ok(route.points.some(point => point.y === 30 || point.y === 70))
  assert.ok(route.segments.every(segment => {
    const horizontal = segment.from.y === segment.to.y
    return horizontal
      ? segment.from.y <= obstacles[0].top || segment.from.y >= obstacles[0].bottom || Math.max(Math.min(segment.from.x, segment.to.x), obstacles[0].left) >= Math.min(Math.max(segment.from.x, segment.to.x), obstacles[0].right)
      : segment.from.x <= obstacles[0].left || segment.from.x >= obstacles[0].right || Math.max(Math.min(segment.from.y, segment.to.y), obstacles[0].top) >= Math.min(Math.max(segment.from.y, segment.to.y), obstacles[0].bottom)
  }))
  const forced = buildOrthogonalRoute({ x: 0, y: 50 }, { x: 100, y: 50 }, [{ x: 50, y: 50 }], obstacles)
  assert.equal(forced.blocked, true)
})

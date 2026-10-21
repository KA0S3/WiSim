export type RoutePoint = { x: number; y: number }
export type RouteSegment = { from: RoutePoint; to: RoutePoint }
export type RouteObstacle = { left: number; top: number; right: number; bottom: number }

export function routeStrokeObstacles(segments: RouteSegment[], clearance = 8): RouteObstacle[] {
  return segments.flatMap(segment => {
    if (Math.abs(segment.from.y - segment.to.y) < 0.01) {
      if (Math.abs(segment.from.x - segment.to.x) < 0.01) return []
      return [{ left: Math.min(segment.from.x, segment.to.x), top: segment.from.y - clearance, right: Math.max(segment.from.x, segment.to.x), bottom: segment.from.y + clearance }]
    }
    if (Math.abs(segment.from.x - segment.to.x) < 0.01) return [{ left: segment.from.x - clearance, top: Math.min(segment.from.y, segment.to.y), right: segment.from.x + clearance, bottom: Math.max(segment.from.y, segment.to.y) }]
    return []
  })
}

function inside(point: RoutePoint, obstacle: RouteObstacle) {
  return point.x > obstacle.left + 0.01 && point.x < obstacle.right - 0.01 && point.y > obstacle.top + 0.01 && point.y < obstacle.bottom - 0.01
}

function blocked(from: RoutePoint, to: RoutePoint, obstacles: RouteObstacle[]) {
  for (const obstacle of obstacles) {
    if (Math.abs(from.y - to.y) < 0.01 && from.y > obstacle.top + 0.01 && from.y < obstacle.bottom - 0.01 &&
      Math.max(Math.min(from.x, to.x), obstacle.left) < Math.min(Math.max(from.x, to.x), obstacle.right) - 0.01) return true
    if (Math.abs(from.x - to.x) < 0.01 && from.x > obstacle.left + 0.01 && from.x < obstacle.right - 0.01 &&
      Math.max(Math.min(from.y, to.y), obstacle.top) < Math.min(Math.max(from.y, to.y), obstacle.bottom) - 0.01) return true
  }
  return obstacles.some(obstacle => inside(from, obstacle) || inside(to, obstacle))
}

function simplify(points: RoutePoint[]) {
  const output: RoutePoint[] = []
  for (const point of points) {
    while (output.length >= 2) {
      const a = output[output.length - 2], b = output[output.length - 1]
      if (Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - point.x) < 0.01 || Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - point.y) < 0.01) output.pop()
      else break
    }
    output.push(point)
  }
  return output
}

function shortestOrthogonalPath(start: RoutePoint, end: RoutePoint, obstacles: RouteObstacle[]) {
  const aligned = Math.abs(start.x - end.x) < 0.01 || Math.abs(start.y - end.y) < 0.01
  if (aligned && !obstacles.some(obstacle => inside(start, obstacle) || inside(end, obstacle)) && !blocked(start, end, obstacles)) return [start, end]
  const xs = [...new Set([start.x, end.x, ...obstacles.flatMap(obstacle => [obstacle.left, obstacle.right])])].sort((a, b) => a - b)
  const ys = [...new Set([start.y, end.y, ...obstacles.flatMap(obstacle => [obstacle.top, obstacle.bottom])])].sort((a, b) => a - b)
  const points: RoutePoint[] = []
  for (const y of ys) for (const x of xs) {
    const point = { x, y }
    if (!obstacles.some(obstacle => inside(point, obstacle))) points.push(point)
  }
  const key = (point: RoutePoint) => `${point.x}:${point.y}`
  const index = new Map(points.map((point, i) => [key(point), i]))
  const startIndex = index.get(key(start)), endIndex = index.get(key(end))
  if (startIndex == null || endIndex == null) return null
  const adjacent: Array<Array<{ to: number; direction: 0 | 1; length: number }>> = points.map(() => [])
  const connectGroup = (group: number[], direction: 0 | 1) => {
    group.sort((a, b) => direction === 0 ? points[a].x - points[b].x : points[a].y - points[b].y)
    for (let i = 1; i < group.length; i++) {
      const a = group[i - 1], b = group[i], from = points[a], to = points[b]
      if (blocked(from, to, obstacles)) continue
      const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
      adjacent[a].push({ to: b, direction, length }); adjacent[b].push({ to: a, direction, length })
    }
  }
  for (const x of xs) connectGroup(points.map((point, i) => point.x === x ? i : -1).filter(i => i >= 0), 1)
  for (const y of ys) connectGroup(points.map((point, i) => point.y === y ? i : -1).filter(i => i >= 0), 0)
  const stateCount = points.length * 3, distance = Array(stateCount).fill(Infinity), previous = Array<number | null>(stateCount).fill(null)
  const heap: Array<{ state: number; cost: number }> = []
  const push = (item: { state: number; cost: number }) => {
    heap.push(item)
    let index = heap.length - 1
    while (index > 0) { const parent = Math.floor((index - 1) / 2); if (heap[parent].cost <= item.cost) break; heap[index] = heap[parent]; index = parent }
    heap[index] = item
  }
  const pop = () => {
    const first = heap[0], last = heap.pop()!
    if (heap.length) {
      let index = 0
      while (true) { const left = index * 2 + 1, right = left + 1; if (left >= heap.length) break; const child = right < heap.length && heap[right].cost < heap[left].cost ? right : left; if (heap[child].cost >= last.cost) break; heap[index] = heap[child]; index = child }
      heap[index] = last
    }
    return first
  }
  const startState = startIndex * 3 + 2
  distance[startState] = 0
  push({ state: startState, cost: 0 })
  while (heap.length) {
    const item = pop(), current = item.state
    if (item.cost !== distance[current]) continue
    const pointIndex = Math.floor(current / 3), direction = (current % 3) as 0 | 1 | 2
    if (pointIndex === endIndex) break
    for (const edge of adjacent[pointIndex]) {
      const next = edge.to * 3 + edge.direction
      const cost = edge.length + (direction !== 2 && direction !== edge.direction ? 18 : 0)
      if (distance[current] + cost < distance[next]) { distance[next] = distance[current] + cost; previous[next] = current; push({ state: next, cost: distance[next] }) }
    }
  }
  const endState = [0, 1].map(direction => endIndex * 3 + direction).sort((a, b) => distance[a] - distance[b])[0]
  if (!Number.isFinite(distance[endState])) return null
  const path: RoutePoint[] = []
  for (let state: number | null = endState; state !== null; state = previous[state]) path.push(points[Math.floor(state / 3)])
  path.reverse()
  return simplify(path)
}

export function buildOrthogonalRoute(start: RoutePoint, end: RoutePoint, waypoints: RoutePoint[], obstacles: RouteObstacle[] = []) {
  const points: RoutePoint[] = [{ ...start }]
  let blockedRoute = false
  for (const point of [...waypoints, end]) {
    const current = points[points.length - 1]
    const leg = shortestOrthogonalPath(current, point, obstacles)
    if (!leg) {
      blockedRoute = true
      points.push({ x: point.x, y: current.y }, { ...point })
    } else points.push(...leg.slice(1))
  }
  const simplified = simplify(points)
  const segments = simplified.slice(1).map((point, index) => ({ from: simplified[index], to: point }))
  const path = simplified.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  return { points: simplified, segments, path, blocked: blockedRoute }
}

export function findOrthogonalCrossings(first: RouteSegment[], second: RouteSegment[]) {
  const crossings: Array<RoutePoint & { orientation: 'horizontal' | 'vertical' }> = []
  for (const a of first) for (const b of second) {
    const ah = Math.abs(a.from.y - a.to.y) < 0.01, av = Math.abs(a.from.x - a.to.x) < 0.01
    const bh = Math.abs(b.from.y - b.to.y) < 0.01, bv = Math.abs(b.from.x - b.to.x) < 0.01
    if (ah && bv) {
      const x = b.from.x, y = a.from.y
      if (x > Math.min(a.from.x, a.to.x) + 1 && x < Math.max(a.from.x, a.to.x) - 1 && y > Math.min(b.from.y, b.to.y) + 1 && y < Math.max(b.from.y, b.to.y) - 1) crossings.push({ x, y, orientation: 'horizontal' })
    } else if (av && bh) {
      const x = a.from.x, y = b.from.y
      if (x > Math.min(b.from.x, b.to.x) + 1 && x < Math.max(b.from.x, b.to.x) - 1 && y > Math.min(a.from.y, a.to.y) + 1 && y < Math.max(a.from.y, a.to.y) - 1) crossings.push({ x, y, orientation: 'vertical' })
    }
  }
  return crossings
}

export function findCollinearOverlaps(first: RouteSegment[], second: RouteSegment[]) {
  const overlaps: Array<{ from: RoutePoint; to: RoutePoint; orientation: 'horizontal' | 'vertical' }> = []
  for (const a of first) for (const b of second) {
    const ah = Math.abs(a.from.y - a.to.y) < 0.01, bh = Math.abs(b.from.y - b.to.y) < 0.01
    if (ah && bh && Math.abs(a.from.y - b.from.y) < 0.01) {
      const left = Math.max(Math.min(a.from.x, a.to.x), Math.min(b.from.x, b.to.x))
      const right = Math.min(Math.max(a.from.x, a.to.x), Math.max(b.from.x, b.to.x))
      if (right - left > 1) overlaps.push({ from: { x: left, y: a.from.y }, to: { x: right, y: a.from.y }, orientation: 'horizontal' })
    } else if (!ah && !bh && Math.abs(a.from.x - b.from.x) < 0.01) {
      const top = Math.max(Math.min(a.from.y, a.to.y), Math.min(b.from.y, b.to.y))
      const bottom = Math.min(Math.max(a.from.y, a.to.y), Math.max(b.from.y, b.to.y))
      if (bottom - top > 1) overlaps.push({ from: { x: a.from.x, y: top }, to: { x: a.from.x, y: bottom }, orientation: 'vertical' })
    }
  }
  return overlaps
}

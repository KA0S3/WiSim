import type { Terminal } from './simulation'

export function terminalSide(terminals: Terminal[], terminal: Terminal): NonNullable<Terminal['side']> {
  return terminal.side ?? (terminals.indexOf(terminal) % 2 === 0 ? 'left' : 'right')
}

export function terminalOrder(terminals: Terminal[], terminal: Terminal) {
  const side = terminalSide(terminals, terminal)
  return terminals
    .filter(item => terminalSide(terminals, item) === side)
    .sort((a, b) => (a.order ?? terminals.indexOf(a) + 1) - (b.order ?? terminals.indexOf(b) + 1))
    .findIndex(item => item.id === terminal.id) + 1
}

/** Move a terminal while keeping each affected side's displayed order contiguous. */
export function placeTerminal(terminals: Terminal[], terminalId: string, side: NonNullable<Terminal['side']>, order: number): Terminal[] {
  const moving = terminals.find(item => item.id === terminalId)
  if (!moving) return terminals

  const sourceSide = terminalSide(terminals, moving)
  const byOrder = (a: Terminal, b: Terminal) => (a.order ?? terminals.indexOf(a) + 1) - (b.order ?? terminals.indexOf(b) + 1)
  const source = terminals.filter(item => item.id !== terminalId && terminalSide(terminals, item) === sourceSide).sort(byOrder)
  const destination = sourceSide === side
    ? source
    : terminals.filter(item => terminalSide(terminals, item) === side).sort(byOrder)
  destination.splice(Math.max(0, Math.min(destination.length, Math.floor(order) - 1)), 0, moving)

  const placements = new Map<string, Pick<Terminal, 'side' | 'order' | 'x' | 'y'>>()
  if (sourceSide !== side) source.forEach((item, index) => placements.set(item.id, { side: sourceSide, order: index + 1 }))
  destination.forEach((item, index) => placements.set(item.id, { side, order: index + 1, x: undefined, y: undefined }))
  return terminals.map(item => {
    const placement = placements.get(item.id)
    return placement ? { ...item, ...placement } : item
  })
}

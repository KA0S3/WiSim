import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [main, styles, refocus, a11y, overrides] = await Promise.all([
  readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/refocus.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/a11y.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/ui-overrides.css', import.meta.url), 'utf8'),
])

assert.match(styles, /@media\(max-width:1000px\)/)
assert.match(styles, /@media\(max-width:720px\)/)
assert.match(styles, /body\{margin:0;min-width:0;overflow:hidden\}/)
assert.match(main, /role="application" aria-label="WireSim terminal canvas" tabIndex=\{0\}/)
assert.match(main, /aria-label="Undo"/)
assert.match(main, /aria-label="Redo"/)
assert.match(main, /aria-label="Zoom out"/)
assert.match(main, /aria-label="Zoom out" title="Zoom out"/)
assert.match(main, /aria-label="Zoom in" title="Zoom in"/)
assert.match(main, /role="button" aria-label=\{`\$\{node\.name\}/)
assert.match(main, /selectedMany\.includes\(node\.id\)/)
assert.match(main, /event\.shiftKey \|\| event\.ctrlKey \|\| event\.metaKey/)
assert.match(main, /const selectNode = \(nodeId: string, additive = false\)/)
assert.match(main, /setSelectedMany\(\['inv-1'\]\)/)
assert.match(main, /role="status" aria-live="polite"/)
assert.match(main, /wiresim-move-bend/)
assert.ok(main.includes("import { placeTerminal, terminalOrder, terminalSide } from './terminalLayout'"))
assert.ok(main.includes('placeTerminal(terminals, terminal.id, side, order)'))
assert.ok(main.includes("explainModelBoundaryWarning(event.evidence)"))
assert.ok(main.includes("import { toggleDevicePath } from './deviceControls'"))
assert.ok(main.includes('commit(current => toggleDevicePath(current, id))'))
assert.ok(main.includes('Open transfer path'))
assert.ok(main.includes('Trip modeled protection'))
assert.ok(main.includes('disabled={Boolean(node.tripped && node.resettable === false)}'))
assert.ok(main.includes('non-resettable in the project'))
assert.ok(main.includes('error !== wireDraftConnectionIssue?.message'))
assert.ok(main.includes('getWireTerminalIssue(project, wire)'))
assert.ok(main.includes('connection-issue'))
assert.match(overrides, /@keyframes connection-mismatch-pulse/)
assert.match(overrides, /prefers-reduced-motion:reduce/)
assert.match(main, /Reset corners to auto-route/)
assert.ok(main.includes('<form onSubmit={event => { event.preventDefault(); saveWireDraft() }}><div className="inspector-head">'))
assert.ok(main.includes('type="submit" className="primary" disabled={wireDraftErrors.length > 0}>Add connection'))
assert.ok(main.includes('onCancel={event => { event.preventDefault(); setWireDraft(null) }}'))
assert.match(main, /wire\.parallel \?\? 1/)
assert.match(main, /wire\.fromTerminal/)
assert.match(main, /wire\.toTerminal/)
assert.match(main, /strokeWidth/)
assert.match(main, /result\.network\.deviceStates\[node\.id\]/)
assert.match(refocus, /wire-line\.selected path/)
assert.match(a11y, /prefers-reduced-motion: reduce/)
assert.match(a11y, /focus-visible/)
assert.match(a11y, /\.terminal:focus-visible/)
assert.match(refocus, /@media\(max-width:720px\)\{\.topbar\{flex-wrap:wrap\}/)

console.log('UI audit: responsive shell, focusable canvas, labeled controls, terminal-aware wire geometry, bend persistence, and motion/focus rules present')

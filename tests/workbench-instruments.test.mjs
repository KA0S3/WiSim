import test from 'node:test'
import assert from 'node:assert/strict'
import { blankProject, makeDevice, connect, wireResistance } from '../src/workbench/model.ts'
import { readMeter, resistanceBetween } from '../src/workbench/instruments.ts'
import { staticFindings } from '../src/workbench/static-findings.ts'
import { connectionFindings } from '../src/workbench/connection-checks.ts'
import { suggestedFix } from '../src/workbench/repairs.ts'

const close = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} vs ${expected}`)
const probes = device => [{ id: device.id, port: 'p' }, { id: device.id, port: 'n' }]
const frame = () => ({ revision: 0, time: .1, durationMs: 0, devices: {}, wires: {}, terminals: {}, waveforms: {}, times: Array.from({ length: 1001 }, (_, i) => i / 10000), measurements: {}, findings: [], engine: 'fixture' })

test('meter separates DC offset and AC component, with 60 Hz measured from samples', () => {
  const p = blankProject(), device = makeDevice('grid', 0, 0), f = frame(); p.devices = [device]
  const [a, b] = probes(device).map(probe => `${probe.id}:${probe.port}`)
  f.waveforms[a] = f.times.map(time => 12 + 120 * Math.SQRT2 * Math.sin(2 * Math.PI * 60 * time))
  f.waveforms[b] = f.times.map(() => 0)
  f.measurements[a] = { ac: true, frequency: 60 }; f.measurements[b] = { ac: true, frequency: 60 }
  close(readMeter(p, f, probes(device), null, 'dc-voltage').value, 12, .002)
  close(readMeter(p, f, probes(device), null, 'ac-voltage').value, 120, .03)
  close(readMeter(p, f, probes(device), null, 'frequency').value, 60, .001)
  f.waveforms[a] = f.times.map(() => 12)
  assert.equal(readMeter(p, f, probes(device), null, 'frequency').value, undefined)
  close(readMeter(p, f, probes(device), null, 'ac-voltage').value, 0)
})

test('current uses a selected branch and power uses measured equipment', () => {
  const p = blankProject(), a = makeDevice('battery', 0, 0), b = makeDevice('resistor', 0, 0), f = frame()
  p.devices = [a, b]; const wire = connect(a, 'p', b, 'p'); p.wires = [wire]
  f.waveforms[wire.id] = f.times.map(() => -2); f.devices[b.id] = { voltage: 10, current: 2, power: 20, state: 'active' }
  close(readMeter(p, f, [], wire.id, 'current').value, -2)
  close(readMeter(p, f, [], b.id, 'power').value, 20)
  assert.equal(readMeter(p, f, [], b.id, 'current').value, undefined)
  assert.equal(readMeter(p, null, [], wire.id, 'current').value, undefined)
})

test('resistance solves parallel paths including conductor/contact resistance', () => {
  const p = blankProject(), a = makeDevice('resistor', 0, 0), b = makeDevice('resistor', 0, 0)
  a.spec.resistance = 100; b.spec.resistance = 100; p.devices = [a, b]
  p.wires = [connect(a, 'p', b, 'p'), connect(a, 'n', b, 'n')]
  const other = 100 + p.wires.reduce((sum, wire) => sum + wireResistance(wire, p.ambient), 0)
  close(resistanceBetween(p, probes(a), null).value, 100 * other / (100 + other))
  assert.equal(readMeter(p, null, probes(a), null, 'continuity').label, 'NO CONTINUITY > 30 Ω')
  a.spec.resistance = 10
  assert.equal(readMeter(p, null, probes(a), null, 'continuity').label, 'CONTINUITY ≤ 30 Ω')
  a.on = false; b.on = false
  assert.equal(resistanceBetween(p, probes(a), null).value, Infinity)
})

test('resistance handles a bridge network and the same terminal', () => {
  const p = blankProject(), resistors = Array.from({ length: 5 }, () => makeDevice('resistor', 0, 0))
  for (const r of resistors) r.spec.resistance = 100
  p.devices = resistors
  const [a, b, c, d, e] = resistors
  const wire = (x, xp, y, yp) => { const w = connect(x, xp, y, yp); w.length = 0; w.contactMilliOhm = 0; return w }
  p.wires = [wire(a, 'p', c, 'p'), wire(a, 'n', b, 'p'), wire(c, 'n', d, 'p'), wire(b, 'n', d, 'n'), wire(e, 'p', a, 'n'), wire(e, 'n', c, 'n')]
  close(resistanceBetween(p, [{ id: a.id, port: 'p' }, { id: b.id, port: 'n' }], null).value, 100)
  close(resistanceBetween(p, [probes(a)[0], probes(a)[0]], null).value, 0)
})

test('resistance requires source isolation even while paused and rejects nonlinear paths', () => {
  const p = blankProject(), source = makeDevice('battery', 0, 0), resistor = makeDevice('resistor', 0, 0)
  p.devices = [source, resistor]; p.wires = [connect(source, 'p', resistor, 'p'), connect(source, 'n', resistor, 'n')]
  assert.match(resistanceBetween(p, probes(resistor), null).detail, /Isolate/)
  source.on = false; close(resistanceBetween(p, probes(resistor), null).value, 100)
  const diode = makeDevice('diode', 0, 0); p.devices.push(diode); p.wires.push(connect(resistor, 'p', diode, 'p'))
  assert.match(resistanceBetween(p, probes(resistor), null).detail, /nonlinear/)
})

test('stored energy remains a resistance hazard after equipment is switched off', () => {
  const p = blankProject(), capacitor = makeDevice('capacitor', 0, 0), f = frame(); capacitor.on = false; p.devices = [capacitor]
  assert.match(resistanceBetween(p, probes(capacitor), null).detail, /unverified/)
  f.devices[capacitor.id] = { voltage: 0, current: 0, power: 0, state: 'open', storedEnergyJ: 1 }
  assert.match(resistanceBetween(p, probes(capacitor), f).detail, /Discharge/)
  f.devices[capacitor.id].storedEnergyJ = 0
  assert.equal(resistanceBetween(p, probes(capacitor), f).value, Infinity)
})

test('static source shorts and protection bypasses have optional reversible fixes', () => {
  const p = blankProject(), source = makeDevice('grid', 0, 0), fuse = makeDevice('fuse', 0, 0)
  p.devices = [source, fuse]; p.wires = [connect(source, 'p', fuse, 'p'), connect(fuse, 'n', source, 'n'), connect(fuse, 'p', fuse, 'n')]
  const findings = connectionFindings(p), short = findings.find(f => f.id.startsWith('short-')), bypass = findings.find(f => f.id.startsWith('protection-bypass-'))
  assert.ok(short); assert.ok(bypass)
  const before = structuredClone(p), fix = suggestedFix(p, short)
  assert.ok(fix); assert.equal(fix.project.devices[0].on, false); assert.deepEqual(p, before)
  assert.ok(!connectionFindings(fix.project).some(f => f.id === short.id))
  assert.equal(suggestedFix(p, bypass).project.wires.length, p.wires.length - 1)
})

test('open-terminal diagnostics and parallel source conflicts are available before solving', () => {
  const p = blankProject(), a = makeDevice('grid', 0, 0), b = makeDevice('grid', 0, 0), r = makeDevice('resistor', 0, 0)
  b.spec.frequency = 60; p.devices = [a, b, r]; p.wires = [connect(a, 'p', b, 'p'), connect(a, 'n', b, 'n'), connect(a, 'p', r, 'p')]
  const findings = staticFindings(p), conflict = findings.find(f => f.id.startsWith('ac-source-conflict-'))
  assert.equal(conflict.severity, 'fault'); assert.equal(findings.find(f => f.id === `open-${r.id}`).severity, 'warning')
  assert.ok(suggestedFix(p, conflict)); b.spec.frequency = 50
  assert.equal(staticFindings(p).find(f => f.id.startsWith('ac-source-conflict-')).severity, 'warning')
})

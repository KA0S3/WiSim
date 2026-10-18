import test from 'node:test'
import assert from 'node:assert/strict'
import { CATALOG_RECORDS } from '../src/catalog.ts'
import { checkInterface } from '../src/compatibility.ts'
import { checkNominalVoltage } from '../src/compatibility.ts'
import { saveCustomRecord, saveCustomRecords } from '../src/customCatalogue.ts'

test('catalogue has broad source-linked Victron coverage with a small verified core', () => {
  const victron = CATALOG_RECORDS.filter(record => record.id.startsWith('victron-'))
  const generic = CATALOG_RECORDS.filter(record => record.status === 'reference only')
  assert.ok(victron.length >= 60)
  assert.ok(generic.length >= 20)
  assert.ok(victron.every(record => record.source?.startsWith('https://www.victronenergy.com/')))
  assert.ok(victron.some(record => record.status === 'verified'))
  assert.ok(victron.some(record => record.status === 'partially verified'))
})

test('interface matching is explicit and unknown generic records stay unverified', () => {
  const multiPlus = CATALOG_RECORDS.find(record => record.name.startsWith('MultiPlus '))
  const generic = CATALOG_RECORDS.find(record => record.status === 'reference only')
  assert.equal(checkInterface(multiPlus, 'VE.Bus'), 'pass')
  assert.equal(checkInterface(multiPlus, 'VE.Direct'), 'fail')
  assert.equal(checkInterface(generic, 'GX'), 'needs verification')
})

test('matcher treats real nominal battery voltage ranges as compatible', () => {
  assert.equal(checkNominalVoltage(12.8, 12), 'pass')
  assert.equal(checkNominalVoltage(24, 12), 'fail')
  assert.equal(checkNominalVoltage(undefined, 48), 'needs verification')
})

test('source-linked inverter records expose AC requirements when known', () => {
  const record = CATALOG_RECORDS.find(item => item.id === 'victron-multiplus-12-1200')
  assert.equal(record.acVoltage, 230)
  assert.equal(record.acFrequency, 50)
})

test('SmartSolar model notation exposes PV voltage and current limits across the family', () => {
  const record = CATALOG_RECORDS.find(item => item.name === 'SmartSolar MPPT 250/100')
  assert.equal(record.pvVoc, 250)
  assert.equal(record.current, 100)
})

test('the verified SmartSolar 75/15 record carries exact ratings and terminals', () => {
  const record = CATALOG_RECORDS.find(item => item.id === 'victron-smartsolar-75-15')
  assert.equal(record.status, 'verified')
  assert.equal(record.current, 15)
  assert.equal(record.pvVoc, 75)
  assert.deepEqual(record.terminalLayout.map(terminal => terminal.id), ['pv+', 'pv-', 'bat+', 'bat-'])
})

test('custom catalogue records are clearly labelled and replace by id', () => {
  const previous = globalThis.localStorage
  const storage = new Map()
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  const record = saveCustomRecord({ id: 'custom-test', name: 'My Test Inverter', family: 'Custom', kind: 'inverter', power: 800 })
  assert.equal(record.status, 'custom')
  assert.equal(JSON.parse(storage.get('wiresim-custom-catalogue')).length, 1)
  globalThis.localStorage = previous
})

test('custom catalogue storage failures return null instead of throwing', () => {
  const previous = globalThis.localStorage
  globalThis.localStorage = { getItem: () => '[]', setItem: () => { throw new Error('quota') } }
  assert.equal(saveCustomRecord({ id: 'custom-fail', name: 'Fails', family: 'Custom', kind: 'load' }), null)
  globalThis.localStorage = previous
})

test('custom catalogue bundle writes only custom records', () => {
  const previous = globalThis.localStorage
  const storage = new Map()
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  assert.equal(saveCustomRecords([{ id: 'custom-one', name: 'One', family: 'Custom', kind: 'load', status: 'custom' }, { id: 'generic', name: 'Generic', family: 'Generic', kind: 'load', status: 'reference only' }]), true)
  assert.equal(JSON.parse(storage.get('wiresim-custom-catalogue')).length, 1)
  globalThis.localStorage = previous
})

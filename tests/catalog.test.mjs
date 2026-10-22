import test from 'node:test'
import assert from 'node:assert/strict'
import { CATALOG_RECORDS, INSTALLATION_RULE_SETS } from '../src/catalog.ts'
import { applyRecordToNode, checkInterface, checkNominalVoltage, compareRecord } from '../src/compatibility.ts'
import { saveCustomRecord, saveCustomRecords } from '../src/customCatalogue.ts'

test('unified product catalogue includes a broad, honestly status-labelled model inventory', () => {
  assert.ok(CATALOG_RECORDS.length >= 110, `expected broad component and brand coverage, got ${CATALOG_RECORDS.length}`)
  const verified = CATALOG_RECORDS.filter(record => record.status === 'verified')
  const inProgress = CATALOG_RECORDS.filter(record => record.status !== 'verified')
  assert.ok(verified.length > 0)
  assert.ok(inProgress.length > 0)
  assert.ok(verified.every(record => record.brand && record.brandColors && record.componentType))
  assert.ok(inProgress.every(record => record.source?.startsWith('https://') && record.missingData?.length))
  assert.ok(CATALOG_RECORDS.every(record => record.source?.startsWith('https://')))
  assert.ok(new Set(CATALOG_RECORDS.map(record => record.brand)).size >= 9)
  assert.ok(new Set(CATALOG_RECORDS.map(record => record.kind)).size >= 5)
  assert.equal(new Set(CATALOG_RECORDS.map(record => record.id)).size, CATALOG_RECORDS.length)
})

test('installation-related inventory is grouped across inverter, charger, monitoring, and bus components', () => {
  const componentTypes = new Set(CATALOG_RECORDS.map(record => record.componentType))
  const brands = new Set(CATALOG_RECORDS.map(record => record.brand))

  assert.ok(componentTypes.has('inverter/charger'))
  assert.ok(componentTypes.has('battery charger'))
  assert.ok(componentTypes.has('system controller'))
  assert.ok(componentTypes.has('communication interface'))
  assert.ok(componentTypes.has('DC distribution'))
  assert.ok(componentTypes.has('battery management system'))
  for (const brand of ['Victron Energy', 'Samlex America', 'Xantrex', 'Renogy', 'NOCO', 'EPEVER', 'Morningstar']) {
    assert.ok(brands.has(brand), `expected ${brand} coverage`)
  }

  const multiPlus = CATALOG_RECORDS.find(record => record.id === 'victron-multiplus-ii-48-5000-230v')
  const quattro = CATALOG_RECORDS.find(record => record.id === 'victron-quattro-ii-48-5000-70-50')
  const xantrex = CATALOG_RECORDS.find(record => record.id === 'xantrex-freedom-x-1200')
  const charger = CATALOG_RECORDS.find(record => record.id === 'noco-genius10')
  assert.equal(multiPlus?.kind, 'inverter-charger')
  assert.equal(quattro?.kind, 'inverter-charger')
  assert.equal(xantrex?.power, 1200)
  assert.equal(xantrex?.surge, 2400)
  assert.equal(charger?.chargeCurrent, 10)
  assert.ok([multiPlus, quattro, xantrex, charger].every(record => record?.status === 'partially verified'))
})

test('all model entries on the current Victron MultiPlus-II family page are inventoried', () => {
  const multiPlusModels = CATALOG_RECORDS.filter(record => record.brand === 'Victron Energy' && record.productFamily === 'MultiPlus-II')
  assert.equal(multiPlusModels.length, 26)
  assert.ok(multiPlusModels.every(record => record.status === 'partially verified' && record.source === 'https://www.victronenergy.com/inverters-chargers/multiplus-ii'))
  assert.ok(multiPlusModels.some(record => record.productModel.includes('GX')))
  assert.ok(multiPlusModels.some(record => record.productModel.includes('UL 1741')))
  assert.ok(multiPlusModels.some(record => record.productModel.includes('50/60Hz')))
})

test('verified models have documented physical terminal positions and installation guidance', () => {
  for (const record of CATALOG_RECORDS.filter(record => record.status === 'verified')) {
    assert.ok(record.terminalLayout.length > 0, record.id)
    assert.ok(record.terminalLayoutSource.startsWith('https://'), record.id)
    assert.ok(record.terminalLayout.every(terminal => ['top', 'bottom', 'left', 'right'].includes(terminal.side) && Number.isInteger(terminal.order)), record.id)
    assert.ok(INSTALLATION_RULE_SETS.some(ruleSet => ruleSet.id === record.installationRuleSetId && ruleSet.rules.length > 0), record.id)
  }
  assert.deepEqual(
    CATALOG_RECORDS.find(record => record.id === 'victron-smartsolar-75-15').terminalLayout.map(terminal => terminal.id),
    ['bat+', 'bat-', 'pv-', 'pv+', 'load-', 'load+'],
  )
  assert.deepEqual(
    CATALOG_RECORDS.find(record => record.id === 'victron-smartsolar-100-30').terminalLayout.map(terminal => terminal.id),
    ['bat+', 'bat-', 'pv-', 'pv+'],
  )
})

test('MPPT ratings preserve exact model-specific voltage and power limits', () => {
  const mppt7515 = CATALOG_RECORDS.find(record => record.id === 'victron-smartsolar-75-15')
  assert.equal(mppt7515.pvVoc, 75)
  assert.equal(mppt7515.current, 15)
  assert.equal(mppt7515.maxPvShortCircuitCurrentA, 15)
  assert.deepEqual(mppt7515.continuousLoadCurrentAByBatteryVoltage, { 12: 15, 24: 15 })
  assert.deepEqual(mppt7515.nominalPvPowerWByBatteryVoltage, { 12: 220, 24: 440 })

  const mppt10020 = CATALOG_RECORDS.find(record => record.id === 'victron-smartsolar-100-20')
  assert.equal(mppt10020.pvVoc, 100)
  assert.deepEqual(mppt10020.supportedBatteryVoltages, [12, 24, 48])
  assert.deepEqual(mppt10020.continuousLoadCurrentAByBatteryVoltage, { 12: 20, 24: 20, 48: 1 })
  assert.deepEqual(mppt10020.nominalPvPowerWByBatteryVoltage, { 12: 290, 24: 580, 48: 1160 })

  const mppt10050 = CATALOG_RECORDS.find(record => record.id === 'victron-smartsolar-100-50')
  assert.equal(mppt10050.current, 50)
  assert.equal(mppt10050.maxPvShortCircuitCurrentA, 60)
})

test('breaker catalogue ratings apply to the simulator protection threshold', () => {
  const breaker = CATALOG_RECORDS.find(record => record.id === 'blue-sea-285-7184-60a')
  assert.equal(breaker.kind, 'fuse')
  assert.equal(breaker.current, 60)
  assert.equal(breaker.maxVoltageDC, 48)
  assert.equal(breaker.maxInterruptCurrentA, 3000)
  assert.deepEqual(breaker.terminalLayout.map(terminal => [terminal.id, terminal.x, terminal.y]), [
    ['terminal-b', 126, 20],
    ['terminal-a', 44, 96],
  ])
  const applied = applyRecordToNode({ id: 'breaker', kind: 'fuse', name: 'Generic breaker', x: 0, y: 0, watts: 10 }, breaker)
  assert.equal(applied.currentLimitA, 60)
  assert.equal(applied.watts, 10)
})

test('Renogy Rover Li record uses its documented PV ratings and bottom-terminal order', () => {
  const rover = CATALOG_RECORDS.find(record => record.id === 'renogy-rover-li-40a')
  assert.equal(rover.pvVoc, 100)
  assert.equal(rover.current, 40)
  assert.deepEqual(rover.supportedBatteryVoltages, [12, 24])
  assert.deepEqual(rover.nominalPvPowerWByBatteryVoltage, { 12: 520, 24: 1040 })
  assert.deepEqual(rover.terminalLayout.map(terminal => terminal.id), ['pv+', 'pv-', 'bat+', 'bat-', 'load+', 'load-'])
  assert.equal(rover.maxPvShortCircuitCurrentA, undefined)
})

test('EPEVER Tracer AN G3 variants keep their model-specific PV limits and charging power', () => {
  const tracer1206 = CATALOG_RECORDS.find(record => record.id === 'epever-tracer1206an-g3')
  assert.equal(tracer1206.current, 10)
  assert.equal(tracer1206.pvVoc, 60)
  assert.deepEqual(tracer1206.nominalPvPowerWByBatteryVoltage, { 12: 130, 24: 260 })

  const tracer4210 = CATALOG_RECORDS.find(record => record.id === 'epever-tracer4210an-g3')
  assert.equal(tracer4210.current, 40)
  assert.equal(tracer4210.pvVoc, 100)
  assert.deepEqual(tracer4210.nominalPvPowerWByBatteryVoltage, { 12: 520, 24: 1040 })
  assert.deepEqual(tracer4210.terminalLayout.map(terminal => terminal.id), ['pv+', 'pv-', 'bat+', 'bat-', 'load+', 'load-'])
})

test('BlueSolar module records retain exact STC ratings and connector type', () => {
  const module175 = CATALOG_RECORDS.find(record => record.id === 'victron-bluesolar-175w-12v')
  assert.equal(module175.productModel, 'SPM041751200')
  assert.deepEqual([module175.power, module175.moduleVoc, module175.moduleVmp, module175.moduleIsc, module175.moduleImp], [175, 23.7, 18.5, 9.89, 9.03])
  assert.match(module175.connectorType, /MC4/)

  const module215 = CATALOG_RECORDS.find(record => record.id === 'victron-bluesolar-215w-24v')
  assert.equal(module215.productModel, 'SPM042151200')
  assert.deepEqual([module215.power, module215.moduleVoc, module215.moduleVmp, module215.moduleIsc, module215.moduleImp], [215, 30.11, 24.11, 9.91, 9.41])
})

test('Phoenix 12/1200 inverter record keeps DC/AC ratings and terminal domains explicit', () => {
  const inverter = CATALOG_RECORDS.find(record => record.id === 'victron-phoenix-12-1200-230v')
  assert.equal(inverter.voltage, 12)
  assert.equal(inverter.power, 1000)
  assert.equal(inverter.surge, 2200)
  assert.equal(inverter.acVoltage, 230)
  assert.equal(inverter.acFrequency, 50)
  assert.deepEqual(inverter.terminalLayout.map(terminal => terminal.domain), ['dc', 'dc', 'ac', 'ac', 'earth'])
})

test('brand color swatches use valid source-backed color values', () => {
  const verified = CATALOG_RECORDS.filter(record => record.status === 'verified')
  assert.ok(verified.every(record => /^#[\da-f]{6}$/i.test(record.brandColors.primary)))
  assert.ok(verified.every(record => /^#[\da-f]{6}$/i.test(record.brandColors.secondary)))
  assert.ok(verified.every(record => record.brandColorsSource.startsWith('https://')))
})

test('in-progress records stay visible but cannot be applied to simulation nodes', () => {
  const candidate = CATALOG_RECORDS.find(record => record.id === 'victron-smartsolar-150-60')
  assert.equal(candidate.status, 'partially verified')
  assert.ok(candidate.missingData.includes('Exact electrical ratings'))
  assert.throws(() => applyRecordToNode({ id: 'mppt', kind: 'mppt', name: 'Generic MPPT', x: 0, y: 0 }, candidate), /not fully verified/)
})

test('interface matching is explicit and nominal voltage checks stay bounded', () => {
  const mppt = CATALOG_RECORDS.find(record => record.id === 'victron-smartsolar-100-30')
  assert.equal(checkInterface(mppt, 'VE.Direct'), 'pass')
  assert.equal(checkInterface(mppt, 'VE.Bus'), 'fail')
  assert.equal(checkNominalVoltage(12.8, 12), 'pass')
  assert.equal(checkNominalVoltage(24, 12), 'fail')
  assert.equal(checkNominalVoltage(undefined, 48), 'needs verification')
})

test('model matching respects documented multi-voltage controller support', () => {
  const mppt10020 = CATALOG_RECORDS.find(record => record.id === 'victron-smartsolar-100-20')
  const mppt7515 = CATALOG_RECORDS.find(record => record.id === 'victron-smartsolar-75-15')
  assert.equal(compareRecord(mppt10020, { id: 'a', kind: 'mppt', name: '48 V system', x: 0, y: 0, voltage: 48 }).checks[0].status, 'pass')
  assert.equal(compareRecord(mppt7515, { id: 'b', kind: 'mppt', name: '48 V system', x: 0, y: 0, voltage: 48 }).checks[0].status, 'fail')
})

test('custom catalogue records remain visibly separate from verified product data', () => {
  const previous = globalThis.localStorage
  const storage = new Map()
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  const record = saveCustomRecord({ id: 'custom-test', name: 'My Test Inverter', family: 'Custom', kind: 'inverter' })
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

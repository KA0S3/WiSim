import test from 'node:test'
import assert from 'node:assert/strict'
import {blankProject, makeDevice} from '../src/workbench/model.ts'
import {parseWeather, replayWeather, weatherHeader} from '../src/workbench/weather-replay.ts'

const weather = rows => parseWeather([weatherHeader,...rows].join('\n'))

test('hourly island replay preserves reserve, measures missing demand and records the outage interval',()=>{
  const p=blankProject()
  p.initialSoc=100
  const battery=makeDevice('battery',0,0), load=makeDevice('load',0,0)
  battery.spec.voltage=10; battery.spec.capacityAh=100; load.spec.watts=1000
  load.schedule={startHour:23.5,endHour:2}
  p.devices=[battery,load]
  const result=replayWeather(p,weather(['2026-01-01T23:00,0,0','2026-01-02T00:00,0,0','2026-01-02T01:00,0,0']),25,1)
  assert.deepEqual(result.rows.map(h=>h.stored),[.5,.25,.25])
  assert.deepEqual(result.rows.map(h=>h.unserved),[0,.75,1])
  assert.equal(result.rows[1].unmetLoads[0].unserved,.75)
  assert.equal(result.worstOutage.unserved,1.75)
  assert.equal(result.worstOutage.hours,3)
})

test('solar energy is clipped when full and a charger respects AC availability',()=>{
  const p=blankProject(),panel=makeDevice('pv',0,0), load=makeDevice('load',0,0),charger=makeDevice('charger',0,0)
  panel.spec.watts=2000;load.spec.watts=500;charger.spec.chargeVoltage=20;charger.spec.rating=10
  p.devices=[panel,load,charger]
  const r=replayWeather(p,weather(['2026-01-01T00:00,1000,0','2026-01-01T01:00,0,1']),0,.75)
  assert.equal(r.rows[0].curtailed,1)
  assert.equal(r.rows[1].external,.2)
  assert.equal(r.rows[1].unserved,.3)
  assert.throws(()=>weather(['2026-02-30T00:00,0,0']))
  assert.throws(()=>weather(['2026-02-01T00:00,0,0','2026-02-01T02:00,0,0']))
})

test('grid exchange closes a three-hour energy ledger and stops during an outage',()=>{
  const project=blankProject(),panel=makeDevice('pv',0,0),load=makeDevice('load',0,0)
  panel.spec.watts=2000
  load.spec.watts=500
  project.devices=[panel,load]
  const r=replayWeather(project,weather(['2026-01-01T12:00,1000,1','2026-01-01T13:00,0,1','2026-01-01T14:00,0,0']),0,.75,true)
  // 2 kW × one equivalent sun-hour × 0.75 gives 1.5 kWh.
  // Of that, the grid receives the 1.0 kWh left after the 0.5 kWh load.
  assert.deepEqual(r.rows.map(h=>h.pv),[1.5,0,0])
  assert.deepEqual(r.rows.map(h=>h.gridExport),[1,0,0])
  assert.deepEqual(r.rows.map(h=>h.gridImport),[0,.5,0])
  assert.deepEqual(r.rows.map(h=>h.unserved),[0,0,.5])
  assert.deepEqual(r.rows.map(h=>h.stateOfChargePercent),[null,null,null])
  assert.equal(r.worstOutage.unserved,.5)
  for(const row of r.rows)assert.equal(row.pv+row.external+row.gridImport+row.unserved,row.demand+row.gridExport+row.curtailed)
})

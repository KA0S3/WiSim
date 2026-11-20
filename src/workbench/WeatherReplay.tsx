import {useMemo, useState} from 'react'
import {download} from './exports'
import type {Project} from './model'
import {parseWeather, replayWeather, weatherHeader, type WeatherHour} from './weather-replay'

const assumptions = 'Hourly energy balance across enabled equipment. PV delivery factor includes conversion losses. AC input supplies the configured charger output. Storage has ideal charge/discharge efficiency and no current limit. Unserved energy is shared in proportion to hourly appliance demand. Wiring, trips and startup surges require a live circuit check.'

export function WeatherReplay({project}: {project:Project}) {
  const [weather,setWeather]=useState<{source:string;hours:WeatherHour[]}>()
  const [reserve,setReserve]=useState(20)
  const [factor,setFactor]=useState(85)
  const [gridExchange,setGridExchange]=useState(false)
  const [error,setError]=useState('')
  const [index,setIndex]=useState(0)
  const result=useMemo(()=>weather ? replayWeather(project,weather.hours,reserve,factor/100,gridExchange) : null,[project,weather,reserve,factor,gridExchange])
  const hour=result?.rows[index]
  return <details className="engineering-group"><summary>Hourly weather and outage replay</summary>
    <p>Import hourly irradiance on the panel plane and AC input availability. Use local standard time throughout.</p>
    <button onClick={()=>download('example-weather.csv',weatherHeader+'\n2026-01-01T12:00,800,1\n2026-01-01T13:00,400,0\n2026-01-01T14:00,0,0','text/csv')}>Download example CSV</button>
    <label className="field">Hourly weather CSV<input type="file" accept=".csv" onChange={async e=>{
      const file=e.target.files?.[0];if(!file)return
      try {const hours=parseWeather(await file.text());setIndex(0);setWeather({source:file.name,hours});setError('')}
      catch(cause){setWeather(undefined);setError(cause instanceof Error?cause.message:'Invalid CSV.')}
    }}/></label>
    <label className="field">Minimum battery reserve (%)<input type="range" min="0" max="100" value={reserve} onChange={e=>setReserve(+e.target.value)}/><output>{reserve}%</output></label>
    <label className="field">PV delivery (%)<input type="range" min="0" max="100" value={factor} onChange={e=>setFactor(+e.target.value)}/><output>{factor}%</output></label>
    <label><input type="checkbox" checked={gridExchange} onChange={e=>setGridExchange(e.target.checked)}/> Model grid import and export when AC is available</label>
    {error&&<p role="alert">{error}</p>}
    {result&&hour&&weather&&<section><p>{weather.source} · {result.rows.length} hours · {weather.hours[0].time} to {weather.hours.at(-1)?.time}</p>
      <p>{result.rows.reduce((sum,h)=>sum+h.unserved,0).toFixed(2)} kWh unserved · {result.rows.reduce((sum,h)=>sum+h.curtailed,0).toFixed(2)} kWh curtailed</p>
      {result.worstOutage&&<p>Worst outage from {result.worstOutage.start} through {result.worstOutage.end}, with {result.worstOutage.unserved.toFixed(2)} kWh unserved.</p>}
      <label className="field">Replay hour<input type="range" min="0" max={result.rows.length-1} value={index} onChange={e=>setIndex(+e.target.value)}/></label>
      <p>{hour.time} · {hour.stored.toFixed(2)} kWh stored of {result.capacity.toFixed(2)} kWh{hour.stateOfChargePercent!==null&&' ('+hour.stateOfChargePercent.toFixed(1)+'%)'} · {hour.pv.toFixed(2)} kWh solar · {hour.demand.toFixed(2)} kWh demand</p>
      {gridExchange&&<p>{hour.gridImport.toFixed(2)} kWh imported for loads · {hour.gridExport.toFixed(2)} kWh exported</p>}
      {hour.unmetLoads.map(d=><p key={d.reference}>{d.name} · {d.unserved.toFixed(2)} kWh unserved</p>)}
      <p>{assumptions}</p>
      <button onClick={()=>download('wisim-hourly-replay.json',JSON.stringify({source:weather.source,project:project.name,initialSoc:project.initialSoc,reservePercent:reserve,pvDeliveryPercent:factor,gridExchange,assumptions,...result},null,2))}>Export replay results</button>
    </section>}
  </details>
}

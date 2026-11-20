import {activeAt} from './appliances'
import type {Device, Project} from './model'

export const weatherHeader = 'local_hour,poa_w_m2,ac_input_available'
export type WeatherHour = {time: string; hour: number; irradiance: number; acAvailable: boolean}

export function parseWeather(csv: string): WeatherHour[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/)
  if (header.trim() !== weatherHeader || !lines.length) throw Error('Expected ' + weatherHeader + ' followed by hourly rows.')
  let previous: number | undefined
  return lines.map((line, index) => {
    const fields = line.split(',').map(field => field.trim())
    const [time, radiation, input] = fields
    const stamp = Date.parse(time + ':00Z')
    if (fields.length !== 3 || !/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(time) || !Number.isFinite(stamp) ||
        new Date(stamp).toISOString().slice(0,16) !== time || (previous !== undefined && stamp !== previous + 3600000) ||
        !radiation || !Number.isFinite(Number(radiation)) || Number(radiation) < 0 || !['0','1'].includes(input)) {
      throw Error('Check CSV row ' + (index + 2) + '. Use consecutive local standard-time hours, nonnegative irradiance and 0 or 1 for AC availability.')
    }
    previous = stamp
    return {time, hour: new Date(stamp).getUTCHours(), irradiance: Number(radiation), acAvailable: input === '1'}
  })
}

function scheduledHours(d: Device, hour: number) {
  if (!d.schedule) return 1
  const {startHour, endHour} = d.schedule
  const bounds = [hour, ...[startHour, endHour].filter(t => t > hour && t < hour + 1).sort((a,b)=>a-b), hour+1]
  return bounds.slice(1).reduce((sum,end,i) => sum + (activeAt(startHour,endHour,(end+bounds[i])/2) ? end-bounds[i] : 0),0)
}

export function replayWeather(project: Project, hours: WeatherHour[], reservePercent: number, pvFactor: number, gridExchange = false) {
  if (!hours.length || !Number.isFinite(reservePercent) || reservePercent<0 || reservePercent>100 || !Number.isFinite(pvFactor) || pvFactor<0 || pvFactor>1) throw Error('Choose valid reserve and PV delivery percentages.')
  const enabled = project.devices.filter(d=>d.on)
  const capacity = enabled.filter(d=>d.kind==='battery').reduce((sum,d)=>sum+d.spec.capacityAh*d.spec.voltage/1000,0)
  const pvKw = enabled.filter(d=>d.kind==='pv').reduce((sum,d)=>sum+d.spec.watts/1000,0)
  const chargers = enabled.filter(d=>d.kind==='charger').reduce((sum,d)=>sum+d.spec.rating*(d.spec.chargeVoltage??d.spec.voltage)/1000,0)
  const loads = enabled.filter(d=>['load','dc-load','motor'].includes(d.kind))
  let stored = capacity*project.initialSoc/100
  const reserve = capacity*reservePercent/100
  let outage: {start:string; end:string; hours:number; unserved:number} | undefined
  let worst: typeof outage
  const rows = hours.map(h => {
    const appliances = loads.map(d=>({reference:d.reference??d.id,name:d.name,kWh:d.spec.watts/1000*scheduledHours(d,h.hour)}))
    const demand = appliances.reduce((sum,d)=>sum+d.kWh,0)
    const pv = pvKw*h.irradiance/1000*pvFactor
    const external = h.acAvailable ? Math.min(chargers,Math.max(0,demand+capacity-stored-pv)) : 0
    const net = pv+external-demand
    const delta = net>=0 ? Math.min(capacity-stored,net) : -Math.min(Math.max(0,stored-reserve),-net)
    stored += delta
    const deficit = Math.max(0,delta-net), surplus = Math.max(0,net-delta)
    const canExchange = gridExchange && h.acAvailable
    const gridImport = canExchange ? deficit : 0, gridExport = canExchange ? surplus : 0
    const unserved = deficit-gridImport, curtailed = surplus-gridExport
    if (!h.acAvailable) {
      outage ??= {start:h.time,end:h.time,hours:0,unserved:0}
      outage.end=h.time; outage.hours++; outage.unserved+=unserved
      if (!worst || outage.unserved>worst.unserved || (outage.unserved===worst.unserved && outage.hours>worst.hours)) worst={...outage}
    } else outage=undefined
    const unmetLoads = unserved && demand ? appliances.filter(d=>d.kWh>0).map(d=>({...d,unserved:d.kWh/demand*unserved})) : []
    return {time:h.time, unmetLoads, irradiance:h.irradiance, acAvailable:h.acAvailable, demand,pv,external,stored,stateOfChargePercent:capacity ? 100*stored/capacity : null,gridImport,gridExport,unserved,curtailed}
  })
  return {rows,capacity,pvKw,chargerKw:chargers,worstOutage:worst}
}

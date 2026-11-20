import {simulationReady} from './catalog-readiness'
import { CATALOG_RECORDS, type CatalogRecord } from '../catalog'
import { applyCatalogRecord } from './catalog-device'
import { makeDevice, type Requirements, type Spec } from './model'
import { pvIscAtTemperature, pvVocAtTemperature } from './pv-ratings'

export type ArrayOption = {
  id: string; panel: CatalogRecord; controller: CatalogRecord; series: number; strings: number; controllers: number;
  stringsPerController: number[]; modules: number; power: number; area: number; coldVoc: number; hotVmp: number; stringIsc: number; chargeCurrent: number
}

export function stringSizing(spec:Spec, controller:CatalogRecord, series:number, cold:number, hot:number) {
  const coldVoc = pvVocAtTemperature(spec,cold)*series
  // Estimate hot Vmp from the published Pmax and Isc temperature coefficients.
  const hotVmp = series*spec.voltage*(1+(spec.powerTemperatureCoefficientPerC??0)*(hot-25))/(1+(spec.iscTemperatureCoefficientPerC??0)*(hot-25))
  const stringIsc = pvIscAtTemperature(spec,hot)
  const stringWatts = spec.watts*series
  const maxVoc = Math.min(controller.pvVoc!,controller.pvMaxOperatingVoltage!)
  const startup = 57.6+controller.pvStartHeadroomV!
  const tracking = 57.6+controller.pvRunHeadroomV!
  const inputCurrent = controller.maxPvShortCircuitCurrentA!
  const inputPower = controller.nominalPvPowerWByBatteryVoltage!['48']
  const chargeCurrent = controller.chargeCurrent!
  const estimatedChargeCurrent = stringWatts*(controller.maximumEfficiencyPercent??96)/4400
  const maxStrings = Math.floor(Math.min(inputCurrent/(stringIsc*1.25),inputPower/stringWatts,chargeCurrent/estimatedChargeCurrent))
  return {coldVoc,hotVmp,stringIsc,stringWatts,maxVoc,startup,tracking,inputCurrent,inputPower,chargeCurrent,estimatedChargeCurrent,maxStrings}
}

export function arrayOptions(r: Requirements): ArrayOption[] {
  const cold = r.coldTemperature ?? -10, hot = r.hotTemperature ?? 70
  if (!Number.isFinite(cold) || !Number.isFinite(hot) || cold < -40 || hot > 85 || cold > 25 || hot < 25 || cold > hot) throw new Error('Use cold module temperature from −40 to 25 °C and hot module temperature from 25 to 85 °C.')
  if (r.maxPanelArea !== undefined && (!Number.isFinite(r.maxPanelArea) || r.maxPanelArea <= 0)) throw new Error('Available panel area must be positive.')
  for(const count of [r.panelCount,r.stringCount])if(count!==undefined&&(!Number.isSafeInteger(count)||count<1||count>400))throw new Error('Panel and string counts must be whole numbers from 1 to 400.')
  if(r.panelWatts!==undefined&&(!Number.isFinite(r.panelWatts)||r.panelWatts<=0))throw new Error('Panel strength must be positive.')
  const target = r.dailyKwh * 1000 / (r.sunHours * .78) * (1 + r.reserve / 100 + (r.priority === 'headroom' ? .2 : 0))
  const panels = CATALOG_RECORDS.filter(record => simulationReady(record) && record.kind === 'pv' && (r.panelWatts===undefined||record.power===r.panelWatts) && (!r.panelId || r.panelId === record.id))
  const controllers = CATALOG_RECORDS.filter(record => simulationReady(record) && record.kind === 'mppt' && record.supportedBatteryVoltages?.includes(48) && record.maxPvShortCircuitCurrentA && record.pvMaxOperatingVoltage && record.pvStartHeadroomV && record.pvRunHeadroomV)
  const options: ArrayOption[] = []
  for (const panel of panels) {
    const device = applyCatalogRecord(makeDevice('pv', 0, 0), panel), spec = device.spec
    if (!spec.vocTemperatureCoefficientPerC || !spec.powerTemperatureCoefficientPerC || spec.iscTemperatureCoefficientPerC === undefined) continue
    for (const controller of controllers) for (let series = 1; series <= 20; series++) {
      const sizing = stringSizing(spec,controller,series,cold,hot)
      const {coldVoc,hotVmp,stringIsc,stringWatts:stringPower,maxStrings}=sizing
      if (coldVoc>=sizing.maxVoc || hotVmp<=sizing.tracking || coldVoc<=sizing.startup) continue
      if (maxStrings < 1) continue
      const strings = r.stringCount ?? (r.panelCount !== undefined ? r.panelCount / series : Math.max(1, Math.ceil(target / stringPower))), count = Math.ceil(strings / maxStrings), modules = series * strings
      if (!Number.isSafeInteger(strings) || strings < 1 || r.panelCount !== undefined && modules !== r.panelCount || modules * spec.watts < target) continue
      if (modules > 400 || count > 25) continue
      const area = modules * spec.width * spec.height
      if (r.maxPanelArea !== undefined && area > r.maxPanelArea) continue
      const stringsPerController = Array.from({ length: count }, (_, i) => Math.min(maxStrings, strings - i * maxStrings))
      options.push({ id: `${panel.id}:${controller.id}:${series}:${strings}`, panel, controller, series, strings, controllers: count, stringsPerController, modules, power: modules * spec.watts, area, coldVoc, hotVmp, stringIsc, chargeCurrent: count * controller.chargeCurrent! })
    }
  }
  return options.sort((a, b) => a.modules + a.controllers * 3 - b.modules - b.controllers * 3 || a.power - b.power || a.area - b.area || a.controller.chargeCurrent! - b.controller.chargeCurrent! || a.id.localeCompare(b.id))
}

export function selectArray(r: Requirements): ArrayOption {
  const options = arrayOptions(r)
  const chosen = r.arrayOptionId ? options.find(option => option.id === r.arrayOptionId) : options[0]
  if (!chosen) throw new Error('No sourced panel/string/controller combination meets the energy, temperature, current, power and space constraints. Review panel choice, temperatures, available area or demand.')
  return chosen
}

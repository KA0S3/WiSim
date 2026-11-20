import {StringPreflight} from './StringPreflight'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CircleHelp, Plus, Sparkles, Trash2 } from 'lucide-react'
import { CATALOG_RECORDS } from '../catalog'
import { uid, type Appliance, type Requirements } from './model'
import { arrayOptions } from './design-options'
import { resolvedRequirements, scheduleDemand } from './appliances'
import { NumberField } from './NumberField'
import {BuildingEditor} from './BuildingEditor'
import {defaultBuilding} from './building-plan'
import {designGuidance} from './design-guidance'
import {randomDemoRequirements} from './demo-design'

export function SystemDesigner({ requirements: r, onChange, onDesign, error, children }: { requirements: Requirements; onChange: (requirements: Requirements) => void; onDesign: () => void | Promise<void>; error: string; children?: React.ReactNode }) {
  const [usageUnit,setUsageUnit]=useState<'watts'|'units'>('watts'),[peakHours,setPeakHours]=useState(1),[demoFilled,setDemoFilled]=useState(false)
  const [randomizeACInput,setRandomizeACInput]=useState(true)
  const errorPanel=useRef<HTMLDivElement>(null)
  useEffect(()=>{if(error)errorPanel.current?.scrollIntoView({behavior:'smooth',block:'center'})},[error])
  const guidance=useMemo(()=>designGuidance(r,error),[r,error])
  const [generating,setGenerating]=useState(false),pending=useRef(false)
  const generate=async()=>{
    if(pending.current)return
    pending.current=true;setGenerating(true)
    try{await new Promise(resolve=>setTimeout(resolve,0));await onDesign()}
    finally{pending.current=false;setGenerating(false)}
  }
  const change = (patch: Partial<Requirements>) => onChange({ ...r, ...patch, arrayOptionId: patch.arrayOptionId })
  const preview = useMemo(() => {
    try {
      const requirements = resolvedRequirements(r)
      return { options: arrayOptions(requirements), demand: r.appliances?.length ? scheduleDemand(r.appliances) : null, error: '' }
    } catch (cause) { return { options: [], demand: null, error: cause instanceof Error ? cause.message : String(cause) } }
  }, [r])
  const updateAppliance = (id: string, patch: Partial<Appliance>) => change({ appliances: r.appliances?.map(item => item.id === id ? { ...item, ...patch } : item) })
  return <>
    <div className="design-intro"><span className="design-icon"><Sparkles size={24}/></span><p className="eyebrow">FROM AN IDEA TO A CONNECTED SYSTEM</p><h2>Tell us what you need.</h2><p>Size your system, compare solar layouts and place the connected equipment.</p></div>
    <div className="design-fields">
      <label className="field"><span>AC input</span><select aria-label="AC input" aria-describedby="ac-input-description" value={r.acInput ?? 'none'} onChange={event => onChange({...r,acInput:event.target.value as Requirements['acInput']})}><option value="none">No AC input</option><option value="shore">Grid / shore power</option><option value="generator">Portable generator</option></select></label>
      <label className="building-enable"><input type="checkbox" checked={randomizeACInput} onChange={event=>setRandomizeACInput(event.target.checked)}/>Randomize AC input for demo systems</label>
    </div>
    <p id="ac-input-description" className="usage-explanation">Grid / shore power and the generator feed a dedicated battery charger. The inverter continues to supply the loads.</p>
    <button className="secondary-button demo-design-button" disabled={generating} onClick={()=>{onChange(randomDemoRequirements(Math.random,randomizeACInput?undefined:r.acInput??'none'));setDemoFilled(true)}}><Sparkles size={16}/>Random demo house and system</button>
    {demoFilled&&<p className="demo-design-note" role="status">Fresh demo ready with {r.building?.floors.length} floor(s), connected stairs and a matching energy brief. Click Generate my system to watch it build.</p>}
    {guidance&&<div ref={errorPanel} className="design-guidance" role="alert"><strong>Check your design</strong><p>{guidance.message}</p>{guidance.fixes.map(fix=><div key={fix.label}><button className="secondary-button" onClick={()=>onChange({...r,...fix.patch})}>{fix.label}</button><p>{fix.detail}</p></div>)}</div>}
    <div className="design-context">{(['home', 'mobile', 'workshop'] as const).map(context => <button className={r.context === context ? 'active' : ''} key={context} onClick={() => change({ context })}>{context[0].toUpperCase() + context.slice(1)}</button>)}</div>
    <div className="design-fields">
      <label className="field"><span>Installation region</span><select value={r.region} onChange={event => change({ region: event.target.value as Requirements['region'] })}><option value="ZA">South Africa · 230 V / 50 Hz</option><option value="GB">United Kingdom · 230 V / 50 Hz</option><option value="US">United States · 120 V / 60 Hz</option></select></label>
      <label className="field"><span>Output phases</span><select aria-label="Output phases" value={r.phases} onChange={event => change({ phases: event.target.value as Requirements['phases'] })}><option value="single">Single phase</option><option value="split">Split phase · US 120/240 V</option><option value="three">Three phase · 120° separation</option></select></label>
      <label className="field"><span>Design priority</span><select value={r.priority} onChange={event => change({ priority: event.target.value as Requirements['priority'] })}><option value="cost">Minimum equipment meeting demand</option><option value="headroom">Extra capacity for expansion</option></select></label>
      {!r.appliances?.length && <><label className="field"><span>Usage input units</span><select aria-label="Usage input units" value={usageUnit} onChange={e=>setUsageUnit(e.target.value as 'watts'|'units')}><option value="watts">Watts (power)</option><option value="units">Electricity units (kWh)</option></select></label>{usageUnit==='watts'?<><NumberField label="Average power usage" unit="W over 24 hours" value={Number((r.dailyKwh*1000/24).toFixed(2))} min={.01} onChange={watts=>change({dailyKwh:watts*24/1000})}/><NumberField label="Peak power usage" unit="W at the busiest time" value={r.peakW} min={1} onChange={peakW=>change({peakW})}/></>:<><NumberField label="Daily energy use" unit="units/day" value={r.dailyKwh} min={.01} onChange={dailyKwh=>change({dailyKwh})}/><NumberField label="Peak usage duration" unit="hours" value={peakHours} min={.01} max={24} onChange={setPeakHours}/><NumberField label="Peak energy use" unit="units in this period" value={Number((r.peakW*peakHours/1000).toFixed(4))} min={.0001} onChange={units=>change({peakW:units*1000/peakHours})}/></>}</>}
      <NumberField label="Battery autonomy" unit="hours" value={r.autonomyHours} min={.1} onChange={autonomyHours => change({ autonomyHours })}/>
      <NumberField label="Equivalent peak sun" unit="h/day" value={r.sunHours} min={.1} onChange={sunHours => change({ sunHours })}/>
      <NumberField label="Battery cable route, one way" unit="m" value={r.cableLength} onClear={()=>change({cableLength:undefined})} optional min={.1} onChange={cableLength => change({ cableLength })}/>
      <NumberField label="Capacity reserve" unit="%" value={r.reserve} onChange={reserve => change({ reserve })}/>
    </div>
    <p className="usage-explanation">1 electricity unit = 1 kWh. Average usage is spread across 24 hours. Peak usage is the power needed when the most equipment runs together.</p><p className="design-demand">{(preview.demand?.dailyKwh??r.dailyKwh).toFixed(2)} units/day / average {((preview.demand?.dailyKwh??r.dailyKwh)*1000/24).toFixed(0)} W / peak {(preview.demand?.peakW??r.peakW).toFixed(0)} W</p>
    <details className="detail-fold appliance-designer"><summary>Appliance schedules and startup</summary>
      <p>Daily time blocks replace the aggregate energy and demand inputs. Overnight blocks are supported. Matching start/end means all day. Startup is simultaneous for appliances starting together.</p>
      {r.appliances?.map(item => <fieldset key={item.id} className="appliance-row"><legend>{item.name}</legend>
        <label className="field"><span>Appliance name</span><input aria-label={`Appliance name ${item.id}`} value={item.name} onChange={event => updateAppliance(item.id, { name: event.target.value })}/></label>
        <NumberField label={`${item.name} power`} unit="W each" value={item.watts} min={1} onChange={watts => updateAppliance(item.id, { watts })}/>
        <NumberField label={`${item.name} quantity`} unit="units" value={item.quantity} min={1} onChange={quantity => updateAppliance(item.id, { quantity })}/>
        <NumberField label={`${item.name} start hour`} unit="0–23" value={item.startHour} max={23.99} onChange={startHour => updateAppliance(item.id, { startHour })}/>
        <NumberField label={`${item.name} end hour`} unit="0–24" value={item.endHour} max={24} onChange={endHour => updateAppliance(item.id, { endHour })}/>
        <NumberField label={`${item.name} startup multiplier`} unit="×" value={item.startupMultiplier} min={1} onChange={startupMultiplier => updateAppliance(item.id, { startupMultiplier })}/>
        <NumberField label={`${item.name} startup duration`} unit="s" value={item.startupSeconds} onChange={startupSeconds => updateAppliance(item.id, { startupSeconds })}/>
        <label className="field"><span>Phase assignment</span><select aria-label={`${item.name} phase`} value={item.phase} onChange={event => updateAppliance(item.id, { phase: event.target.value as Appliance['phase'] })}>{['auto', 'A', 'B', 'C'].map(phase => <option key={phase} value={phase}>{phase === 'auto' ? 'Automatic balance' : `Phase ${phase}`}</option>)}</select></label>
        <button className="secondary-button" aria-label={`Remove ${item.name} schedule`} onClick={() => change({ appliances: r.appliances?.filter(other => other.id !== item.id) })}><Trash2 size={14}/>Remove appliance</button>
      </fieldset>)}
      <button className="secondary-button" onClick={() => change({ appliances: [...(r.appliances ?? []), { id: uid('appliance'), name: `Appliance ${(r.appliances?.length ?? 0) + 1}`, watts: 200, quantity: 1, startHour: 8, endHour: 18, startupMultiplier: 1, startupSeconds: 0, phase: 'auto' }] })}><Plus size={15}/>Add appliance</button>
      {preview.demand && <p className="design-demand" role="status">{preview.demand.dailyKwh.toFixed(2)} kWh/day · {preview.demand.peakW.toFixed(0)} W running · {preview.demand.startupW.toFixed(0)} W startup</p>}
    </details>
    <details className="detail-fold" open><summary>Solar layout alternatives</summary>
      <div className="design-fields"><NumberField label="Panel strength (blank = compare models)" unit="W per panel" value={r.panelWatts} onClear={()=>change({panelWatts:undefined})} optional min={1} onChange={panelWatts=>change({panelWatts,panelId:undefined})}/><NumberField label="Number of panels (blank = automatic)" unit="panels" value={r.panelCount} onClear={()=>change({panelCount:undefined})} optional min={1} max={400} onChange={panelCount=>change({panelCount})}/><NumberField label="Number of strings (blank = automatic)" unit="strings" value={r.stringCount} onClear={()=>change({stringCount:undefined})} optional min={1} max={400} onChange={stringCount=>change({stringCount})}/><NumberField label="Coldest module temperature" unit="°C" value={r.coldTemperature ?? -10} min={-40} max={25} onChange={coldTemperature => change({ coldTemperature })}/><NumberField label="Hottest module temperature" unit="°C" value={r.hotTemperature ?? 70} min={25} max={85} onChange={hotTemperature => change({ hotTemperature })}/>
        <label className="field"><span>Panel model</span><select aria-label="Designer panel model" value={r.panelId ?? ''} onChange={event => change({ panelId: event.target.value || undefined })}><option value="">Compare sourced models</option>{CATALOG_RECORDS.filter(record => record.kind === 'pv' && record.status === 'verified').map(record => <option key={record.id} value={record.id}>{record.name} / {record.power} W</option>)}</select></label>
        <label className="field"><span>Panel area constraint</span><select aria-label="Panel area constraint" value={r.maxPanelArea === undefined ? 'none' : 'limited'} onChange={event => change({ maxPanelArea: event.target.value === 'none' ? undefined : 20 })}><option value="none">No area limit</option><option value="limited">Limit available panel footprint</option></select></label>
        {r.maxPanelArea !== undefined && <NumberField label="Available panel footprint" unit="m²" value={r.maxPanelArea} min={.1} onChange={maxPanelArea => change({ maxPanelArea })}/>}</div>
      <p>Ranked by module count plus three units per controller, then excess power and area. Area excludes packing gaps. Hot Vmp is estimated from temperature coefficients. Prices and annual weather yield remain separate inputs.</p>
      <details><summary>Inspect string sizing margins</summary><StringPreflight requirements={r}/></details>
      {!preview.options.length ? null : <label className="field"><span>Panel and controller layout</span><select aria-label="Panel and controller layout" value={r.arrayOptionId ?? preview.options[0]?.id} onChange={event => change({ arrayOptionId: event.target.value })}>{preview.options.map(option => <option key={option.id} value={option.id}>{option.modules} × {option.panel.power} W · {option.strings} strings × {option.series} panels · {option.controllers} × {option.controller.productModel} · {option.area.toFixed(1)} m²</option>)}</select></label>}
    </details>
    <details className="detail-fold building-fold"><summary>Design home/compartment · optional</summary><label className="building-enable"><input type="checkbox" checked={!!r.building} onChange={event=>change({building:event.target.checked?{...defaultBuilding(r.context==='mobile'),solarHemisphere:r.region==='ZA'?'south':'north'}:undefined})}/>Include a {r.context==='mobile'?'compartment':'home'} layout</label>{r.building&&<BuildingEditor equipmentChoices={r.appliances?.map(item=>({key:`appliance:${item.id}`,label:item.name}))} value={{...r.building,solarHemisphere:r.building.solarHemisphere??(r.region==='ZA'?'south':'north')}} onChange={building=>change({building})}/>}</details>
    {children}
    <div className="design-explanation"><CircleHelp size={16}/><p>Solar layouts use sourced panels and independent controller ratings. Batteries, coordinated phase outputs and protection use editable generic models. Regional rules and exact hardware are being expanded in the ordered work plan.</p></div>

    {generating&&<p role="status">Sizing equipment and routing cables…</p>}
    <button className="primary-button design-submit" disabled={generating||!!guidance&&!error} aria-busy={generating} onClick={()=>void generate()}><Sparkles size={17}/>{generating?'Generating system…':'Generate my system'}<ArrowRight size={17}/></button>
  </>
}

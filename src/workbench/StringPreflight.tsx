import {useMemo,useState} from 'react'
import {CATALOG_RECORDS} from '../catalog'
import {simulationReady} from './catalog-readiness'
import {applyCatalogRecord} from './catalog-device'
import {makeDevice,type Requirements} from './model'
import {stringSizing} from './design-options'

const panels=CATALOG_RECORDS.filter(r=>r.kind==='pv'&&simulationReady(r))
const controllers=CATALOG_RECORDS.filter(r=>r.kind==='mppt'&&simulationReady(r)&&r.supportedBatteryVoltages?.includes(48)&&r.pvStartHeadroomV&&r.pvRunHeadroomV&&r.pvMaxOperatingVoltage)

export function StringPreflight({requirements:r}:{requirements:Requirements}){
  const [panelId,setPanel]=useState(r.panelId??panels[0]?.id)
  const [controllerId,setController]=useState(controllers[0]?.id)
  const [series,setSeries]=useState(2),[parallel,setParallel]=useState(1)
  const panel=panels.find(p=>p.id===panelId)??panels[0], controller=controllers.find(c=>c.id===controllerId)
  const spec=useMemo(()=>panel&&applyCatalogRecord(makeDevice('pv',0,0),panel).spec,[panel])
  if(!spec||!controller)return <p>No sourced 48 V combination available.</p>
  const cold=r.coldTemperature??-10,hot=r.hotTemperature??70
  const sizing=stringSizing(spec,controller,series,cold,hot)
  const limits=[
    {label:'Cold open-circuit voltage',margin:sizing.maxVoc-sizing.coldVoc,unit:'V',strict:true},
    {label:'Cold startup headroom',margin:sizing.coldVoc-sizing.startup,unit:'V',strict:true},
    {label:'Hot tracking headroom',margin:sizing.hotVmp-sizing.tracking,unit:'V',strict:true},
    {label:'Short-circuit current including 25% allowance',margin:sizing.inputCurrent-parallel*1.25*sizing.stringIsc,unit:'A',strict:false},
    {label:'Nominal PV input power at 48 V',margin:sizing.inputPower-parallel*sizing.stringWatts,unit:'W',strict:false},
    {label:'Charging current at 44 V',margin:sizing.chargeCurrent-parallel*sizing.estimatedChargeCurrent,unit:'A',strict:false}
  ]
  return <section><p>Check a candidate on one 48 V controller at {cold} °C and {hot} °C. Each margin shows the remaining allowance.</p>
    <label className="field">Candidate module<select value={panel.id} onChange={e=>setPanel(e.target.value)}>{panels.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="field">Candidate controller<select value={controller.id} onChange={e=>setController(e.target.value)}>{controllers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="field">Modules per string<input type="number" min={1} max={400} value={series} onChange={e=>setSeries(Math.min(400,Math.max(1,Math.floor(+e.target.value))))}/></label>
    <label className="field">Parallel strings per controller<input type="number" min={1} max={400} value={parallel} onChange={e=>setParallel(Math.min(400,Math.max(1,Math.floor(+e.target.value))))}/></label>
    <ul>{limits.map(l=><li key={l.label}><strong>{(l.strict?l.margin>0:l.margin>=0)?'Pass':'Rejected'}</strong> · {l.label} · {l.margin.toFixed(2)} {l.unit}</li>)}</ul>
    <a href={panel.source} target="_blank" rel="noreferrer">Module reference</a> · <a href={controller.source} target="_blank" rel="noreferrer">Controller reference</a>
  </section>
}

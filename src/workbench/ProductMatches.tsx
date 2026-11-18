import type {CatalogRecord} from '../catalog'
import {useMemo,useState} from 'react'
import type {Device,Project} from './model'
import {productOptions} from './product-matching'
import {bankProductPlan,applyBankProduct} from './catalog-bank'
export function ProductMatches({device,records,project,onApply,onBankApply}:{device:Device;records:CatalogRecord[];project:Project;onApply:(r:CatalogRecord,quantity?:number)=>void;onBankApply?:(p:Project)=>void}){
 const matches=useMemo(()=>productOptions(device,records,project),[device,records,project]),[error,setError]=useState('')
 if(!['pv','battery','mppt','inverter','charger'].includes(device.kind))return null
 return <section className="product-matches"><h3>Closest catalogue matches</h3><p>Complete simulation profiles include partially verified products with labelled geometry. Compare ratings, source variants and connected-circuit warnings.</p>{error&&<p role="alert">{error}</p>}{matches.length?matches.map(({record:r,issues,differences,sufficient,suggestedQuantity})=>{
 let plan:ReturnType<typeof bankProductPlan>|undefined,bankError=''
 if(['pv','battery'].includes(device.kind)){try{plan=bankProductPlan(project,device.id,r)}catch(error){bankError=error instanceof Error?error.message:String(error)}}
 return <div key={r.id}><strong>{r.name}</strong><small>{r.status} · {r.simulation?.geometry} geometry · {sufficient?'Meets current checked unit constraints':'Ratings differ'}</small>{differences.length?<ul className="product-differences">{differences.map(d=><li key={d}>{d}</li>)}</ul>:<p>Compared ratings match your settings.</p>}{issues.length>0&&<details className="product-conflicts"><summary>Connection warnings ({issues.length})</summary>{issues.map(issue=><p key={issue}>{issue}</p>)}</details>}<button className="secondary-button" title="Apply ratings to this unit, retaining its identity and external conductors." onClick={()=>onApply(r)}>Use this product</button>
 {plan&&onBankApply&&<><p>Whole {device.kind==='battery'?'bank':'array'}: {plan.newSeries} series × {plan.parallel} parallel / {plan.units} units. Operating class {plan.voltage.toFixed(1)} → {plan.newVoltage.toFixed(1)} V. {device.kind==='battery'?`Energy ${(plan.energyWh/1000).toFixed(2)} → ${(plan.newEnergyWh/1000).toFixed(2)} kWh.`:`Panel power ${plan.watts.toFixed(0)} → ${plan.newWatts.toFixed(0)} W.`} Collector wiring/protection stays connected; review ratings, BMS and placement.</p><button className="secondary-button" onClick={()=>{try{onBankApply(applyBankProduct(project,device.id,r));setError('')}catch(error){setError(error instanceof Error?error.message:String(error))}}}>Replace whole {device.kind==='battery'?'bank':'array'} with {plan.units} units</button></>}
 {bankError&&<p className="muted small">Whole-source replacement: {bankError}</p>}
 {suggestedQuantity>1&&suggestedQuantity<=16&&(!plan||plan.units===1)&&<><p>{suggestedQuantity} parallel units can meet this unit's capacity/current or panel power. This keeps unit voltage; review protection and cable sizing.</p><button className="secondary-button" onClick={()=>onApply(r,suggestedQuantity)}>Use {suggestedQuantity} units in parallel</button></>}
 </div>}) :<p>No complete simulation profile of this equipment type is available yet.</p>}</section>
}

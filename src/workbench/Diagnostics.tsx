import {FixSuggestion} from './FixSuggestion'
import {useState} from 'react'
import type {Finding,Project} from './model'

export function diagnosticTip(f:Finding):string{
 if(f.id.startsWith('engineering-hardware-'))return 'Open Electrical engineering and select this fuse to enter sourced hardware data. Its configured generic overcurrent model is available for schematic simulation.'
 if(f.id.startsWith('engineering-protection-unassigned-'))return 'Open Electrical engineering, select this conductor, then choose Source overcurrent protection.'
 if(f.id.startsWith('engineering-'))return 'Open Electrical engineering and select the referenced equipment or conductor. Correct the inputs described above and apply the changes.'
 if(f.id.startsWith('short-'))return 'Isolate the source, then trace both terminals through closed distribution paths. Remove the unintended bridge and review protection before reconnecting.'
 if(f.id.startsWith('protection-bypass-'))return 'Trace every feed around the protection. Each energised path needs its intended isolation and protection.'
 if(f.id.startsWith('open-'))return 'Inspect the named terminals. Add the missing outgoing/return conductor, or leave the port open if that is intentional.'
 if(f.id.startsWith('drop-'))return 'Inspect both conductor runs, route length, cross-section and contact resistance. Compare voltage at the source and load.'
 if(f.id.startsWith('trip-'))return 'Use the retained current/power and connected equipment listed above to trace the overload. Reduce demand or resize the generated system, then use Reset latched trips after repair.'
 if(f.id.startsWith('overload-')||f.id.startsWith('battery-limit-'))return 'Compare running/startup demand with the configured current and power ratings. Reduce demand or revise equipment and protection.'
 if(f.id.startsWith('low-dc-'))return 'Check supply state, battery charge, polarity, disconnected returns and voltage drop before changing the cutoff.'
 if(f.id.includes('pv-')||f.id.startsWith('pv-'))return 'Review each PV string, polarity, series count, temperature assumptions and the controller input limits.'
 if(f.id==='frequency-conflict')return 'Review connected AC sources and transfer paths. Matching frequency alone does not establish synchronisation or safe paralleling.'
 return 'Inspect the referenced equipment and its connected circuit. Correct the stated mismatch and review the recalculated results.'
}
export function Diagnostics({project,findings,error,pending,onInspect,onReset,onFix,onClearTrips,status}:{onClearTrips:()=>void;project:Project;findings:Finding[];error:string;pending:boolean;onInspect:(id:string)=>void;onReset:()=>void;onFix:(p:Project)=>void;status?:string}){
 const [filter,setFilter]=useState('all'),[search,setSearch]=useState('')
 const target=(f:Finding)=>project.devices.find(d=>d.id===f.target)?.name??project.wires.find(w=>w.id===f.target)?.reference??'Whole system'
 const counts={fault:findings.filter(f=>f.severity==='fault').length+(error?1:0),warning:findings.filter(f=>f.severity==='warning').length,info:findings.filter(f=>f.severity==='info').length}
 const list=findings.filter(f=>(filter==='all'||f.severity===filter)&&`${f.title} ${f.detail} ${target(f)}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>({fault:0,warning:1,info:2}[a.severity]-{fault:0,warning:1,info:2}[b.severity]))
 return <><p className="eyebrow">UNDERSTAND YOUR SYSTEM</p><h2>System diagnostics</h2><p className="modal-intro">All current findings, with faults first. Select an item to inspect its equipment or conductor. These checks do not establish installation compliance.</p><div className="diagnostic-counts" role="status">{counts.fault} faults · {counts.warning} warnings · {counts.info} notes</div><div className="diagnostic-filters"><label>Severity<select aria-label="Diagnostic severity" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All findings</option><option value="fault">Faults</option><option value="warning">Warnings</option><option value="info">Notes</option></select></label><label>Search<input aria-label="Search diagnostics" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Equipment, cable or issue"/></label></div>
 {pending&&<p className="diagnostic-pending">{status??'Recalculating'}. Your project stays editable; live readings will follow.</p>}
 {error&&(filter==='all'||filter==='fault')&&<article className="diagnostic-item fault"><h3>Calculation needs attention</h3><p>{error}</p><p>The calculator retries automatically before pausing. Your last valid simulation state is kept; retrying does not reset battery charge or stored energy.</p><button onClick={onReset}>Retry calculation</button></article>}
 {!list.length&&!error&&<p>{pending?'Waiting for calculated findings.':'No findings match this view. This is not a certificate that the design is correct.'}</p>}
 {findings.some(f=>f.id.startsWith('trip-'))&&<p><button onClick={onClearTrips}>Reset latched trips after repair</button> <small>Clears trip latches and overload timers; keeps battery charge and simulation time.</small></p>}
 <div className="diagnostic-list">{list.map(f=><article className={`diagnostic-item ${f.severity}`} key={f.id} aria-label={`${f.severity}: ${f.title}`}><header><strong>{f.title}</strong><span>{f.severity==='info'?'Note':f.severity==='fault'?'Fault':'Warning'}</span></header><small>{target(f)}</small><p>{f.detail}</p><p className="diagnostic-tip"><b>Next step: </b>{diagnosticTip(f)}</p><FixSuggestion project={project} finding={f} onApply={onFix}/>{f.target&&<button onClick={()=>onInspect(f.target!)}>Inspect {target(f)}</button>}</article>)}</div></>
}

import {designSystem,solarProject} from './templates'
import {batteryNetwork,connectionFindings} from './connection-checks'
import {synchronizeLengths} from './geometry'
import {validateProject,type Finding,type Project} from './model'

export type SuggestedFix={label:string;detail:string;project:Project}

/** Restore a deleted supply only on the identifiable, otherwise intact solar example. */
function restoreExampleBattery(project:Project,inverterId:string):SuggestedFix|null{
 if(project.devices.some(d=>d.kind==='battery')||project.requirements)return null
 const example=solarProject()
 const battery=example.devices.find(d=>d.kind==='battery')!
 const remaining=example.devices.filter(d=>d!==battery)
 if(project.devices.length!==remaining.length)return null
 const devices=new Map<string,string>()
 for(const original of remaining){
  const matches=project.devices.filter(d=>d.name===original.name&&d.kind===original.kind)
  if(matches.length!==1)return null
  devices.set(original.id,matches[0].id)
 }
 if(devices.get(remaining.find(d=>d.kind==='inverter')!.id)!==inverterId)return null
 devices.set(battery.id,battery.id)
 const pair=(from:string,fromPort:string,to:string,toPort:string)=>[from+':'+fromPort,to+':'+toPort].sort().join('|')
 const mapWire=(w:Project['wires'][number])=>pair(devices.get(w.from)!,w.fromPort,devices.get(w.to)!,w.toPort)
 const existing=new Set(project.wires.map(w=>pair(w.from,w.fromPort,w.to,w.toPort)))
 const intact=example.wires.filter(w=>w.from!==battery.id&&w.to!==battery.id)
 if(existing.size!==intact.length||intact.some(w=>!existing.has(mapWire(w))))return null
 const restored=example.wires.filter(w=>w.from===battery.id||w.to===battery.id)
  .map(w=>({...w,from:devices.get(w.from)!,to:devices.get(w.to)!}))
 const next=synchronizeLengths({...project,devices:[...project.devices,battery],wires:[...project.wires,...restored]})
 const input=batteryNetwork(next,inverterId,'dc+','dc-')
 if((input.voltage??0)<=project.devices.find(d=>d.id===inverterId)!.spec.cutoff+2||
    !validateProject(next)||connectionFindings(next).some(f=>f.severity==='fault'))return null
 return {
  label:'Restore the example battery and connect four cables',
  detail:'Adds the example’s generic 51.2 V Home battery. Connects battery + to Battery protection IN and Solar controller BAT+, and battery − to Hybrid inverter DC− and Solar controller BAT−. Existing equipment and cables are preserved.',
  project:next
 }
}

/** Explicit one-at-a-time sandbox edits. No repair runs without the user's Apply action. */
export function suggestedFix(project:Project,finding:Finding):SuggestedFix|null{
 const known=connectionFindings(project).find(f=>f.id===finding.id),device=project.devices.find(d=>d.id===finding.target)
 if(!known){
  if(device?.kind==='inverter'&&finding.id===`low-dc-${device.id}`){
   const restoredExample=restoreExampleBattery(project,device.id)
   if(restoredExample)return restoredExample
   const supplyFaults=connectionFindings(project)
   const cause=supplyFaults.find(f=>f.target===device.id&&['bank-voltage-','bank-polarity-','bank-conflict-'].some(prefix=>f.id.startsWith(prefix)))
   if(cause)return suggestedFix(project,cause)
   const supply=batteryNetwork(project,device.id,'dc+','dc-')
   if(supply.voltage!==undefined||supply.conflict||supply.shorted)return null
   const previousFaultIds=new Set(supplyFaults.filter(f=>f.severity==='fault').map(f=>f.id))
   const fixes=project.devices.filter(d=>d.kind==='battery'&&!d.on&&!d.batteryLimits).flatMap(battery=>{
    const next={...project,devices:project.devices.map(d=>d.id===battery.id?{...d,on:true}:d)}
    const restored=batteryNetwork(next,device.id,'dc+','dc-')
    if(restored.sources.length!==1||restored.sources[0]!==battery.id||restored.conflict||restored.shorted||
       restored.voltage===undefined||restored.voltage<=device.spec.cutoff+2||
       connectionFindings(next).some(f=>f.severity==='fault'&&!previousFaultIds.has(f.id)))return []
    return [{label:`Switch on ${battery.name}`,detail:'Re-enables the one directly traceable battery supply. The solver will check the input voltage again under load.',project:next}]
   })
   return fixes.length===1?fixes[0]:null
  }
  if(device&&project.requirements&&(finding.id.startsWith('trip-')||finding.id.startsWith('overload-'))){
   try{const next=designSystem(project.requirements);return {label:'Rebuild and resize this generated system',detail:'Regenerates the system from its saved demand, startup, panel and building requirements. Manual equipment and wiring edits are replaced. Apply, then reset simulation to clear trips. Undo restores the previous design.',project:{...next,id:project.id,name:project.name}}}catch{return null}
  }
  return null
 }
 const offer=(label:string,detail:string,change:(p:Project)=>Project):SuggestedFix|null=>{
  const next=synchronizeLengths(change(structuredClone(project)))
  if(!validateProject(next)||connectionFindings(next).some(f=>f.id===finding.id))return null
  return {label,detail,project:next}
 }
 if(device&&finding.id.startsWith('short-')&&finding.severity==='fault')return offer(`Isolate ${device.name}`,`Switches off ${device.name} so this source stops energising the short. Review and repair the bypass path before reconnecting.`,p=>({...p,devices:p.devices.map(d=>d.id===device.id?{...d,on:false}:d)}))
 if(device&&finding.id.startsWith('ac-source-conflict-'))return offer(`Isolate ${device.name}`,`Switches off this AC source. Review transfer isolation and manufacturer synchronisation requirements before reconnecting.`,p=>({...p,devices:p.devices.map(d=>d.id===device.id?{...d,on:false}:d)}))
 if(device&&finding.id.startsWith('protection-bypass-')){
  const bridge=project.wires.find(w=>w.from===device.id&&w.to===device.id&&w.fromPort!==w.toPort)
  if(bridge)return offer('Remove the direct protection bridge',`Removes conductor ${bridge.reference??bridge.id} joining both sides of this protection. Review other feeds after applying.`,p=>({...p,wires:p.wires.filter(w=>w.id!==bridge.id)}))
 }
 if(finding.id.startsWith('domain-mismatch-')&&finding.severity==='fault')return offer('Remove this AC/DC crossover conductor','Removes only the highlighted conductor. This may leave open-terminal notes; all other wiring and equipment stay in place.',p=>({...p,wires:p.wires.filter(w=>w.id!==finding.target)}))
 if(device&&!known.title.includes('shorted')&&(finding.id.startsWith('bank-polarity-')||finding.id.startsWith('pv-polarity-'))&&['inverter','mppt','charger'].includes(device.kind)){
  const [positive,negative]=finding.id.startsWith('pv-')?['pv+','pv-']:device.kind==='inverter'?['dc+','dc-']:['bat+','bat-']
  const swap=(port:string)=>port===positive?negative:port===negative?positive:port
  return offer('Swap this input’s positive and negative connections','Swaps the terminal attachments at this equipment only, preserving conductor identities and routes. Recheck remaining voltage and current warnings afterwards.',p=>({...p,wires:p.wires.map(w=>({...w,fromPort:w.from===device.id?swap(w.fromPort):w.fromPort,toPort:w.to===device.id?swap(w.toPort):w.toPort}))}))
 }
 if(device&&!device.model&&finding.id.startsWith('bank-voltage-'))for(const [nominal,cutoff]of [[12,11],[24,22],[48,44]]){
  const fix=offer(`Use generic ${nominal} V inverter settings`,`Sets the generic inverter cutoff to ${cutoff} V and keeps its existing power rating. This edits a simulation assumption; it does not convert real hardware. Check current limits after applying.`,p=>({...p,devices:p.devices.map(d=>d.id===device.id?{...d,spec:{...d.spec,cutoff}}:d)}));if(fix)return fix
 }
 if(device&&!device.model&&finding.id.startsWith('pv-open-circuit-'))for(const voc of [75,100,150,250,450,600,1000]){
  if(voc<=device.spec.voc)continue
  const fix=offer(`Use a generic ${voc} V PV input limit`,'Changes only the generic controller input-voltage rating. This is an editable simulation assumption, not an upgrade or a recommendation for an actual controller.',p=>({...p,devices:p.devices.map(d=>d.id===device.id?{...d,spec:{...d.spec,voc}}:d)}));if(fix)return fix
 }
 if(finding.id.startsWith('bank-conflict-')){
  const fixes=project.devices.filter(d=>d.on&&d.kind==='battery'&&known.related.includes(d.id)).flatMap(d=>{
   const fix=offer(`Isolate ${d.name}`,`Switches this battery off to remove the conflicting source. Its wiring stays intact. Other faults may remain; review the new results before reconnecting it.`,p=>({...p,devices:p.devices.map(a=>a.id===d.id?{...a,on:false}:a)}))
   return fix&&!connectionFindings(fix.project).some(f=>f.id.startsWith('bank-conflict-'))?[fix]:[]
  })
  return fixes.sort((a,b)=>connectionFindings(a.project).length-connectionFindings(b.project).length)[0]??null
 }
 return null
}

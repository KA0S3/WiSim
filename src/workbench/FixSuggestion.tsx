import {useMemo,useState} from 'react'
import type {Finding,Project} from './model'
import {suggestedFix} from './repairs'

export function FixSuggestion({project,finding,onApply}:{project:Project;finding:Finding;onApply:(p:Project)=>void}){
 const [expanded,setExpanded]=useState(false),fix=useMemo(()=>suggestedFix(project,finding),[project,finding.id])
 if(!fix)return !project.learn&&finding.severity==='fault'?<small className="fix-suggestion muted">Manual review required. Open Explain issue for the next step.</small>:null
 const action=<div className="fix-suggestion">{!expanded?<button className="primary-button" aria-label={`Auto-fix. Preview fix for ${finding.title}`} onClick={()=>setExpanded(true)}>Auto-fix…</button>:<><strong>{fix.label}</strong><p>{fix.detail}</p><small>Undo restores the project. The simulator recalculates remaining faults.</small><div><button className="primary-button" aria-label={`Apply fix: ${fix.label}`} onClick={()=>{onApply(fix.project);setExpanded(false)}}>Apply this fix</button><button onClick={()=>setExpanded(false)}>Keep as is</button></div></>}</div>
 return project.learn?<details className="repair-spoiler"><summary>Reveal repair assistance (spoiler)</summary><p>This reveals a solution and can apply it to your training circuit.</p>{action}</details>:action
}

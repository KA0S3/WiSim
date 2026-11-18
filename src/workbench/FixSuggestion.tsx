import {useMemo,useState} from 'react'
import type {Finding,Project} from './model'
import {suggestedFix} from './repairs'

export function FixSuggestion({project,finding,onApply}:{project:Project;finding:Finding;onApply:(p:Project)=>void}){
 const [expanded,setExpanded]=useState(false),fix=useMemo(()=>suggestedFix(project,finding),[project,finding.id])
 if(project.learn||!fix)return null
 return <div className="fix-suggestion">{!expanded?<button aria-label={`Preview fix for ${finding.title}`} onClick={()=>setExpanded(true)}>Suggested fix…</button>:<><strong>{fix.label}</strong><p>{fix.detail}</p><small>Optional. Apply one change; Undo restores it. Remaining faults are recalculated.</small><div><button aria-label={`Apply fix: ${fix.label}`} onClick={()=>onApply(fix.project)}>Apply this fix</button><button onClick={()=>setExpanded(false)}>Keep as is</button></div></>}</div>
}

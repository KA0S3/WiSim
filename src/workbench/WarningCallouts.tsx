import {FixSuggestion} from './FixSuggestion'
import {useLayoutEffect,useMemo,useRef,useState} from 'react'
import {getSmoothStepPath,Position,useReactFlow,useViewport,type Node} from '@xyflow/react'
import type {Finding,Project} from './model'
import {warningLeader} from './warning-route'

export function WarningCallouts({project,displayProject=project,targetMap={},nodes,findings,onSelect,onDiagnostics,onFix}:{project:Project;displayProject?:Project;targetMap?:Record<string,string>;nodes:Node[];findings:Finding[];onSelect:(id:string|null)=>void;onDiagnostics:()=>void;onFix:(p:Project)=>void}){
 const root=useRef<HTMLElement>(null),flow=useReactFlow(),viewport=useViewport(),[tick,refresh]=useState(0),[leaders,setLeaders]=useState<{id:string;severity:string;points:{x:number;y:number}[]}[]>([])
 const groups=useMemo(()=>{
  const map=new Map<string,{id:string;target?:string;severity:'fault'|'warning';items:Finding[]}>()
  for(const f of findings.filter(f=>f.severity!=='info')){const id=f.target??'system',old=map.get(id);if(old){old.items.push(f);if(f.severity==='fault')old.severity='fault'}else map.set(id,{id,target:f.target,severity:f.severity as 'fault'|'warning',items:[f]})}
  return [...map.values()].sort((a,b)=>Number(b.severity==='fault')-Number(a.severity==='fault'))
 },[findings])
 const cardSignature=groups.map(g=>g.id).join('|')
 const positions=nodes.map(n=>[n.id,n.position.x,n.position.y]),signature=JSON.stringify([positions,groups.map(g=>[g.id,g.severity,g.items.map(f=>f.title)])])
 useLayoutEffect(()=>{
  const el=root.current;if(!el)return
  const host=el.parentElement!,observer=new ResizeObserver(()=>refresh(v=>v+1));observer.observe(host);for(const card of el.querySelectorAll('[data-warning-target]'))observer.observe(card)
  return()=>observer.disconnect()
 },[cardSignature])
 useLayoutEffect(()=>{
  const rail=root.current,host=rail?.parentElement;if(!rail||!host)return
  const outer=host.getBoundingClientRect(),railBox=rail.getBoundingClientRect(),diagram=host.querySelector('.schematic-diagram')!.getBoundingClientRect(),boxes=nodes.map(n=>({id:n.id,left:viewport.x+n.position.x*viewport.zoom,top:viewport.y+n.position.y*viewport.zoom,right:viewport.x+(n.position.x+210)*viewport.zoom,bottom:viewport.y+(n.position.y+(n.height??180))*viewport.zoom}))
  const obstacles=boxes.filter(b=>b.right>=0&&b.left<=diagram.width&&b.bottom>=0&&b.top<=diagram.height).map(b=>({...b,left:Math.max(0,b.left),right:Math.min(diagram.width,b.right),top:Math.max(0,b.top),bottom:Math.min(diagram.height,b.bottom)}))
  const result:typeof leaders=[]
  for(const group of groups){
   const card=Array.from(rail.querySelectorAll<HTMLElement>('[data-warning-target]')).find(e=>e.dataset.warningTarget===group.id)?.getBoundingClientRect()
   if(!card||card.bottom<railBox.top||card.top>railBox.bottom)continue
   const end={x:card.left-outer.left,y:Math.max(railBox.top+42,Math.min(card.top+card.height/2,railBox.bottom-10))-outer.top}
   const b=boxes.find(b=>b.id===(targetMap[group.target??'']??group.target));let anchors:{x:number;y:number}[]=[]
   if(b&&b.left>=0&&b.right<=diagram.width&&b.top>=0&&b.bottom<=diagram.height)anchors=[{x:b.right,y:(b.top+b.bottom)/2},{x:b.left,y:(b.top+b.bottom)/2},{x:(b.left+b.right)/2,y:b.top},{x:(b.left+b.right)/2,y:b.bottom}]
   else{
    const w=displayProject.wires.find(w=>w.id===group.target)
    if(w){const port=(id:string,pid:string)=>{const d=displayProject.devices.find(d=>d.id===id)!,p=d.ports.find(p=>p.id===pid)!,n=nodes.find(n=>n.id===id)!;return {x:n.position.x+(p.side==='left'?0:p.side==='right'?210:p.offset*210),y:n.position.y+(p.side==='top'?0:p.side==='bottom'?180:p.offset*180),side:({left:Position.Left,right:Position.Right,top:Position.Top,bottom:Position.Bottom})[p.side]}};const a=port(w.from,w.fromPort),b=port(w.to,w.toPort),[,x,y]=getSmoothStepPath({sourceX:a.x,sourceY:a.y,targetX:b.x,targetY:b.y,sourcePosition:a.side,targetPosition:b.side,offset:27});const point={x:viewport.x+x*viewport.zoom,y:viewport.y+y*viewport.zoom};if(point.x>=0&&point.x<=diagram.width&&point.y>=0&&point.y<=diagram.height)anchors=[point]}
   }
   if(!anchors.length)continue
   const points=warningLeader(anchors,end,obstacles)
   if(points)result.push({id:group.id,severity:group.severity,points})
  }
  setLeaders(result)
 },[signature,displayProject,targetMap,viewport.x,viewport.y,viewport.zoom,tick])
 const locate=(id:string)=>{onSelect(id);const wire=project.wires.find(w=>w.id===id),ids=wire?[wire.from,wire.to]:[id];flow.fitView({nodes:ids.map(id=>({id:targetMap[id]??id})),duration:400,padding:.5,maxZoom:1.3});if(targetMap[id]&&project.devices.some(d=>d.id===id))setTimeout(()=>{if(flow.getNode(id))void flow.fitView({nodes:[{id}],duration:400,padding:.5,maxZoom:1.3})},230)}
 const name=(id?:string)=>project.devices.find(d=>d.id===id)?.name??project.wires.find(w=>w.id===id)?.reference??'Whole system'
 return <><svg className="warning-leaders" aria-hidden="true">{leaders.map(l=><g key={l.id} data-warning-leader={l.id} className={l.severity}><polyline className="leader-halo" points={l.points.map(p=>`${p.x},${p.y}`).join(' ')}/><polyline points={l.points.map(p=>`${p.x},${p.y}`).join(' ')}/><circle cx={l.points[0].x} cy={l.points[0].y} r="4"/></g>)}</svg><aside ref={root} className="warning-callouts" aria-label="Schematic fault callouts" onScroll={()=>refresh(v=>v+1)}><header><strong>Faults & warnings</strong><small>Dashed leaders mark issues, not electrical connections.</small><button onClick={onDiagnostics} title="Open the full diagnostics panel">All diagnostics</button></header>{groups.map(g=><article key={g.id} data-warning-target={g.id} className={`warning-callout ${g.severity}`} aria-label={`${g.severity} at ${name(g.target)}`}><div><b>{g.severity==='fault'?'FAULT':'WARNING'}</b><strong>{name(g.target)}</strong></div><p>{g.items[0].title}{g.items.length>1?` · ${g.items.length} findings`:''}</p><FixSuggestion project={project} finding={g.items[0]} onApply={onFix}/><div>{g.target&&<button onClick={()=>locate(g.target!)}>Locate problem</button>}<button onClick={onDiagnostics}>Details & tips</button></div></article>)}</aside></>
}

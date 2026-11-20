import {useLayoutEffect, useRef, useState} from 'react'
import {useViewport} from '@xyflow/react'
import {warningLeader} from './warning-route'

export function FaultLeaders({targetMap}: {targetMap:Record<string,string>}) {
  const overlay=useRef<SVGSVGElement>(null)
  const viewport=useViewport()
  const [lines,setLines]=useState<{id:string;points:string;end:{x:number;y:number}}[]>([])
  useLayoutEffect(()=>{
    const svg=overlay.current
    const shell=svg?.closest('.workspace-shell')
    const drawer=shell?.querySelector('.tool-drawer-content')
    const diagram=svg?.closest('.schematic-diagram')
    if(!svg||!shell||!drawer||!diagram)return
    let raf=0
    const update=()=>{
      const root=svg.getBoundingClientRect(), panel=drawer.getBoundingClientRect()
      const nodes=[...diagram.querySelectorAll<HTMLElement>('.react-flow__node[data-id]')].map(el=>({id:el.dataset.id,rect:el.getBoundingClientRect()}))
      const obstacles=nodes.filter(({rect:r})=>r.right>=root.left&&r.left<=root.right&&r.bottom>=root.top&&r.top<=root.bottom).map(({rect:r})=>({left:r.left-root.left,right:r.right-root.left,top:r.top-root.top,bottom:r.bottom-root.top}))
      const next:typeof lines=[]
      const seen=new Set<string>()
      for(const card of drawer.querySelectorAll<HTMLElement>('[data-fault-target]')){
        const target=card.dataset.faultTarget!
        const id=targetMap[target]??target
        if(seen.has(id))continue
        const header=card.querySelector('header')?.getBoundingClientRect()??card.getBoundingClientRect()
        if(header.bottom<panel.top||header.top>panel.bottom)continue
        const bottomDock=panel.top>=root.bottom-2
        const start=bottomDock
          ? {x:Math.min(root.width-4,Math.max(4,(header.left+header.right)/2-root.left)),y:root.height-1}
          : {x:1,y:(header.top+header.bottom)/2-root.top}
        if(start.y<0||start.y>root.height)continue
        const node=nodes.find(n=>n.id===id)?.rect
        let anchors:{x:number;y:number}[]=[]
        if(node){
          const left=node.left-root.left,right=node.right-root.left,top=node.top-root.top,bottom=node.bottom-root.top
          anchors=[{x:left,y:(top+bottom)/2},{x:right,y:(top+bottom)/2},{x:(left+right)/2,y:top},{x:(left+right)/2,y:bottom}]
        }else{
          const edge=diagram.querySelector<SVGPathElement>('.react-flow__edge[data-id="'+CSS.escape(id)+'"] .react-flow__edge-path')
          const matrix=edge?.getScreenCTM()
          if(edge&&matrix){
            const point=edge.getPointAtLength(edge.getTotalLength()/2).matrixTransform(matrix)
            anchors=[{x:point.x-root.left,y:point.y-root.top}]
          }
        }
        anchors=anchors.filter(p=>p.x>=0&&p.x<=root.width&&p.y>=0&&p.y<=root.height)
        if(!anchors.length)continue
        const points=warningLeader(anchors,start,obstacles)
        if(points){next.push({id,points:points.map(p=>p.x+','+p.y).join(' '),end:points[0]});seen.add(id)}
      }
      setLines(next)
    }
    const queue=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(update)}
    const observer=new ResizeObserver(queue)
    observer.observe(diagram);observer.observe(drawer)
    const changes=new MutationObserver(records=>{if(records.some(record=>!svg.contains(record.target)))queue()})
    changes.observe(drawer,{childList:true,subtree:true,attributes:true,attributeFilter:['open']})
    changes.observe(diagram,{subtree:true,attributes:true,attributeFilter:['style','d'],childList:true})
    drawer.addEventListener('scroll',queue,true)
    queue()
    return()=>{cancelAnimationFrame(raf);changes.disconnect();observer.disconnect();drawer.removeEventListener('scroll',queue,true)}
  },[targetMap,viewport.x,viewport.y,viewport.zoom])
  return <svg ref={overlay} className="fault-leaders" aria-hidden="true">
    {lines.map(line=><g key={line.id} data-warning-leader={line.id}><polyline points={line.points}/><circle cx={line.end.x} cy={line.end.y} r="4"/></g>)}
  </svg>
}

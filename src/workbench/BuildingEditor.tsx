import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Copy, Hand, Maximize2, Minus, MousePointer2, Plus, Trash2, Undo2 } from 'lucide-react'
import { uid } from './model'
import type { BuildingLayout, FloorPlan, PlanPoint } from './building-model'
import { addPlanWall, buildingRooms, normalizeFloor, planDistance, wallPoints } from './building-plan'
import { availableRoofRooms,roomInterior } from './building-geometry'
import { NumberField } from './NumberField'
import {autoCirculation,roomFitsOpening} from './building-circulation'

type Tool='select'|'wall'|'curve'|'pan'|'opening'|'stairs'
type Drag={kind:'node'|'wall'|'control'|'pan'|'compass';id:string;start:PlanPoint;floor:FloorPlan;view:PlanPoint;screen?:PlanPoint}
export function BuildingEditor({value,onChange,equipmentChoices=[]}:{equipmentChoices?:Array<{key:string;label:string}>;value:BuildingLayout;onChange:(layout:BuildingLayout)=>void}) {
  const [floorIndex,setFloorIndex]=useState(0),[showLower,setShowLower]=useState(true),[tool,setTool]=useState<Tool>('wall'),[start,setStart]=useState<PlanPoint|null>(null),[selected,setSelected]=useState(''),[draft,setDraft]=useState<FloorPlan|null>(null),[grid,setGrid]=useState(.25),[span,setSpan]=useState(12),[centre,setCentre]=useState<PlanPoint>([0,0]),[aspect,setAspect]=useState(1.6)
  const [openingWidth,setOpeningWidth]=useState(1.2),[openingDepth,setOpeningDepth]=useState(4.4),[planMessage,setPlanMessage]=useState('')
  const svg=useRef<SVGSVGElement>(null),drag=useRef<Drag|null>(null),history=useRef<BuildingLayout[]>([]),pattern=useId().replace(/:/g,'')
  const pendingFloor=useRef<FloorPlan|null>(null),pendingBearing=useRef<number|null>(null)
  const [bearing,setBearing]=useState<number|null>(null),[placementTarget,setPlacementTarget]=useState<string|null>(null),[cursor,setCursor]=useState<PlanPoint|null>(null)
  const floor=value.floors[Math.min(floorIndex,value.floors.length-1)],shown=draft??floor
  const rooms=useMemo(()=>buildingRooms({...value,floors:value.floors.map(f=>f.id===floor.id?shown:f)}),[value,shown,floor.id])
  const roofs=useMemo(()=>availableRoofRooms(value),[value]),wall=shown.walls.find(w=>w.id===selected),room=rooms.find(r=>r.id===selected)
  const update=(next:BuildingLayout)=>{history.current=[...history.current.slice(-39),structuredClone(value)];onChange(next)}
  const updateFloor=(next:FloorPlan)=>update({...value,floors:value.floors.map(f=>f.id===floor.id?next:f)})
  const fit=()=>{
    const points=[...floor.nodes,...(showLower?value.floors.slice(Math.max(0,floorIndex-1),floorIndex).flatMap(f=>f.nodes):[])].map(n=>n.point)
    if(!points.length){setCentre([0,0]);setSpan(12);return}
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);setCentre([(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2]);setSpan(Math.max(4,Math.max(...ys)-Math.min(...ys)+3,(Math.max(...xs)-Math.min(...xs)+3)/aspect))
  }
  useEffect(()=>{setFloorIndex(index=>Math.min(index,value.floors.length-1));fit();setStart(null);setCursor(null);setSelected('');setDraft(null);pendingFloor.current=null;drag.current=null},[floor.id])
  useEffect(()=>{const element=svg.current;if(!element)return;const resize=new ResizeObserver(()=>setAspect(element.clientWidth/Math.max(1,element.clientHeight)));resize.observe(element);return()=>resize.disconnect()},[])
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setStart(null);setDraft(null);drag.current=null;pendingFloor.current=null;pendingBearing.current=null;setBearing(null);setPlacementTarget(null)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[])
  const coordinates=(event:PointerEvent<SVGSVGElement>):PlanPoint=>{
    const bounds=svg.current!.getBoundingClientRect()
    return [centre[0]+((event.clientX-bounds.left)/bounds.width-.5)*span*aspect,centre[1]+((event.clientY-bounds.top)/bounds.height-.5)*span]
  }
  const snap=(point:PlanPoint,excluded:string[]=[],anchor?:PlanPoint):PlanPoint=>{
    const candidates=[...floor.nodes.filter(n=>!excluded.includes(n.id)),...(showLower?value.floors.slice(Math.max(0,floorIndex-1),floorIndex).flatMap(f=>f.nodes):[])]
    const node=candidates.find(n=>planDistance(n.point,point)<span*.018)
    if(node)return node.point
    const aligned=point.map((coordinate,axis)=>{
      const target=[...(anchor?[anchor[axis]]:[]),...candidates.map(n=>n.point[axis])].sort((a,b)=>Math.abs(a-coordinate)-Math.abs(b-coordinate))[0]
      return target!==undefined&&Math.abs(target-coordinate)<span*.025?target:Math.round(coordinate/grid)*grid
    }) as PlanPoint
    let closest:PlanPoint|undefined,distance=span*.015
    for(const wall of floor.walls.filter(w=>!excluded.includes(w.a)&&!excluded.includes(w.b))){const points=wallPoints(floor,wall);for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy))),candidate:PlanPoint=[a[0]+t*dx,a[1]+t*dy],next=planDistance(point,candidate)
      if(next<distance){closest=candidate;distance=next}
    }}
    return closest??aligned
  }
  const beginDrag=(event:PointerEvent<SVGElement>,kind:Drag['kind'],id:string)=>{
    if(placementTarget){
      event.stopPropagation()
      const preference=value.equipmentPlacements?.[placementTarget],chosen=rooms.find(r=>r.id===preference?.roomId)
      if(chosen?.walls.includes(id)){update({...value,equipmentPlacements:{...value.equipmentPlacements,[placementTarget]:{roomId:chosen.id,wallId:id}}});setPlacementTarget(null);setSelected(id)}
      return
    }
    if(tool!=='select')return
    event.stopPropagation();svg.current!.setPointerCapture(event.pointerId)
    drag.current={kind,id,start:coordinates(event as unknown as PointerEvent<SVGSVGElement>),floor:structuredClone(floor),view:centre};setSelected(id)
  }
  const move=(event:PointerEvent<SVGSVGElement>)=>{
    const active=drag.current
    const point=coordinates(event)
    if(!active){if(start)setCursor(snap(point,[],tool==='wall'?start:undefined));return}
    if(active.kind==='compass'){
      const origin:PlanPoint=[centre[0]+span*aspect/2-span*.09,centre[1]-span*.37]
      const angle=(Math.atan2(point[0]-origin[0],origin[1]-point[1])*180/Math.PI+360)%360
      pendingBearing.current=Math.round(angle)%360;setBearing(pendingBearing.current);return
    }
    if(active.kind==='pan'){setCentre([active.view[0]-(event.clientX-active.screen![0])*span*aspect/svg.current!.clientWidth,active.view[1]-(event.clientY-active.screen![1])*span/svg.current!.clientHeight]);return}
    let next=structuredClone(active.floor)
    if(active.kind==='node')next.nodes=next.nodes.map(n=>n.id===active.id?{...n,point:snap(point,[active.id])}:n)
    if(active.kind==='control')next.walls=next.walls.map(w=>w.id===active.id?{...w,control:point.map(n=>Math.round(n/grid)*grid) as PlanPoint}:w)
    if(active.kind==='wall'){
      const selectedWall=next.walls.find(w=>w.id===active.id)!,a=wallPointAt(active.floor,selectedWall.a),b=wallPointAt(active.floor,selectedWall.b)
      const raw:PlanPoint=[point[0]-active.start[0],point[1]-active.start[1]],excluded=[selectedWall.a,selectedWall.b]
      const snapped=[a,b].map(endpoint=>{const target=snap([endpoint[0]+raw[0],endpoint[1]+raw[1]],excluded);return [target[0]-endpoint[0],target[1]-endpoint[1]] as PlanPoint})
      const dx=snapped.map(p=>p[0]).sort((a,b)=>Math.abs(a-raw[0])-Math.abs(b-raw[0]))[0],dy=snapped.map(p=>p[1]).sort((a,b)=>Math.abs(a-raw[1])-Math.abs(b-raw[1]))[0]
      next.nodes=next.nodes.map(n=>n.id===selectedWall.a||n.id===selectedWall.b?{...n,point:[n.point[0]+dx,n.point[1]+dy]}:n)
      next.walls=next.walls.map(w=>w.id===selectedWall.id&&w.control?{...w,control:[w.control[0]+dx,w.control[1]+dy]}:w)
    }
    pendingFloor.current=next;setDraft(next)
  }
  const end=(event:PointerEvent<SVGSVGElement>)=>{
    if(drag.current){
      if(drag.current.kind==='compass'&&pendingBearing.current!==null)update({...value,northBearing:pendingBearing.current})
      else if(pendingFloor.current)updateFloor(normalizeFloor(pendingFloor.current))
      drag.current=null;pendingFloor.current=null;pendingBearing.current=null;setBearing(null);setDraft(null);return
    }
    if(placementTarget)return
    if(tool==='opening'||tool==='stairs'){
      const point=snap(coordinates(event)),lower=rooms.find(r=>r.floor===floorIndex&&roomFitsOpening(r,point,openingWidth,openingDepth))
      if(!lower){setPlanMessage('Place the whole opening inside an enclosed room, with clearance from the walls.');return}
      if(tool==='stairs'){
        if(floorIndex>=value.floors.length-1||!rooms.some(r=>r.floor===floorIndex+1&&roomFitsOpening(r,point,openingWidth,openingDepth))){setPlanMessage('Stairs need an overlapping room on the floor above. Switch to a lower floor and place them in shared space.');return}
        update({...value,stairs:[...(value.stairs??[]),{floor:floorIndex,position:point,width:openingWidth,run:openingDepth}]})
      }else update({...value,floorOpenings:[...(value.floorOpenings??[]),{id:uid('opening'),floor:floorIndex,position:point,width:openingWidth,depth:openingDepth}]})
      setPlanMessage('Placed on the plan. Stairs automatically cut an opening in the floor above.');setTool('select');return
    }
    if(tool==='wall'||tool==='curve'){
      const point=snap(coordinates(event),[],tool==='wall'?start??undefined:undefined)
      if(!start){setStart(point);return}
      updateFloor(addPlanWall(floor,start,point,tool==='curve'));setStart(point)
    }
  }
  const copyFloor=(original:FloorPlan):FloorPlan=>{
    const ids=new Map(original.nodes.map(n=>[n.id,uid('junction')]))
    return {id:uid('floor'),nodes:original.nodes.map(n=>({...n,id:ids.get(n.id)!})),walls:original.walls.map(w=>({...w,id:uid('wall'),a:ids.get(w.a)!,b:ids.get(w.b)!}))}
  }
  const setFloors=(count:number)=>{
    if(!Number.isInteger(count)||count<1||count>100)return
    const floors=value.floors.slice(0,count)
    while(floors.length<count)floors.push({id:uid('floor'),nodes:[],walls:[]})
    update({...value,floors,stairs:value.stairs?.filter(s=>s.floor<count-1),floorOpenings:value.floorOpenings?.filter(o=>o.floor<count)});setFloorIndex(Math.min(floorIndex,count-1))
  }
  const removeWall=()=>{if(wall){updateFloor(normalizeFloor({...floor,walls:floor.walls.filter(w=>w.id!==wall.id)}));setSelected('')}}
  const bounds=[0,1].map(axis=>{const values=floor.nodes.map(n=>n.point[axis]);return values.length?[Math.min(...values),Math.max(...values)]:[0,0]})
  const resize=(axis:number,length:number)=>{
    const old=bounds[axis][1]-bounds[axis][0]
    if(old<.01)return
    const centre=(bounds[axis][0]+bounds[axis][1])/2,scale=(point:PlanPoint)=>point.map((value,i)=>i===axis?centre+(value-centre)*length/old:value) as PlanPoint
    updateFloor({...floor,nodes:floor.nodes.map(n=>({...n,point:scale(n.point)})),walls:floor.walls.map(w=>w.control?{...w,control:scale(w.control)}:w)})
  }
  return <div className="building-editor" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setStart(null);setDraft(null);drag.current=null;pendingFloor.current=null;pendingBearing.current=null;setBearing(null);setPlacementTarget(null)}if((event.ctrlKey||event.metaKey)&&event.key==='z'){event.preventDefault();event.stopPropagation();const previous=history.current.pop();if(previous)onChange(previous)}}}>
    <div className="design-fields"><NumberField label="Number of floors" unit="floors" value={value.floors.length} min={1} max={100} onChange={setFloors}/><NumberField label="Floor height" unit="m" value={value.floorHeight} min={.2} max={10} onChange={floorHeight=>update({...value,floorHeight})}/><NumberField label="Wall thickness" unit="m" value={value.wallThickness} min={.05} max={1} onChange={wallThickness=>update({...value,wallThickness})}/><NumberField label="Layout width" unit="m" value={bounds[0][1]-bounds[0][0]} min={.25} onChange={length=>resize(0,length)}/><NumberField label="Layout depth" unit="m" value={bounds[1][1]-bounds[1][0]} min={.25} onChange={length=>resize(1,length)}/>
      <label className="field"><span>Roof shape</span><select aria-label="Roof shape" value={value.roofShape} onChange={event=>update({...value,roofShape:event.target.value as BuildingLayout['roofShape']})}>{(['flat','gable','hip','shed'] as const).map(shape=><option key={shape} value={shape}>{({flat:'Flat - level',gable:'Gable - two slopes',hip:'Hip - four slopes',shed:'Shed - one slope'})[shape]}</option>)}</select></label><NumberField label="Roof pitch" unit="degrees" value={value.roofPitch} max={65} onChange={roofPitch=>update({...value,roofPitch})}/>
    </div>
    <div className="roof-options" role="group" aria-label="Roof type previews">{(['flat','gable','hip','shed'] as const).map(shape=><button key={shape} aria-label={`Choose ${shape} roof`} aria-pressed={value.roofShape===shape} onClick={()=>update({...value,roofShape:shape})}><svg viewBox="0 0 100 65" role="img" aria-label={`${shape} roof preview`}><path d="M15 33V55H85V33" fill="#e2e9de" stroke="#526b64" strokeWidth="3"/><path d={shape==='flat'?'M10 30H90V35H10Z':shape==='gable'?'M8 35L50 8L92 35Z':shape==='hip'?'M8 35L30 10H70L92 35Z':'M8 35L92 10V35Z'} fill="#87b2a0" stroke="#267663" strokeWidth="3"/>{shape==='hip'&&<path d="M30 10L42 35M70 10L58 35" stroke="#267663" strokeWidth="2"/>}</svg><span>{shape[0].toUpperCase()+shape.slice(1)}</span></button>)}</div><div className="plan-toolbar"><label>Floor<select aria-label="Plan floor" value={floorIndex} onChange={event=>setFloorIndex(+event.target.value)}>{value.floors.map((f,i)=><option key={f.id} value={i}>Floor {i+1}</option>)}</select></label>{([['select','Select',MousePointer2],['wall','Straight wall',Plus],['curve','Curved wall',Copy],['pan','Pan',Hand]] as const).map(([mode,label,Icon])=><button key={mode} aria-pressed={tool===mode} onClick={()=>{setTool(mode);setStart(null)}} title={label}><Icon size={15}/>{label}</button>)}<button aria-label="Undo floor plan edit" disabled={!history.current.length} onClick={()=>{const previous=history.current.pop();if(previous){onChange(previous);setDraft(null);setStart(null)}}}><Undo2 size={16}/></button></div>
    <div className="plan-toolbar"><button onClick={()=>{try{update(autoCirculation(value));setPlanMessage('Internal doorways added. Stairs connect overlapping floors.')}catch(error){setPlanMessage(error instanceof Error?error.message:String(error))}}}>Auto doors and stairs</button><button aria-pressed={tool==='opening'} onClick={()=>{setTool('opening');setStart(null)}}>Place floor opening</button><button disabled={floorIndex>=value.floors.length-1} aria-pressed={tool==='stairs'} onClick={()=>{setTool('stairs');setStart(null)}}>Place stairs to floor above</button></div>
    {(tool==='opening'||tool==='stairs')&&<div className="design-fields"><NumberField label="Opening width" unit="m" min={.7} max={5} value={openingWidth} onChange={setOpeningWidth}/><NumberField label="Opening length" unit="m" min={1} max={15} value={openingDepth} onChange={setOpeningDepth}/></div>}
    {planMessage&&<p className="plan-feedback" role="status">{planMessage}</p>}
    <svg ref={svg} className="floor-plan" aria-label="Top-down building floor plan" role="application" tabIndex={0} viewBox={`${centre[0]-span*aspect/2} ${centre[1]-span/2} ${span*aspect} ${span}`} onPointerDown={event=>{event.currentTarget.focus();if(tool==='pan'){svg.current!.setPointerCapture(event.pointerId);drag.current={kind:'pan',id:'',start:coordinates(event),floor,view:centre,screen:[event.clientX,event.clientY]}}}} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{drag.current=null;pendingFloor.current=null;pendingBearing.current=null;setBearing(null);setDraft(null)}}>
      <defs><pattern id={pattern} width={grid} height={grid} patternUnits="userSpaceOnUse"><path d={`M${grid} 0H0V${grid}`} fill="none" stroke="#d5ded3" strokeWidth={span/1500}/></pattern></defs>
      <rect x={centre[0]-span*aspect/2} y={centre[1]-span/2} width={span*aspect} height={span} fill={`url(#${pattern})`}/>
      {rooms.filter(r=>r.floor===floorIndex).map(r=>{const p=roomInterior(r);return <g key={r.id} onPointerDown={event=>{if(tool==='select'){event.stopPropagation();setSelected(r.id)}}}><polygon points={r.polygon.map(p=>p.join(',')).join(' ')} fill={selected===r.id?'#c2ddca':'#e2e9de'} stroke="none"/><text x={p[0]} y={p[1]} textAnchor="middle" fontSize={span/26} fill="#416953" pointerEvents="none"><title>{r.name}</title>{r.name.replace(/^Floor \d+ room /,'Room ')}<tspan x={p[0]} dy={span/23}>{r.area.toFixed(1)} m²</tspan></text></g>})}
      {value.floorOpenings?.filter(o=>o.floor===floorIndex).map(o=><g key={o.id} pointerEvents="none" aria-label="Floor opening"><rect x={o.position[0]-o.width/2} y={o.position[1]-o.depth/2} width={o.width} height={o.depth} fill="#f5f7f0" stroke="#9c6b45" strokeWidth={span/300} strokeDasharray={span/80}/><text x={o.position[0]} y={o.position[1]} textAnchor="middle" fontSize={span/35}>Opening</text></g>)}
      {value.stairs?.filter(stairs=>stairs.floor===floorIndex||stairs.floor+1===floorIndex).map((stairs,index)=><g key={index} pointerEvents="none" aria-label="Plan stairs"><rect x={stairs.position[0]-stairs.width/2} y={stairs.position[1]-stairs.run/2} width={stairs.width} height={stairs.run} fill="#e4d8c1" stroke="#9c805d" strokeWidth={span/350}/>{Array.from({length:12},(_,step)=><line key={step} x1={stairs.position[0]-stairs.width/2} x2={stairs.position[0]+stairs.width/2} y1={stairs.position[1]-stairs.run/2+stairs.run*step/12} y2={stairs.position[1]-stairs.run/2+stairs.run*step/12} stroke="#9c805d" strokeWidth={span/500}/>)}<text x={stairs.position[0]+stairs.width/2+span/40} y={stairs.position[1]} fontSize={span/35}>{stairs.floor===floorIndex?'Up':'Down'}</text></g>)}
      {showLower&&value.floors.slice(Math.max(0,floorIndex-1),floorIndex).map(below=><g key={below.id} aria-label={`Floor ${floorIndex} reference`} pointerEvents="none" opacity={.25}><title>Floor {floorIndex} below - snap guide</title>{below.walls.map(w=><polyline key={w.id} points={wallPoints(below,w).map(p=>p.join(',')).join(' ')} fill="none" stroke="#a66c35" strokeWidth={span/80} strokeDasharray={`${span/40} ${span/70}`}/>)}</g>)}
      {shown.walls.map(w=><polyline key={w.id} aria-label={`Plan wall ${w.id}`} points={wallPoints(shown,w).map(p=>p.join(',')).join(' ')} fill="none" stroke={placementTarget&&rooms.find(r=>r.id===value.equipmentPlacements?.[placementTarget]?.roomId)?.walls.includes(w.id)?'#d08e45':selected===w.id?'#168578':'#526b64'} strokeWidth={Math.max(value.wallThickness,span/130)} strokeLinecap="round" onPointerDown={event=>beginDrag(event,'wall',w.id)}/>)}
      {tool==='select'&&shown.nodes.map(n=><circle key={n.id} cx={n.point[0]} cy={n.point[1]} r={span/90} fill="#fff" stroke="#238572" strokeWidth={span/450} onPointerDown={event=>beginDrag(event,'node',n.id)}/>)}
      {tool==='select'&&wall?.control&&<><line x1={wallPointAt(shown,wall.a)[0]} y1={wallPointAt(shown,wall.a)[1]} x2={wall.control[0]} y2={wall.control[1]} stroke="#68a291" strokeWidth={span/400} strokeDasharray={`${span/70} ${span/70}`}/><circle cx={wall.control[0]} cy={wall.control[1]} r={span/65} fill="#d08e45" onPointerDown={event=>beginDrag(event,'control',wall.id)}/></>}
      <g aria-label="Plan compass" role="slider" tabIndex={0} aria-valuemin={0} aria-valuemax={359} aria-valuenow={bearing??value.northBearing??0} style={{cursor:'grab',touchAction:'none'}} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();update({...value,northBearing:((value.northBearing??0)+(['ArrowLeft','ArrowDown'].includes(event.key)?-5:5)+360)%360})}}} onPointerDown={event=>{event.stopPropagation();svg.current!.setPointerCapture(event.pointerId);drag.current={kind:'compass',id:'',start:coordinates(event as unknown as PointerEvent<SVGSVGElement>),floor,view:centre}}} transform={`translate(${centre[0]+span*aspect/2-span*.09},${centre[1]-span*.37})`}><circle r={span*.08} fill="#f8fbf3" stroke="#b9cec0" strokeWidth={span/500}/><g transform={`rotate(${bearing??value.northBearing??0})`}><path d={`M0 ${-span*.05}L${-span*.018} ${span*.015}L0 0L${span*.018} ${span*.015}Z`} fill="#267663"/><text y={-span*.065} textAnchor="middle" fontSize={span*.035} fill="#267663">N</text></g></g>
      {shown.walls.map((w,i)=>{const points=wallPoints(shown,w),a=points[0],b=points.at(-1)!;return <text key={w.id+'label'} x={(a[0]+b[0])/2} y={(a[1]+b[1])/2-span*.025} textAnchor="middle" fontSize={span*.025} fill="#6f5436" pointerEvents="none">Wall {i+1}</text>})}
      {shown.walls.filter(w=>w.door).map(w=>{const a=wallPointAt(shown,w.a),b=wallPointAt(shown,w.b);return <circle key={w.id+'door'} cx={(a[0]+b[0])/2} cy={(a[1]+b[1])/2} r={span/65} fill="#f5f7f0" stroke="#a67e48" strokeWidth={span/300} pointerEvents="none" aria-label="Plan doorway"/>})}
      {start&&cursor&&<line x1={start[0]} y1={start[1]} x2={cursor[0]} y2={cursor[1]} stroke="#27a78e" strokeWidth={span/160} strokeDasharray={`${span/60} ${span/90}`} pointerEvents="none"/>}{start&&<circle cx={start[0]} cy={start[1]} r={span/75} fill="#27a78e"/>}
    </svg>
    <label className="building-enable"><input type="checkbox" checked={showLower} onChange={e=>setShowLower(e.target.checked)}/>Show outline of floor below and snap to its junctions</label>
    <div className="plan-toolbar">{floorIndex>0&&<button onClick={()=>updateFloor({...copyFloor(value.floors[floorIndex-1]),id:floor.id})}>Copy layout from floor below</button>}<button aria-label="Zoom floor plan in" onClick={()=>setSpan(Math.max(1,span*.8))}><Plus size={16}/></button><button aria-label="Zoom floor plan out" onClick={()=>setSpan(Math.min(20000,span*1.25))}><Minus size={16}/></button><button onClick={fit}><Maximize2 size={15}/>Fit layout</button><label>Snap<select aria-label="Floor plan grid size" value={grid} onChange={event=>setGrid(+event.target.value)}>{[.1,.25,.5,1].map(step=><option key={step} value={step}>{step} m</option>)}</select></label>{wall&&<button onClick={removeWall}><Trash2 size={15}/>Remove wall</button>}</div>
    <p className="plan-instructions">{placementTarget?'Click an amber wall to place the equipment.':tool==='opening'||tool==='stairs'?'Click the centre of the opening or staircase on the grid.':tool==='select'?'Drag a wall or junction to move it. Select a curved wall and drag its amber control.':tool==='pan'?'Drag the plan to pan. Use the zoom controls to change scale.':start?'Choose the next junction. Walls snap and connect at intersections. Escape ends the chain.':'Choose the first and second wall endpoints. Close a loop to create a room.'}</p>
    {wall&&!wall.control&&<label className="building-enable"><input type="checkbox" checked={!!wall.door} onChange={e=>updateFloor({...floor,walls:floor.walls.map(w=>w.id===wall.id?{...w,door:e.target.checked}:w)})}/>Doorway in selected wall</label>}
    {wall&&<label className="field"><span>Selected wall shape</span><select aria-label="Selected wall shape" value={wall.control?'curve':'straight'} onChange={event=>{const a=wallPointAt(floor,wall.a),b=wallPointAt(floor,wall.b);updateFloor(normalizeFloor({...floor,walls:floor.walls.map(w=>w.id===wall.id?{...w,control:event.target.value==='curve'?[(a[0]+b[0])/2-(b[1]-a[1])*.25,(a[1]+b[1])/2+(b[0]-a[0])*.25]:undefined}:w)}))}}><option value="straight">Straight</option><option value="curve">Curved</option></select></label>}
    {room&&<label className="field"><span>Room name</span><input aria-label="Selected room name" value={room.name} onChange={event=>update({...value,roomNames:{...value.roomNames,[room.id]:event.target.value}})}/></label>}
    <div className="design-fields"><NumberField label="Compass north bearing" unit="degrees clockwise from plan up" value={value.northBearing??0} max={359.99} onChange={northBearing=>update({...value,northBearing})}/><label className="field"><span>Solar hemisphere</span><select aria-label="Solar hemisphere" value={value.solarHemisphere??'south'} onChange={e=>update({...value,solarHemisphere:e.target.value as 'south'|'north'})}><option value="south">Southern - favour north-facing roof</option><option value="north">Northern - favour south-facing roof</option></select></label></div><p role="note">Compass: N {value.northBearing??0} degrees clockwise from the top of the plan. Panels fill the roof slopes facing the equator first.</p>
    {!!value.stairs?.length&&<details><summary>Stair connections</summary>{value.stairs.map((stairs,index)=><div className="plan-toolbar" key={index}><span>Floor {stairs.floor+1} to {stairs.floor+2}</span><button onClick={()=>update({...value,stairs:value.stairs?.filter((_,i)=>i!==index)})}>Remove stairs {index+1}</button></div>)}</details>}
    {!!value.floorOpenings?.length&&<details><summary>Floor openings</summary>{value.floorOpenings.map((opening,index)=><div className="plan-toolbar" key={opening.id}><span>Floor {opening.floor+1} / {opening.width} x {opening.depth} m</span><button onClick={()=>update({...value,floorOpenings:value.floorOpenings?.filter(o=>o.id!==opening.id)})}>Remove opening {index+1}</button></div>)}</details>}
    <details><summary>Equipment room and wall preferences</summary>{[['inverter','Inverters'],['battery','Batteries'],['mppt','Solar controllers'],['load','Loads'],['motor','Motors'],['fuse','Protection'],['bus','Distribution buses'],...equipmentChoices.map(item=>[item.key,item.label])].map(([kind,label])=>{const preference=value.equipmentPlacements?.[kind],chosen=rooms.find(r=>r.id===preference?.roomId);return <div className="design-fields" key={kind}><label className="field"><span>{label} room</span><select aria-label={`${label} room`} value={preference?.roomId??''} onChange={e=>{const placements={...value.equipmentPlacements};if(e.target.value)placements[kind]={roomId:e.target.value};else delete placements[kind];update({...value,equipmentPlacements:placements})}}><option value="">Use indoor equipment room</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>{chosen&&<><button className="secondary-button" aria-pressed={placementTarget===kind} onClick={()=>{setPlacementTarget(placementTarget===kind?null:kind);setFloorIndex(chosen.floor);setTool('select');requestAnimationFrame(()=>svg.current?.scrollIntoView({behavior:'smooth',block:'center'}))}}>Choose {label.toLowerCase()} wall on plan</button><label className="field"><span>{label} wall</span><select aria-label={`${label} wall`} value={preference?.wallId??''} onChange={e=>update({...value,equipmentPlacements:{...value.equipmentPlacements,[kind]:{roomId:chosen.id,wallId:e.target.value||undefined}}})}><option value="">Automatically find space</option>{chosen.walls.map(id=><option key={id} value={id}>Wall {value.floors[chosen.floor].walls.findIndex(w=>w.id===id)+1}</option>)}</select></label></>}</div>})}</details>
    <div className="design-fields"><label className="field"><span>Indoor equipment room</span><select aria-label="Indoor equipment room" value={value.equipmentRoomId??(rooms.length===1?rooms[0].id:'')} onChange={event=>update({...value,equipmentRoomId:event.target.value||undefined})}><option value="">Choose a room</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name} · {r.area.toFixed(1)} m²</option>)}</select></label><label className="field"><span>Panel roof</span><select aria-label="Panel roof" value={value.panelRoomId??(roofs.length===1?roofs[0].id:'')} onChange={event=>update({...value,panelRoomId:event.target.value||undefined})}><option value="">Automatic - best equator-facing roof space</option>{roofs.map(r=><option key={r.id} value={r.id}>{r.name} roof</option>)}</select></label></div>
  </div>
}

function wallPointAt(floor:FloorPlan,id:string):PlanPoint {return floor.nodes.find(node=>node.id===id)!.point}

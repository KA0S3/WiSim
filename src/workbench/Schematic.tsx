import { memo, useCallback, useEffect, useMemo, useRef,useState } from 'react'
import { ReactFlow, ReactFlowProvider, NodeToolbar, Background, BackgroundVariant, Handle, Position, ConnectionMode, BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, useUpdateNodeInternals, type NodeProps, type EdgeProps, type Connection, type Node, type Edge } from '@xyflow/react'
import { Plus, Minus, Scan, Move, MousePointer2, Cable, Maximize2 } from 'lucide-react'
import {diagramPositions} from './diagram-layout'
import {moveDiagramItems} from './equipment-groups'
import { EquipmentArt } from './EquipmentArt'
import {WarningCallouts} from './WarningCallouts'
import {schematicProjection,groupReadings,setGroupCollapsed} from './equipment-groups'
import { definitions, type Device, type EquipmentGroup, type Frame, type Finding, type Project, type Wire } from './model'
import '@xyflow/react/dist/style.css'

type EquipmentData = { device: Device; group?:EquipmentGroup;groupReading?:ReturnType<typeof groupReadings>;height?:number;onExpand?:()=>void; reading?: Frame['devices'][string]; ac?:boolean; severity?:'fault'|'warning'; index: number; probeMode: boolean; onPort: (id: string, port: string) => void; [key: string]: unknown }
type EquipmentNode = Node<EquipmentData>
const position = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom }
function usePortMeasurements(d:Device,height=180){
 const update=useUpdateNodeInternals(),signature=JSON.stringify([height,d.ports.map(p=>[p.id,p.side,p.offset])])
 useEffect(()=>{const frame=requestAnimationFrame(()=>update(d.id));return()=>cancelAnimationFrame(frame)},[d.id,signature,update])
}
const Equipment = memo(({ data, selected }: NodeProps<EquipmentNode>) => {
  const d = data.device, r = data.reading, definition = definitions[d.kind]
  usePortMeasurements(d)
  const [hovered,setHovered]=useState(false)
  return <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} className={`equipment-node ${selected ? 'selected' : ''} ${!d.on ? 'is-off' : ''} ${data.severity?'has-'+data.severity:''}`} style={{ '--equipment-color': definition.color } as React.CSSProperties}>
    <NodeToolbar isVisible={hovered} position={Position.Top}><div className="equipment-live-tooltip" role="tooltip" aria-label={d.name+' live readings'}><strong>{d.reference?d.reference+' / ':''}{d.name}</strong><div><span>{data.ac?'RMS voltage':'Terminal voltage'}</span><output>{r?r.voltage.toFixed(2):'--'} V</output></div><div><span>{data.ac?'RMS current':'Current'}</span><output>{r?r.current.toFixed(2):'--'} A</output></div><div><span>Active power</span><output aria-label="Live active power">{r?r.power.toFixed(1):'--'} W</output></div>{r?.soc!==undefined&&<div><span>Battery charge</span><output>{r.soc.toFixed(2)}%</output></div>}{r?.inputPower!==undefined&&<div><span>{d.kind==='mppt'?'PV input':'AC input'}</span><output>{r.inputPower.toFixed(1)} W</output></div>}<small>{!d.on?'Switched off':r?.state??'Calculating'} / Click to configure</small></div></NodeToolbar>
    {data.severity&&<span className={`node-issue ${data.severity}`} title="See the linked callout or System diagnostics" aria-label={`${data.severity} on ${d.name}`}>{data.severity==='fault'?'!':'!'}</span>}
    <div className="node-topline"><span>{definition.label.toUpperCase()}</span><span className={`state-dot ${r?.state ?? 'idle'}`} /></div>
    <EquipmentArt kind={d.kind} />
    <div className="node-name" title={d.name}>{d.name}</div>
    <div className="node-reading"><span>{r ? `${Math.abs(r.voltage).toFixed(1)} V` : '— V'}</span><span>{!d.on ? 'OFF' : r?.state === 'tripped' ? 'TRIPPED' : r ? `${Math.abs(r.power) >= 1000 ? (Math.abs(r.power)/1000).toFixed(2) + ' kW' : Math.abs(r.power).toFixed(0) + ' W'}` : 'Connecting'}</span></div>
    {d.ports.map(port => <Handle key={port.id} id={port.id} type="source" position={position[port.side]} className={`electrical-port ${port.domain} ${data.probeMode ? 'probe-target' : ''}`} style={{ [port.side === 'left' || port.side === 'right' ? 'top' : 'left']: `${port.offset * 100}%` }} onClick={e => { if (data.probeMode) { e.stopPropagation(); data.onPort(d.id, port.id) } }} title={`${d.name} · ${port.label}`} aria-label={`${d.name} terminal ${port.label}`}><span className={`port-caption ${port.side}`}>{port.label}</span></Handle>)}
  </div>
})
const Conductor = memo((props: EdgeProps) => {
  const data = props.data as { wire: Wire; reading?: Frame['wires'][string]; running: boolean; labels: boolean; severity?:string } | undefined
  const [path, x, y] = getSmoothStepPath({ ...props, borderRadius: 7, offset: 27 })
  const active = data?.running && Math.abs(data.reading?.current ?? 0) > .01
  return <>{data?.severity&&<BaseEdge id={props.id+'-warning'} path={path} style={{stroke:data.severity==='fault'?'#c54f3d':'#d49c25',strokeWidth:8,opacity:.3}}/>}<BaseEdge id={props.id} path={path} style={{ stroke: props.selected ? '#1c7165' : data?.wire.color ?? '#84958c', strokeWidth: props.selected ? 3 : 1.8, opacity: data?.reading ? .8 : .45 }} interactionWidth={20}/>{active && <path d={path} className="flow-dashes" style={{ stroke: data?.wire.color, animationDirection: (data?.reading?.current ?? 0) < 0 ? 'reverse' : 'normal' }} />}{(props.selected || data?.labels) && <EdgeLabelRenderer><div className="wire-badge" style={{ transform: `translate(-50%, -50%) translate(${x}px,${y}px)` }}>{data?.wire.area} mm² <span>· {data?.reading ? Math.abs(data.reading.current).toFixed(1) : '—'} A</span></div></EdgeLabelRenderer>}</>
})
const GroupEquipment=memo(({data,selected}:NodeProps<EquipmentNode>)=>{
 const d=data.device,g=data.group!,r=data.groupReading!
 usePortMeasurements(d,data.height)
 return <div className={`equipment-node grouped-equipment ${selected?'selected':''} ${data.severity?'has-'+data.severity:''}`} style={{height:data.height,'--equipment-color':definitions[d.kind].color} as React.CSSProperties}>
  {data.severity&&<span className={`node-issue ${data.severity}`} title="Expand or open diagnostics to locate the individual fault">!</span>}
  <div className="node-topline"><span>{g.kind==='pv-array'?'PV ARRAY':g.kind==='conversion-stack'?'CONVERSION STACK':'BATTERY BANK'}</span><b>{r.count} units</b></div><EquipmentArt kind={d.kind}/><div className="node-name" title={g.name}>{g.name}</div><div className="group-power" title="Sum of actual source power before internal cable and fuse losses">{r.power===undefined?'--':r.power.toFixed(0)} W</div><button className="nodrag nopan group-expand" title="Show individual equipment and all internal wiring" onClick={e=>{e.stopPropagation();data.onExpand?.()}}>Expand / {g.members.length} items</button>
  {d.ports.map(port=><Handle key={port.id} id={port.id} type="source" position={position[port.side]} className={`electrical-port ${port.domain} ${data.probeMode?'probe-target':''}`} style={{top:`${port.offset*100}%`}} title={port.label} aria-label={`${d.name} terminal ${port.label}`} onClick={e=>{if(data.probeMode){e.stopPropagation();data.onPort(d.id,port.id)}}}><span className={`port-caption ${port.side}`}>{port.label}</span></Handle>)}
 </div>
})
const nodeTypes = { equipment: Equipment,bankArray:GroupEquipment }, edgeTypes = { conductor: Conductor }

type Props = { onDuplicate:(ids:string[])=>void; project: Project; onGroupChange:(p:Project|((p:Project)=>Project))=>void; findings:Finding[]; onDiagnostics:()=>void; onFix:(p:Project)=>void; frame: Frame | null; selected: string | null; selectedIds:string[];onSelection:(ids:string[]|((previous:string[])=>string[]))=>void;onMoveMany:(positions:Record<string,{x:number;y:number}>)=>void;onSelect: (id: string | null) => void; onConnect: (c: Connection) => void; onMove: (id: string, x: number, y: number) => void; onDelete: (ids: string[]) => void; running: boolean; probeMode: boolean; onPort: (id: string, port: string) => void; focusId: string | null; labels: boolean; onLayout: (positions: Record<string, { x: number; y: number }>) => void }
function Canvas(props: Props) {
  const flow = useReactFlow()
  const [menu,setMenu]=useState<{x:number;y:number;ids:string[];equipment:boolean}|null>(null)
  const menuRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!menu)return
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const dismiss=(event:globalThis.PointerEvent)=>{if(!menuRef.current?.contains(event.target as globalThis.Node))setMenu(null)}
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();setMenu(null)}}
    window.addEventListener('pointerdown',dismiss);window.addEventListener('keydown',key)
    return()=>{window.removeEventListener('pointerdown',dismiss);window.removeEventListener('keydown',key)}
  },[menu])
  useEffect(()=>setMenu(null),[props.project])
  const openMenu=(event:React.MouseEvent,id:string,equipment:boolean)=>{
    event.preventDefault();event.stopPropagation()
    const ids=props.selectedIds.includes(id)?props.selectedIds:[id]
    props.onSelection(ids)
    setMenu({x:Math.max(8,Math.min(event.clientX,innerWidth-190)),y:Math.max(8,Math.min(event.clientY,innerHeight-125)),ids,equipment})
  }
  const diagramPadding=props.project.learn?{top:'15px',bottom:'45px',left:'50px',right:'15px'} as const:{top:'90px',bottom:'65px',left:'65px',right:'25px'} as const
  const diagram=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const el=diagram.current;if(!el)return
    const wheel=(e:WheelEvent)=>{if(!e.ctrlKey&&!e.shiftKey)return;e.preventDefault();e.stopPropagation();const v=flow.getViewport(),amount=e.deltaMode===1?16:e.deltaMode===2?el.clientHeight:1;void flow.setViewport({...v,x:v.x-(e.shiftKey?(e.deltaY||e.deltaX)*amount:0),y:v.y-(e.shiftKey?0:e.deltaY*amount)})}
    el.addEventListener('wheel',wheel,{passive:false,capture:true});return()=>el.removeEventListener('wheel',wheel,{capture:true})
  },[flow])
  // Keep pointer movement local: saving, history and electrical edits happen once on release.
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({})
  useEffect(() => setDragPositions({}), [props.project.id])
  useEffect(()=>{
    if(!props.project.learn||!diagram.current)return
    let timer:ReturnType<typeof setTimeout>
    const observer=new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>void flow.fitView({padding:diagramPadding,duration:250}),100)})
    observer.observe(diagram.current)
    return()=>{observer.disconnect();clearTimeout(timer)}
  },[flow,props.project.id])
  const projection=useMemo(()=>schematicProjection(props.project),[props.project])
  const displayed=projection.project
  const severity=(id:string)=>props.findings.some(f=>(projection.targetMap[f.target??'']??f.target)===id&&f.severity==='fault')?'fault':props.findings.some(f=>(projection.targetMap[f.target??'']??f.target)===id&&f.severity==='warning')?'warning':undefined
  const hasWarnings=!props.project.learn&&props.findings.some(f=>f.severity!=='info')
  const nodes = useMemo<EquipmentNode[]>(() => displayed.devices.map((d, index) => ({ id: d.id, type: projection.groups.some(g=>g.group.id===d.id)?'bankArray':'equipment', width: 210, height: projection.groups.find(g=>g.group.id===d.id)?.height??180, measured:{width:210,height:projection.groups.find(g=>g.group.id===d.id)?.height??180}, position: dragPositions[d.id] ?? { x: d.x, y: d.y }, selected: props.selectedIds.includes(d.id), data: { device: d, group:projection.groups.find(g=>g.group.id===d.id)?.group, groupReading:projection.groups.find(g=>g.group.id===d.id)?groupReadings(props.project,projection.groups.find(g=>g.group.id===d.id)!.group,props.frame):undefined,onExpand:()=>{const expanded=setGroupCollapsed(props.project,d.id,false);void diagramPositions(expanded).then(positions=>props.onGroupChange(p=>moveDiagramItems(setGroupCollapsed(p,d.id,false),positions)))}, height:projection.groups.find(g=>g.group.id===d.id)?.height??180, reading: props.frame?.devices[d.id], ac:props.frame?.measurements?.[d.id]?.ac, severity:severity(d.id), index, probeMode: props.probeMode, onPort: (id,port)=>{if(projection.groups.some(g=>g.group.id===id)){const split=port.lastIndexOf(':');props.onPort(port.slice(0,split),port.slice(split+1))}else props.onPort(id,port)} } })), [projection, props.frame, props.selectedIds, props.probeMode, props.onPort, dragPositions,props.findings])
  const edges = useMemo<Edge[]>(() => displayed.wires.map(w => ({ id: w.id, type: 'conductor', source: w.from, target: w.to, sourceHandle: w.fromPort, targetHandle: w.toPort, selected: props.selectedIds.includes(w.id), data: { wire: w, severity:severity(w.id), reading: props.frame?.wires[w.id], running: props.running, labels: props.labels } })), [projection, props.frame, props.selectedIds, props.running, props.labels,props.findings])
  useEffect(() => { const t = setTimeout(() => flow.fitView({ padding: diagramPadding, duration: 500 }), 150); return () => clearTimeout(t) }, [props.project.id,projection.groups.length])
  useEffect(() => { if (props.focusId) flow.fitView({ nodes: [{ id: projection.targetMap[props.focusId]??props.focusId }], padding: .8, duration: 650, maxZoom: 1.5 }) }, [props.focusId])
  const layout = useCallback(async (mode:'layered'|'compact'|'screen'='screen') => {
    const rect=diagram.current?.getBoundingClientRect()
    props.onLayout(await diagramPositions(props.project,mode,{width:rect?.width??1000,height:rect?.height??600}))
    setTimeout(() => flow.fitView({ duration: 600, padding: diagramPadding }), 100)
  }, [props.project])
  return <div className={`schematic-wrap ${hasWarnings?'has-warning-callouts':''}`} data-testid="schematic"><div className="schematic-diagram" ref={diagram}>
    <ReactFlow onNodeContextMenu={(event,node)=>openMenu(event,node.id,true)} onEdgeContextMenu={(event,edge)=>openMenu(event,edge.id,false)} onPaneContextMenu={()=>setMenu(null)} onMoveStart={()=>setMenu(null)} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} connectionMode={ConnectionMode.Loose} onConnect={c=>{const endpoint=(id:string,port:string|null)=>{if(!projection.groups.some(g=>g.group.id===id)||!port)return {id,port};const split=port.lastIndexOf(':');return {id:port.slice(0,split),port:port.slice(split+1)}};const a=endpoint(c.source,c.sourceHandle),b=endpoint(c.target,c.targetHandle);props.onConnect({...c,source:a.id,sourceHandle:a.port,target:b.id,targetHandle:b.port})}} onNodeClick={(e, n) => {if(!e.ctrlKey&&!e.metaKey)props.onSelect(n.id)}} onEdgeClick={(event, e) => {if(!event.ctrlKey&&!event.metaKey)props.onSelect(e.id)}} onPaneClick={() => props.onSelect(null)} onNodeDragStop={(_, n,group) => {props.onMoveMany(Object.fromEntries((group.length?group:[n]).map(d=>[d.id,d.position])));setDragPositions({})}} onNodesDelete={ns => props.onDelete(ns.map(n => n.id))} onEdgesDelete={es => props.onDelete(es.map(e => e.id))} onNodesChange={changes=>{const positions:Record<string,{x:number;y:number}>={};for(const c of changes)if(c.type==='position'&&c.position){if(c.dragging===undefined)positions[c.id]=c.position;else setDragPositions(previous=>({...previous,[c.id]:c.position!}))}if(changes.some(c=>c.type==='select'))props.onSelection(previous=>{const ids=new Set(previous);for(const c of changes)if(c.type==='select'){if(c.selected)ids.add(c.id);else ids.delete(c.id)}return [...ids]});if(Object.keys(positions).length)props.onMoveMany(positions)}} onEdgesChange={changes=>{if(changes.some(c=>c.type==='select'))props.onSelection(previous=>{const ids=new Set(previous);for(const c of changes)if(c.type==='select'){if(c.selected)ids.add(c.id);else ids.delete(c.id)}return [...ids]})}} fitView fitViewOptions={{padding:diagramPadding}} minZoom={.01} maxZoom={2.5} panOnScroll={false} zoomOnScroll selectionOnDrag multiSelectionKeyCode={['Control','Meta']} panOnDrag={[1, 2]} deleteKeyCode={props.selectedIds.length>1||props.selectedIds.some(id=>props.project.groups?.some(g=>g.id===id))?null:['Backspace','Delete']} proOptions={{ hideAttribution: true }} snapToGrid snapGrid={[10,10]} connectionRadius={25}>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#c8d0c7" />
    </ReactFlow>
    <div className="diagram-groups">{props.project.groups?.map(g=><button key={g.id} className="quiet-button" onClick={()=>props.onSelect(g.id)} title="Open array/bank settings, expand or extract individual equipment">{g.name} / {g.collapsed?'grouped':'expanded'}</button>)}</div><div className="canvas-key"><MousePointer2 size={13}/><span>Select</span><span className="key-dot">·</span><Move size={13}/><span>Wheel: zoom / Ctrl: vertical / Shift: horizontal</span><span className="key-dot">·</span><Cable size={13}/><span>Drag between terminals</span></div>
    <div className="canvas-controls"><button aria-label="Auto arrange" title="Auto arrange diagram" onClick={()=>void layout()}><Scan size={17}/></button><details className="arrange-options"><summary title="Choose diagram organisation" aria-label="Arrangement options">Options</summary><div><button onClick={()=>void layout('compact')}>Compact layers</button><button onClick={()=>void layout('screen')}>Arrange for screen</button><small>Changes diagram positions; electrical connections are retained.</small></div></details><span/><button aria-label="Zoom out" onClick={() => flow.zoomOut({ duration: 200 })}><Minus size={17}/></button><button aria-label="Zoom in" onClick={() => flow.zoomIn({ duration: 200 })}><Plus size={17}/></button><button aria-label="Fit system" onClick={() => flow.fitView({ padding: diagramPadding, duration: 500 })}><Maximize2 size={17}/></button></div>
  {menu&&<div ref={menuRef} className="grid-context-menu" role="menu" aria-label="Grid item actions" style={{left:menu.x,top:menu.y}} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const items=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));const index=items.indexOf(document.activeElement as HTMLButtonElement);items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus()}}}>{menu.equipment&&<button role="menuitem" onClick={()=>{props.onDuplicate(menu.ids);setMenu(null)}}>Duplicate</button>}<button role="menuitem" onClick={()=>{props.onDelete(menu.ids);setMenu(null)}}>Delete</button><button role="menuitem" onClick={()=>setMenu(null)}>Close</button></div>}
  </div>{hasWarnings&&<WarningCallouts project={props.project} displayProject={displayed} targetMap={projection.targetMap} nodes={nodes} findings={props.findings} onSelect={id=>{const owner=props.project.groups?.find(g=>g.collapsed&&g.members.includes(id??''));if(owner)props.onGroupChange(setGroupCollapsed(props.project,owner.id,false));props.onSelect(id)}} onDiagnostics={props.onDiagnostics} onFix={props.onFix}/>}</div>
}
export function Schematic(props: Props) { return <ReactFlowProvider><Canvas {...props}/></ReactFlowProvider> }




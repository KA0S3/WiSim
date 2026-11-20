import {FaultLeaders} from './FaultLeaders'
import { WireDialog } from './WireDialog'
import { memo, useCallback, useEffect, useMemo, useRef,useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Handle, Position, ConnectionMode, BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, useUpdateNodeInternals, type NodeProps, type EdgeProps, type Connection, type Node, type Edge } from '@xyflow/react'
import { Plus, Minus, Scan, Copy, Trash2, X, Move, MousePointer2, Cable, Maximize2 } from 'lucide-react'
import {diagramPositions} from './diagram-layout'
import {moveDiagramItems} from './equipment-groups'
import { EquipmentArt } from './EquipmentArt'
import {schematicProjection,groupReadings,setGroupCollapsed} from './equipment-groups'
import { definitions, type Device, type EquipmentGroup, type Frame, type Finding, type Project, type Wire } from './model'
import '@xyflow/react/dist/style.css'

type EquipmentData = { onFindFault?:()=>void; highlightedPorts?: ReadonlySet<string>; device: Device; group?:EquipmentGroup;groupReading?:ReturnType<typeof groupReadings>;height?:number;onExpand?:()=>void; reading?: Frame['devices'][string]; ac?:boolean; severity?:'fault'|'warning'; index: number; probeMode: boolean; onPort: (id: string, port: string) => void; [key: string]: unknown }
type EquipmentNode = Node<EquipmentData>
const position = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom }
function usePortMeasurements(d:Device,height=180){
 const update=useUpdateNodeInternals(),signature=JSON.stringify([height,d.ports.map(p=>[p.id,p.side,p.offset])])
 useEffect(()=>{const frame=requestAnimationFrame(()=>update(d.id));return()=>cancelAnimationFrame(frame)},[d.id,signature,update])
}
const Equipment = memo(({ data, selected }: NodeProps<EquipmentNode>) => {
  const d = data.device, r = data.reading, definition = definitions[d.kind]
  usePortMeasurements(d)
  return <div className={`equipment-node ${selected ? 'selected' : ''} ${!d.on ? 'is-off' : ''} ${data.severity?'has-'+data.severity:''}`} style={{ '--equipment-color': definition.color } as React.CSSProperties}>
    {data.severity&&<button type="button" className={`node-issue nodrag nopan ${data.severity}`} title="Click to find this issue in Diagnostics" aria-label={`Find ${data.severity} on ${d.name}`} onClick={event=>{event.stopPropagation();data.onFindFault?.()}}>!</button>}
    <div className="node-topline"><span>{definition.label.toUpperCase()}</span><span className={`state-dot ${r?.state ?? 'idle'}`} /></div>
    <EquipmentArt kind={d.kind} />
    <div className="node-name" title={d.name}>{d.name}</div>
    <div className="node-reading"><span>{r ? `${Math.abs(r.voltage).toFixed(1)} V` : '— V'}</span><span>{!d.on ? 'OFF' : r?.state === 'tripped' ? 'TRIPPED' : r ? `${Math.abs(r.power) >= 1000 ? (Math.abs(r.power)/1000).toFixed(2) + ' kW' : Math.abs(r.power).toFixed(0) + ' W'}` : 'Connecting'}</span></div>
    {d.ports.map(port => <Handle key={port.id} id={port.id} type="source" position={position[port.side]} className={`electrical-port ${port.domain} ${data.highlightedPorts?.has(port.id) ? "linked-port" : ""} ${data.probeMode ? 'probe-target' : ''}`} style={{ [port.side === 'left' || port.side === 'right' ? 'top' : 'left']: `${port.offset * 100}%` }} onClick={e => { if (data.probeMode) { e.stopPropagation(); data.onPort(d.id, port.id) } }} title={`${d.name} · ${port.label}`} aria-label={`${d.name} terminal ${port.label}`}><span className={`port-caption ${port.side}`}>{port.label}</span></Handle>)}
  </div>
})
function LiveReadings({device:d,frame}:{device:Device;frame:Frame|null}) {
  const r=frame?.devices[d.id], ac=frame?.measurements?.[d.id]?.ac
  return <div className="equipment-live-tooltip" role="tooltip" aria-label={d.name+' live readings'}><strong>{d.reference?d.reference+' / ':''}{d.name}</strong><div><span>{ac?'RMS voltage':'Terminal voltage'}</span><output>{r?r.voltage.toFixed(2):'--'} V</output></div><div><span>{ac?'RMS current':'Current'}</span><output>{r?r.current.toFixed(2):'--'} A</output></div><div><span>Active power</span><output aria-label="Live active power">{r?r.power.toFixed(1):'--'} W</output></div>{r?.soc!==undefined&&<div><span>Battery charge</span><output>{r.soc.toFixed(2)}%</output></div>}{r?.inputPower!==undefined&&<div><span>{d.kind==='mppt'?'PV input':'AC input'}</span><output>{r.inputPower.toFixed(1)} W</output></div>}</div>
}
const Conductor = memo((props: EdgeProps) => {
  const data = props.data as { wire: Wire; reading?: Frame['wires'][string]; running: boolean; labels: boolean; highlighted?:boolean; severity?:string } | undefined
  const [path, x, y] = getSmoothStepPath({ ...props, borderRadius: 7, offset: 27 })
  const active = data?.running && Math.abs(data.reading?.current ?? 0) > .01
  return <>{data?.severity&&<BaseEdge id={props.id+'-warning'} interactionWidth={0} path={path} style={{stroke:data.severity==='fault'?'#c54f3d':'#d49c25',strokeWidth:8,opacity:.3}}/>}<BaseEdge id={props.id} path={path} style={{ stroke: props.selected ? '#1c7165' : data?.wire.color ?? '#84958c', strokeWidth: props.selected ? 3 : 1.8, opacity: data?.reading ? .8 : .45 }} className={data?.highlighted ? "conductor-stroke linked-conductor" : "conductor-stroke"} interactionWidth={14}/>{active && <path d={path} className="flow-dashes" style={{ stroke: data?.wire.color, animationDirection: (data?.reading?.current ?? 0) < 0 ? 'reverse' : 'normal' }} />}{(props.selected || data?.labels) && <EdgeLabelRenderer><div className="wire-badge" style={{ transform: `translate(-50%, -50%) translate(${x}px,${y}px)` }}>{data?.wire.area} mm² <span>· {data?.reading ? Math.abs(data.reading.current).toFixed(1) : '—'} A</span></div></EdgeLabelRenderer>}</>
})
const GroupEquipment=memo(({data,selected}:NodeProps<EquipmentNode>)=>{
 const d=data.device,g=data.group!,r=data.groupReading!
 usePortMeasurements(d,data.height)
 return <div className={`equipment-node grouped-equipment ${selected?'selected':''} ${data.severity?'has-'+data.severity:''}`} style={{height:data.height,'--equipment-color':definitions[d.kind].color} as React.CSSProperties}>
  {data.severity&&<button type="button" className={`node-issue nodrag nopan ${data.severity}`} title="Click to find this issue in Diagnostics" aria-label={`Find ${data.severity} on ${d.name}`} onClick={event=>{event.stopPropagation();data.onFindFault?.()}}>!</button>}
  <div className="node-topline"><span>{g.kind==='pv-array'?'PV ARRAY':g.kind==='conversion-stack'?'CONVERSION STACK':'BATTERY BANK'}</span><b>{r.count} units</b></div><EquipmentArt kind={d.kind}/><div className="node-name" title={g.name}>{g.name}</div><div className="group-power" title="Sum of actual source power before internal cable and fuse losses">{r.power===undefined?'--':r.power.toFixed(0)} W</div><button className="nodrag nopan group-expand" title="Show individual equipment and all internal wiring" onClick={e=>{e.stopPropagation();data.onExpand?.()}}>Expand / {g.members.length} items</button>
  {d.ports.map(port=><Handle key={port.id} id={port.id} type="source" position={position[port.side]} className={`electrical-port ${port.domain} ${data.highlightedPorts?.has(port.id) ? "linked-port" : ""} ${data.probeMode?'probe-target':''}`} style={{top:`${port.offset*100}%`}} title={port.label} aria-label={`${d.name} terminal ${port.label}`} onClick={e=>{if(data.probeMode){e.stopPropagation();data.onPort(d.id,port.id)}}}><span className={`port-caption ${port.side}`}>{port.label}</span></Handle>)}
 </div>
})
const nodeTypes = { equipment: Equipment,bankArray:GroupEquipment }, edgeTypes = { conductor: Conductor }

type Props = { onFindFault:(id:string)=>void; showFaultLeaders:boolean; onDuplicate:(ids:string[])=>void; project: Project; onGroupChange:(p:Project|((p:Project)=>Project))=>void; findings:Finding[]; frame: Frame | null; selected: string | null; selectedIds:string[];onSelection:(ids:string[]|((previous:string[])=>string[]))=>void;onMoveMany:(positions:Record<string,{x:number;y:number}>)=>void;onSelect: (id: string | null) => void; onConnect: (c: Connection) => void; onMove: (id: string, x: number, y: number) => void; onDelete: (ids: string[]) => void; running: boolean; probeMode: boolean; onPort: (id: string, port: string) => void; focusId: string | null; labels: boolean; onLayout: (positions: Record<string, { x: number; y: number }>) => void }
function Canvas(props: Props) {
  const flow = useReactFlow()
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [menu,setMenu]=useState<{ids:string[];equipment:boolean}|null>(null)
  const [detailsSide,setDetailsSide]=useState<'left'|'right'>('right')
  const placeDetails=(clientX:number)=>{
    const rect=diagram.current?.getBoundingClientRect()
    if(rect)setDetailsSide(clientX<rect.left+rect.width/2?'right':'left')
  }
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
    placeDetails(event.clientX)
    setMenu({ids,equipment})
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
  const findingFor=(id:string)=>props.findings.filter(f=>f.target&&(projection.targetMap[f.target]??f.target)===id).find(f=>f.severity==='fault')??props.findings.find(f=>f.target&&(projection.targetMap[f.target]??f.target)===id&&f.severity==='warning')
  const severity=(id:string)=>props.findings.some(f=>(projection.targetMap[f.target??'']??f.target)===id&&f.severity==='fault')?'fault':!props.showFaultLeaders&&props.findings.some(f=>(projection.targetMap[f.target??'']??f.target)===id&&f.severity==='warning')?'warning':undefined
  const hoveredDevice = displayed.devices.find(d => d.id === hoveredNode && !projection.groups.some(g => g.group.id === d.id))
  const menuWire=menu?.ids.length===1?displayed.wires.find(w=>w.id===menu.ids[0]):undefined
  const endpointName=(id:string,port:string)=>(displayed.devices.find(d=>d.id===id)?.name??id)+' / '+port
  const highlighted = useMemo(() => {
    const wires = new Set<string>()
    const ports = new Map<string, Set<string>>()
    function markPort(id: string, port: string) {
      const marked = ports.get(id) ?? new Set<string>()
      marked.add(port)
      ports.set(id, marked)
    }
    for (const wire of displayed.wires) {
      if (wire.from !== hoveredNode && wire.to !== hoveredNode) continue
      wires.add(wire.id)
      markPort(wire.from, wire.fromPort)
      markPort(wire.to, wire.toPort)
    }
    return { wires, ports }
  }, [displayed, hoveredNode])
  const nodes = useMemo<EquipmentNode[]>(() => displayed.devices.map((d, index) => ({ id: d.id, type: projection.groups.some(g=>g.group.id===d.id)?'bankArray':'equipment', width: 210, height: projection.groups.find(g=>g.group.id===d.id)?.height??180, measured:{width:210,height:projection.groups.find(g=>g.group.id===d.id)?.height??180}, position: dragPositions[d.id] ?? { x: d.x, y: d.y }, selected: props.selectedIds.includes(d.id), data: { device: d, highlightedPorts:highlighted.ports.get(d.id), group:projection.groups.find(g=>g.group.id===d.id)?.group, groupReading:projection.groups.find(g=>g.group.id===d.id)?groupReadings(props.project,projection.groups.find(g=>g.group.id===d.id)!.group,props.frame):undefined,onExpand:()=>{const expanded=setGroupCollapsed(props.project,d.id,false);void diagramPositions(expanded).then(positions=>props.onGroupChange(p=>moveDiagramItems(setGroupCollapsed(p,d.id,false),positions)))}, height:projection.groups.find(g=>g.group.id===d.id)?.height??180, reading: props.frame?.devices[d.id], ac:props.frame?.measurements?.[d.id]?.ac, severity:severity(d.id), onFindFault:()=>{const finding=findingFor(d.id);if(finding)props.onFindFault(finding.id)}, index, probeMode: props.probeMode, onPort: (id,port)=>{if(projection.groups.some(g=>g.group.id===id)){const split=port.lastIndexOf(':');props.onPort(port.slice(0,split),port.slice(split+1))}else props.onPort(id,port)} } })), [projection, props.frame, props.selectedIds, props.probeMode, props.onPort, dragPositions,props.findings,props.showFaultLeaders,props.onFindFault,highlighted])
  const edges = useMemo<Edge[]>(() => displayed.wires.map(w => ({ id: w.id, type: 'conductor', source: w.from, target: w.to, sourceHandle: w.fromPort, targetHandle: w.toPort, selected: props.selectedIds.includes(w.id), data: { wire: w, severity:severity(w.id), reading: props.frame?.wires[w.id], running: props.running, labels: props.labels, highlighted:highlighted.wires.has(w.id) } })), [projection, props.frame, props.selectedIds, props.running, props.labels,props.findings,props.showFaultLeaders,props.onFindFault,highlighted])
  useEffect(() => { const t = setTimeout(() => flow.fitView({ padding: diagramPadding, duration: 500 }), 150); return () => clearTimeout(t) }, [props.project.id,projection.groups.length])
  useEffect(() => {
    if (!props.showFaultLeaders) return
    const timer = setTimeout(() => void flow.fitView({padding: diagramPadding, duration: 250}),120)
    return () => clearTimeout(timer)
  }, [props.showFaultLeaders, flow])
  useEffect(() => { if (props.focusId) flow.fitView({ nodes: (props.project.wires.filter(w=>w.id===props.focusId).flatMap(w=>[w.from,w.to]).concat(props.focusId)).map(id=>({id:projection.targetMap[id]??id})), padding: .8, duration: 650, maxZoom: 1.5 }) }, [props.focusId])
  const layout = useCallback(async () => {
    const rect=diagram.current?.getBoundingClientRect()
    props.onLayout(await diagramPositions(props.project,'screen',{width:rect?.width??1000,height:rect?.height??600}))
    setTimeout(() => flow.fitView({ duration: 600, padding: diagramPadding }), 100)
  }, [props.project])
  return <div className="schematic-wrap" data-testid="schematic"><div className="schematic-board"><div className="schematic-diagram" ref={diagram}>{props.showFaultLeaders&&<FaultLeaders targetMap={projection.targetMap}/>}
    <ReactFlow onNodeMouseEnter={(event,node)=>{setHoveredNode(node.id);if(!menu)placeDetails(event.clientX)}} onNodeMouseLeave={()=>setHoveredNode(null)} onNodeContextMenu={(event,node)=>openMenu(event,node.id,true)} onEdgeContextMenu={(event,edge)=>openMenu(event,edge.id,false)} onPaneContextMenu={()=>setMenu(null)} onMoveStart={()=>setMenu(null)} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} connectionMode={ConnectionMode.Loose} onConnect={c=>{const endpoint=(id:string,port:string|null)=>{if(!projection.groups.some(g=>g.group.id===id)||!port)return {id,port};const split=port.lastIndexOf(':');return {id:port.slice(0,split),port:port.slice(split+1)}};const a=endpoint(c.source,c.sourceHandle),b=endpoint(c.target,c.targetHandle);props.onConnect({...c,source:a.id,sourceHandle:a.port,target:b.id,targetHandle:b.port})}} onNodeClick={(e, n) => {if(!e.ctrlKey&&!e.metaKey)props.onSelect(n.id)}} onEdgeClick={(event, e) => {if(!event.ctrlKey&&!event.metaKey)props.onSelect(e.id)}} onPaneClick={() => props.onSelect(null)} onNodeDragStop={(_, n,group) => {props.onMoveMany(Object.fromEntries((group.length?group:[n]).map(d=>[d.id,d.position])));setDragPositions({})}} onNodesDelete={ns => props.onDelete(ns.map(n => n.id))} onEdgesDelete={es => props.onDelete(es.map(e => e.id))} onNodesChange={changes=>{const positions:Record<string,{x:number;y:number}>={};for(const c of changes)if(c.type==='position'&&c.position){if(c.dragging===undefined)positions[c.id]=c.position;else setDragPositions(previous=>({...previous,[c.id]:c.position!}))}if(changes.some(c=>c.type==='select'))props.onSelection(previous=>{const ids=new Set(previous);for(const c of changes)if(c.type==='select'){if(c.selected)ids.add(c.id);else ids.delete(c.id)}return [...ids]});if(Object.keys(positions).length)props.onMoveMany(positions)}} onEdgesChange={changes=>{if(changes.some(c=>c.type==='select'))props.onSelection(previous=>{const ids=new Set(previous);for(const c of changes)if(c.type==='select'){if(c.selected)ids.add(c.id);else ids.delete(c.id)}return [...ids]})}} fitView fitViewOptions={{padding:diagramPadding}} minZoom={.01} maxZoom={2.5} panOnScroll={false} zoomOnScroll selectionOnDrag multiSelectionKeyCode={['Control','Meta']} panOnDrag={[1, 2]} deleteKeyCode={props.selectedIds.length>1||props.selectedIds.some(id=>props.project.groups?.some(g=>g.id===id))?null:['Backspace','Delete']} proOptions={{ hideAttribution: true }} snapToGrid snapGrid={[10,10]} connectionRadius={25}>
      <Background id="drafting-minor" variant={BackgroundVariant.Dots} gap={10} size={.65} color="#b6c4bb" />
      <Background id="drafting-major" variant={BackgroundVariant.Lines} gap={50} color="#b4c4b866" />
    </ReactFlow>
    <div className="diagram-groups">{props.project.groups?.map(g=><button key={g.id} className="quiet-button" onClick={()=>props.onSelect(g.id)} title="Open array/bank settings, expand or extract individual equipment">{g.name} / {g.collapsed?'grouped':'expanded'}</button>)}</div><div className="canvas-key"><MousePointer2 size={13}/><span>Select</span><span className="key-dot">·</span><Move size={13}/><span>Wheel: zoom / Ctrl: vertical / Shift: horizontal</span><span className="key-dot">·</span><Cable size={13}/><span>Drag between terminals</span></div>
    <div className="canvas-controls"><WireDialog project={props.project} onConnect={props.onConnect}/><button aria-label="Auto arrange" title="Auto arrange diagram" onClick={()=>void layout()}><Scan size={17}/></button><span/><button aria-label="Zoom out" onClick={() => flow.zoomOut({ duration: 200 })}><Minus size={17}/></button><button aria-label="Zoom in" onClick={() => flow.zoomIn({ duration: 200 })}><Plus size={17}/></button><button aria-label="Fit system" onClick={() => flow.fitView({ padding: diagramPadding, duration: 500 })}><Maximize2 size={17}/></button></div>
  </div></div>
    {(menu||hoveredDevice)&&<div className={`schematic-details ${detailsSide} ${menu?'has-menu':''}`}>{menu ? <div ref={menuRef} className="grid-context-menu" role="menu" aria-label="Grid item actions" onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const items=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));const index=items.indexOf(document.activeElement as HTMLButtonElement);items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus()}}}><div className="menu-subject">{menu.ids.length>1?menu.ids.length+" items selected":displayed.devices.find(d=>d.id===menu.ids[0])?.name??"Conductor"}{menuWire&&<small>{endpointName(menuWire.from,menuWire.fromPort)}<br/>{endpointName(menuWire.to,menuWire.toPort)}</small>}</div>

    <button role="menuitem" onClick={()=>{
      const ids=new Set(menu.ids)
      for(const wire of displayed.wires)if(ids.has(wire.id)){ids.add(wire.from);ids.add(wire.to)}
      void flow.fitView({nodes:displayed.devices.filter(d=>ids.has(d.id)).map(d=>({id:d.id})),padding:.35,maxZoom:1.5,duration:350})
      setMenu(null)
    }}><Scan size={15}/>{menu.equipment||menu.ids.length>1?'Focus selection':'Show endpoints'}</button>
    {findingFor(menu.ids[0])&&<button role="menuitem" onClick={()=>{const finding=findingFor(menu.ids[0]);if(finding)props.onFindFault(finding.id);setMenu(null)}}>Find issue in Diagnostics</button>}
    {menu.equipment&&<button role="menuitem" onClick={()=>{props.onDuplicate(menu.ids);setMenu(null)}}><Copy size={15}/>Duplicate</button>}
    <button role="menuitem" className="menu-delete" onClick={()=>{props.onDelete(menu.ids);setMenu(null)}}><Trash2 size={15}/>Delete</button>
    <button role="menuitem" onClick={()=>setMenu(null)}><X size={15}/>Close</button></div> : hoveredDevice ? <LiveReadings device={hoveredDevice} frame={props.frame}/> : null}</div>}
  </div>
}
export function Schematic(props: Props) { return <ReactFlowProvider><Canvas {...props}/></ReactFlowProvider> }




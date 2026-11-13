import { memo, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Grid, OrbitControls, RoundedBox, Line } from '@react-three/drei'
import { Vector3, MOUSE, TOUCH, Box3 } from 'three'
import { Ruler } from 'lucide-react'
import { type Device, type Project, type Structure } from './model'

import { synchronizeLengths, localTerminalPosition, terminalPosition, physicalWirePoints, moveEquipment, setWireRoute, insertWireBend, type Point3 } from './geometry'

import {physicalProfile} from './profiles'
import {SolarEditor} from './SolarEditor'
import { SpaceEditor } from './SpaceEditor'
import { deviceCenter, transformPoint, updateStructure, shellThickness, orientation } from './spatial'
import { Translation, type Axis } from './Translation'
import type { Connection } from '@xyflow/react'

function portPosition(d: Device, portId: string): [number, number, number] {
  return terminalPosition(d,portId)
}

function StructureBody({structure:s,selected,onSelect,active,axis,onPreview,onCommit,onCancel}:{structure:Structure;selected:boolean;onSelect:(id:string)=>void;active:boolean;axis:Axis;onPreview:(p:Point3)=>void;onCommit:(p:Point3)=>void;onCancel:()=>void}) {
  const [w,h,d]=s.size,t=shellThickness(s)
  const panel=(position:Point3,size:Point3,key:string)=><mesh key={key} position={position} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={selected?'#9bb9ae':s.color} transparent opacity={.55} depthWrite={false} roughness={.7}/></mesh>
  return <Translation position={s.position} active={active} axis={axis} onPreview={onPreview} onCommit={onCommit} onCancel={onCancel}><group rotation={s.rotation} onClick={e=>{e.stopPropagation();onSelect(s.id)}}>
    {s.kind==='box'?<>{panel([0,0,-d/2+t/2],[w,h,t],'back')}{panel([-w/2+t/2,0,0],[t,h,d],'left')}{panel([w/2-t/2,0,0],[t,h,d],'right')}{panel([0,h/2-t/2,0],[w,t,d],'top')}{panel([0,-h/2+t/2,0],[w,t,d],'bottom')}</>:panel([0,0,0],s.size,'face')}
    {selected&&<mesh><boxGeometry args={s.size}/><meshBasicMaterial color="#267663" wireframe/></mesh>}
  </group></Translation>
}

type Mode='camera'|'move'|'connect'
type CameraCommand={view:string;sequence:number}
type PhysicalProps={project:Project;selected:string|null;onSelect:(id:string|null)=>void;onMove:(id:string,p:Point3)=>void;onRoute:(id:string,route:Point3[])=>void;onConnect:(c:Connection)=>void;onProject:(p:Project)=>void;focusId?:string|null}

function Scene({project,selected,onSelect,mode,axis,command,onPreview,onMove,onCancel,onRoutePreview,onRoute,onPort,bend,setBend,onStructurePreview,onStructureMove}:{project:Project;selected:string|null;onSelect:PhysicalProps['onSelect'];mode:Mode;axis:Axis;command:CameraCommand;onPreview:PhysicalProps['onMove'];onMove:PhysicalProps['onMove'];onCancel:()=>void;onRoutePreview:PhysicalProps['onRoute'];onRoute:PhysicalProps['onRoute'];onPort:(id:string,port:string)=>void;bend:number;setBend:(n:number)=>void;onStructurePreview:(id:string,p:Point3)=>void;onStructureMove:(id:string,p:Point3)=>void}) {
  const {camera}=useThree(),controls=useRef<any>(null)
  useEffect(()=>{
    const device=project.devices.find(d=>d.id===selected)
    const devices=command.view==='focus'?(device?[device]:project.structures?.some(s=>s.id===selected)?[]:project.devices):project.devices
    const bounds=new Box3()
    for(const d of devices)for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])bounds.expandByPoint(new Vector3(...transformPoint([d.spec.width*x,d.spec.height*y,d.spec.depth*z],deviceCenter(d),d.rotation)))
    for(const s of project.structures??[]){if(command.view==='focus'&&selected!==s.id)continue;for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])bounds.expandByPoint(new Vector3(...transformPoint([s.size[0]*x,s.size[1]*y,s.size[2]*z],s.position,s.rotation)))}
    if(command.view!=='focus')for(const w of project.wires)for(const point of physicalWirePoints(project,w))bounds.expandByPoint(new Vector3(...point))
    const target=bounds.isEmpty()?new Vector3(0,.4,0):bounds.getCenter(new Vector3()),radius=bounds.isEmpty()?2:Math.max(.25,bounds.getSize(new Vector3()).length()/2)
    const distance=radius/Math.sin(20*Math.PI/180)*1.15
    const direction=command.view==='top'?new Vector3(0,1,.001):(command.view==='front'||command.view==='focus')?new Vector3(0,0,1):new Vector3(1,.8,1.2).normalize()
    // Consume pending orbit/pan/dolly deltas before an explicit camera command.
    // Otherwise damping can pull the newly focused object away from the centre.
    const orbit=controls.current,damping=orbit?.enableDamping
    if(orbit){orbit.enableDamping=false;orbit.update()}
    camera.position.copy(target.clone().addScaledVector(direction,distance));camera.lookAt(target);camera.far=Math.max(1000,distance*10);camera.updateProjectionMatrix()
    if(orbit){orbit.target.copy(target);orbit.update();orbit.enableDamping=damping}
  },[command,project.id])
  const wire=project.wires.find(w=>w.id===selected)
  return <><color attach="background" args={['#edf0e9']}/><ambientLight intensity={1.8}/><directionalLight position={[4,7,5]} intensity={2.5} castShadow/><directionalLight position={[-3,3,-2]} intensity={1}/>
    <Grid args={[20,20]} cellSize={.25} sectionSize={1} cellColor="#ccd3c8" sectionColor="#b8c4b7" fadeDistance={30} infiniteGrid/>
    {project.structures?.map(s=><StructureBody key={s.id} structure={s} selected={s.id===selected} onSelect={onSelect} active={mode==='move'&&s.id===selected} axis={axis} onPreview={p=>onStructurePreview(s.id,p)} onCommit={p=>onStructureMove(s.id,p)} onCancel={onCancel}/>)}
    {project.devices.map(d=><Equipment key={d.id} device={d} planeNormal={d.mount?new Vector3(0,0,1).applyQuaternion(orientation(project.structures?.find(s=>s.id===d.mount!.structureId)?.rotation)).toArray() as Point3:undefined} selected={d.id===selected} onSelect={onSelect} mode={mode} axis={axis} onPreview={onPreview} onMove={onMove} onCancel={onCancel} onPort={onPort}/>)}
    {project.wires.map(w=><Line key={w.id} points={physicalWirePoints(project,w)} color={w.color} lineWidth={selected===w.id?4:2} onClick={e=>{e.stopPropagation();onSelect(w.id)}}/>)}
    {wire?.route3d?.map((point,index)=><Translation key={`${wire.id}-${index}`} position={point} active={mode==='move'&&bend===index} axis={axis} onPreview={p=>onRoutePreview(wire.id,wire.route3d!.map((v,i)=>i===index?p:v))} onCommit={p=>onRoute(wire.id,wire.route3d!.map((v,i)=>i===index?p:v))} onCancel={onCancel}><mesh onClick={e=>{e.stopPropagation();setBend(index)}}><sphereGeometry args={[.035,16,16]}/><meshStandardMaterial color={index===bend?'#267663':'#c17d43'} depthTest={false}/></mesh></Translation>)}
    <ContactShadows frames={1} position={[0,.001,0]} opacity={.2} scale={15} blur={2} far={4}/>
    <OrbitControls ref={controls} makeDefault minDistance={.08} maxDistance={10000} maxPolarAngle={Math.PI-.001} enableDamping touches={{ONE:mode==='camera'?TOUCH.ROTATE:undefined,TWO:TOUCH.DOLLY_PAN}} mouseButtons={{LEFT:mode==='camera'?MOUSE.ROTATE:undefined,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.PAN}}/>
  </>
}

export default memo(function Physical({project,selected,onSelect,onMove,onRoute,onConnect,onProject,focusId}:PhysicalProps) {
  const [mode,setMode]=useState<Mode>('camera'),[axis,setAxis]=useState<Axis>('all'),[command,setCommand]=useState<CameraCommand>({view:'iso',sequence:0}),[draft,setDraft]=useState<Project|null>(null),[bend,setBend]=useState(0),[source,setSource]=useState<{id:string;port:string}|null>(null)
  const [controlsOpen,setControlsOpen]=useState(true)
  const cancel=useCallback(()=>setDraft(null),[])
  useEffect(()=>{setDraft(null)},[project])
  useEffect(()=>{setBend(0)},[selected])
  const previousFocus=useRef(focusId)
  useEffect(()=>{if(focusId&&focusId!==previousFocus.current)setCommand(c=>({view:'focus',sequence:c.sequence+1}));previousFocus.current=focusId},[focusId])
  const camera=(view:string)=>setCommand(c=>({view,sequence:c.sequence+1}))
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')||e.ctrlKey||e.metaKey||e.altKey)return
      const k=e.key.toLowerCase()
      if(mode==='move'&&selected&&e.key.startsWith('Arrow')){
        const coordinate=axis==='all'?(e.key==='ArrowUp'||e.key==='ArrowDown'?1:0):axis==='x'?0:axis==='y'?1:2
        const delta=(e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1)*(e.shiftKey?.1:.01)
        const device=project.devices.find(d=>d.id===selected),wire=project.wires.find(w=>w.id===selected)
        if(device){const p=[...device.physical] as Point3;p[coordinate]=Math.round((p[coordinate]+delta)*1e8)/1e8;onMove(device.id,p)}
        else if(project.structures?.some(s=>s.id===selected)){const structure=project.structures.find(s=>s.id===selected)!;const position=[...structure.position] as Point3;position[coordinate]+=delta;onProject(updateStructure(project,structure.id,{position}))}
        else if(wire?.route3d?.[bend])onRoute(wire.id,wire.route3d.map((p,i)=>i===bend?p.map((v,a)=>a===coordinate?Math.round((v+delta)*1e8)/1e8:v) as Point3:p))
        e.preventDefault()
      }
      if(k==='w'){cancel();setMode('move');e.preventDefault()}
      if(k==='v'){cancel();setMode('camera');e.preventDefault()}
      if(k==='c'){cancel();setMode('connect');e.preventDefault()}
      if(['x','y','z'].includes(k)){setAxis(a=>a===k?'all':k as Axis);e.preventDefault()}
      if(k==='f'){camera('focus');e.preventDefault()}
      if(e.key==='Home'){camera('iso');e.preventDefault()}
      if(e.key==='Escape'){setSource(null)}
    };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
  },[mode,selected,axis,project,bend,onMove,onRoute,onProject])
  const shown=draft??project,wire=shown.wires.find(w=>w.id===selected),device=shown.devices.find(d=>d.id===selected)
  const port=(id:string,port:string)=>{if(!source){setSource({id,port});return}if(source.id!==id||source.port!==port)onConnect({source:source.id,sourceHandle:source.port,target:id,targetHandle:port});setSource(null)}
  const routeCommit=(id:string,points:Point3[])=>{onRoute(id,points);setDraft(null)}
  return <div className="physical-view" data-mode={mode} data-axis={axis}>
    <Canvas frameloop="demand" shadows camera={{position:[3.8,3.5,5],fov:40}} dpr={[1,1.7]} gl={{antialias:true}}><Suspense fallback={null}><Scene project={shown} selected={selected} onSelect={onSelect} mode={mode} axis={axis} command={command} onPreview={(id,p)=>setDraft(moveEquipment(project,id,p))} onMove={(id,p)=>{onMove(id,p);setDraft(null)}} onCancel={cancel} onRoutePreview={(id,points)=>setDraft(setWireRoute(project,id,points))} onRoute={routeCommit} onPort={port} bend={bend} setBend={setBend} onStructurePreview={(id,position)=>setDraft(synchronizeLengths(updateStructure(project,id,{position})))} onStructureMove={(id,position)=>{onProject(updateStructure(project,id,{position}));setDraft(null)}}/></Suspense></Canvas>
    <button className="physical-controls-toggle" aria-expanded={controlsOpen} aria-controls="physical-editor" onClick={()=>setControlsOpen(v=>!v)}>{controlsOpen?'Hide 3D controls':'Show 3D controls'}</button>
    <div id="physical-editor" className={`physical-editor ${controlsOpen?'':'is-collapsed'}`}>
      <div className="physical-modes">{(['camera','move','connect'] as const).map((value,i)=><button key={value} title={value==='camera'?'V: left-drag to orbit. Right-drag pans; wheel zooms.':value==='move'?'W: drag the selected body or coloured arrows. Escape cancels; one Undo restores the movement.':'C: choose a source terminal, then select the destination equipment and terminal.'} aria-pressed={mode===value} onClick={()=>{setMode(value);setSource(null);cancel()}}>{value==='camera'?'Camera':value==='move'?'Move':'Connect'} <kbd>{['V','W','C'][i]}</kbd></button>)}</div>
      <label>Selection<select aria-label="3D selection" value={selected??''} onChange={e=>onSelect(e.target.value||null)}><option value="">Whole system</option>{project.structures?.map(s=><option key={s.id} value={s.id}>{s.name} (structure)</option>)}{project.devices.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}{project.wires.map((w,i)=><option key={w.id} value={w.id}>Wire {i+1} · {w.area} mm²</option>)}</select></label>
      {mode==='move'&&<div className="physical-axes">{(['all','x','y','z'] as const).map(a=><button key={a} title={a==='all'?'Drag in the viewing plane; mounted bodies slide on their surface. Axis arrows can change clearance.':'Constrain movement to the world '+a.toUpperCase()+' axis. Arrow keys nudge; Shift nudges 10 cm.'} aria-label={`Move axis ${a}`} aria-pressed={a===axis} onClick={()=>setAxis(a)}>{a.toUpperCase()}</button>)}<span>Drag body or arrows / Keys: 1 cm · Shift: 10 cm · Esc: cancel drag</span></div>}
      {wire&&<><output aria-label="3D cable length">{wire.length.toFixed(3)} m · {wire.lengthMode==='physical'?'measured route':'specified length'}</output><div><button onClick={()=>{routeCommit(wire.id,insertWireBend(project,wire.id));setMode('move')}}>Add wire bend</button>{!!wire.route3d?.length&&<><select aria-label="Wire bend" value={Math.min(bend,wire.route3d.length-1)} onChange={e=>setBend(+e.target.value)}>{wire.route3d.map((_,i)=><option key={i} value={i}>Bend {i+1}</option>)}</select><button onClick={()=>routeCommit(wire.id,wire.route3d!.filter((_,i)=>i!==bend))}>Remove bend</button></>}</div></>}
      {device&&<details className="attached-cables"><summary title="Movement keeps these terminal connections. Choose a cable to edit its route or length mode.">Attached cables ({project.wires.filter(w=>w.from===device.id||w.to===device.id).length})</summary>{project.wires.filter(w=>w.from===device.id||w.to===device.id).map(w=><button key={w.id} onClick={()=>onSelect(w.id)}>{w.reference??'Cable'} / {w.from===device.id?w.fromPort:w.toPort} / {(shown.wires.find(a=>a.id===w.id)?.length??w.length).toFixed(2)} m {w.lengthMode==='physical'?'measured':'specified'}</button>)}</details>}
      {device&&<output aria-label="3D equipment position">X {device.physical[0].toFixed(2)} · Y {device.physical[1].toFixed(2)} · Z {device.physical[2].toFixed(2)} m</output>}
      {mode==='connect'&&device&&<div className="physical-axes">{device.ports.map(p=><button key={p.id} aria-label={`Connect ${device.name} terminal ${p.label}`} onClick={()=>port(device.id,p.id)}>{p.label}</button>)}</div>}
      {mode==='connect'&&<p>{source?`From ${project.devices.find(d=>d.id===source.id)?.name} / ${source.port}. Select the destination equipment and terminal.`:'Select equipment, then click a terminal to start a measured conductor.'}</p>}
      <SolarEditor project={shown} selected={selected} onChange={onProject}/>
      <SpaceEditor project={shown} selected={selected} onChange={onProject} onSelect={onSelect}/>
      <small>{mode==='camera'?'Left drag: orbit · ':''}Right drag: pan · Wheel: zoom · F: focus · Home: fit</small>
    </div>
    <div className="physical-view-controls">{[['iso','Perspective'],['front','Front'],['top','Top'],['focus','Focus selected']].map(([value,label])=><button key={value} onClick={()=>camera(value)} disabled={value==='focus'&&!selected}>{label}</button>)}</div>
    <div className="physical-note"><Ruler size={14}/><span>Metres · 1 m major grid · 25 cm subdivisions</span></div>
  </div>
})
export function Equipment({ device:d,planeNormal,selected,onSelect,mode,axis,onPreview,onMove,onCancel,onPort }:{device:Device;planeNormal?:Point3;selected:boolean;onSelect:(id:string)=>void;mode:Mode;axis:Axis;onPreview:(id:string,p:Point3)=>void;onMove:(id:string,p:Point3)=>void;onCancel:()=>void;onPort:(id:string,port:string)=>void}) {
  const profile=physicalProfile(d.physicalProfile)
  const s=d.spec,converter=d.kind==='inverter'||d.kind==='mppt'||d.kind==='charger'
  const [hovered,setHovered]=useState(false)
  const body = <group rotation={d.rotation??[0,0,0]} onPointerOver={()=>setHovered(true)} onPointerOut={()=>setHovered(false)} onClick={e => { e.stopPropagation(); onSelect(d.id) }}>
    <RoundedBox args={[s.width, s.height, s.depth]} radius={Math.min(.015, s.width/4,s.height/4,s.depth/4)} smoothness={3} castShadow receiveShadow><meshStandardMaterial color={d.kind==='pv'?'#24485d':profile?.color??(d.kind === 'battery' ? '#e2e5db' : converter ? '#2b7fad' : '#bcc7bc')} roughness={.45} metalness={.12}/></RoundedBox>
    {converter && <><mesh position={[0, s.height * .2, s.depth / 2 + .002]}><boxGeometry args={[s.width * .65, s.height * .18, .008]}/><meshStandardMaterial color="#dfe7e0"/></mesh><mesh position={[-s.width * .07, s.height * .2, s.depth / 2 + .01]}><boxGeometry args={[s.width * .35, s.height * .09, .005]}/><meshStandardMaterial color="#344e4e"/></mesh>{[0,1,2,3,4].map(i => <mesh key={i} position={[0, -s.height * (.04 + .065*i), s.depth / 2 + .002]}><boxGeometry args={[s.width * .65, .006, .008]}/><meshStandardMaterial color="#1a5c89"/></mesh>)}</>}
    {profile?.style==='blue-battery'&&<mesh position={[0,s.height*.44,0]}><boxGeometry args={[s.width*.98,s.height*.12,s.depth*.98]}/><meshStandardMaterial color="#acb5ba"/></mesh>}
    {profile?.style==='solar-frame'&&<>{[-1,1].map(sign=><group key={sign}><mesh position={[sign*(s.width/2-.008),0,s.depth/2-.001]}><boxGeometry args={[.016,s.height,.002]}/><meshStandardMaterial color="#b9c3ca" metalness={.8} roughness={.25}/></mesh><mesh position={[0,sign*(s.height/2-.008),s.depth/2-.001]}><boxGeometry args={[s.width,.016,.002]}/><meshStandardMaterial color="#b9c3ca" metalness={.8} roughness={.25}/></mesh></group>)}</>}
    {d.kind === 'battery' && <mesh position={[0, .025, s.depth / 2 + .003]}><boxGeometry args={[s.width * .76, s.height * .48, .005]}/><meshStandardMaterial color="#2b735d"/></mesh>}
    {d.kind === 'pv' && <>{[1,2,3].map(i => <mesh key={`v${i}`} position={[s.width * (i/4-.5), 0, s.depth / 2 + .002]}><boxGeometry args={[.004, s.height-.04, .003]}/><meshStandardMaterial color="#819fa6"/></mesh>)}{[1,2,3,4,5].map(i => <mesh key={`h${i}`} position={[0, s.height*(i/6-.5), s.depth/2+.002]}><boxGeometry args={[s.width-.04,.004,.003]}/><meshStandardMaterial color="#819fa6"/></mesh>)}</>}
    {d.ports.map(port => { const local = localTerminalPosition(d, port.id); return <mesh key={port.id} onClick={e=>{if(mode==='connect'){e.stopPropagation();onPort(d.id,port.id)}}} position={local}><sphereGeometry args={[.012,12,12]}/><meshStandardMaterial color={port.id.includes('-') || port.id === 'n' ? '#506473' : port.domain === 'ac' ? '#ae936a' : '#d18668'} metalness={.6} roughness={.3}/></mesh> })}
    {(selected||hovered) && <RoundedBox args={[s.width+.018,s.height+.018,s.depth+.018]} radius={.012}><meshBasicMaterial color="#71b29b" wireframe transparent opacity={.5}/></RoundedBox>}
  </group>
  const origin:Point3=[d.physical[0],d.physical[1]+s.height/2+.025,d.physical[2]]
  const base=(p:Point3):Point3=>[p[0],p[1]-s.height/2-.025,p[2]].map((value,i)=>Math.abs(value-d.physical[i])<1e-8?d.physical[i]:Math.round(value*1e8)/1e8) as Point3
  return <Translation position={origin} planeNormal={planeNormal} active={selected&&mode==='move'} axis={axis} onPreview={p=>onPreview(d.id,base(p))} onCommit={p=>onMove(d.id,base(p))} onCancel={onCancel}>{body}</Translation>
}


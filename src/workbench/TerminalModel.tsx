import {Component,Suspense,memo,useCallback,useEffect,useRef,useState,type ReactNode,type RefObject} from 'react'
import {Canvas,useThree} from '@react-three/fiber'
import {Html,OrbitControls} from '@react-three/drei'
import type {OrbitControls as Controls} from 'three-stdlib'
import type {Device} from './model'
import {Equipment} from './Physical'
import {localTerminalPosition} from './geometry'
import {EquipmentArt} from './EquipmentArt'

class ModelBoundary extends Component<{device:Device;children:ReactNode},{failed:boolean}>{
 state={failed:false}
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<><EquipmentArt kind={this.props.device.kind}/><p>3D preview is unavailable here. The terminal controls and live readings remain available.</p></>:this.props.children}
}
const noop=()=>{}
function Model({device,view,sequence,onProbe,portal}:{device:Device;view:'front'|'perspective';sequence:number;onProbe:(id:string,port:string)=>void;portal:RefObject<HTMLElement>}){
 const controls=useRef<Controls>(null),{camera,invalidate}=useThree(),s=device.spec,extent=Math.max(s.width,s.height,s.depth,.05)
 useEffect(()=>{
  const orbit=controls.current,damping=orbit?.enableDamping
  if(orbit){orbit.enableDamping=false;orbit.update()}
  camera.position.set(view==='front'?0:extent*1.4,view==='front'?0:extent*.7,extent*2.1);camera.lookAt(0,0,0);camera.near=extent*.001;camera.far=extent*1000;camera.updateProjectionMatrix()
  if(orbit){orbit.target.set(0,0,0);orbit.update();orbit.enableDamping=damping!}invalidate()
 },[device.id,s.width,s.height,s.depth,view,sequence,camera,invalidate,extent])
 const centred:Device={...device,physical:[0,-s.height/2-.025,0],rotation:[0,0,0],mount:undefined}
 return <><color attach="background" args={['#eff3eb']}/><ambientLight intensity={2}/><directionalLight position={[2,3,4]} intensity={2.5}/><directionalLight position={[-3,1,-2]} intensity={1}/>
  <Equipment device={centred} selected={false} onSelect={noop} mode="connect" axis="all" onPreview={noop} onMove={noop} onCancel={noop} onPort={onProbe}/>
  {device.ports.map(p=><Html portal={portal} key={device.id+':'+p.id} position={localTerminalPosition(centred,p.id)} center><button className="terminal-port-label" aria-label={`3D probe ${p.label}`} title={`Attach a voltmeter probe to ${device.name} / ${p.label}`} onClick={e=>{e.stopPropagation();onProbe(device.id,p.id)}}>{p.label}</button></Html>)}
  <OrbitControls ref={controls} makeDefault minDistance={extent*.3} maxDistance={extent*12} enableDamping dampingFactor={.12}/>
 </>
}
export default memo(function TerminalModel({device,onProbe}:{device:Device;onProbe:(id:string,port:string)=>void}){
 const [view,setView]=useState<'front'|'perspective'>('perspective'),[sequence,setSequence]=useState(0)
 const portal=useRef<HTMLDivElement>(null!),[ready,setReady]=useState(false),setPortal=useCallback((el:HTMLDivElement|null)=>{portal.current=el!;if(el)setReady(true)},[])
 return <div className="terminal-model" aria-label={`${device.name} 3D model`}><div ref={setPortal} className="terminal-port-overlay"/><ModelBoundary device={device}><Canvas frameloop="demand" camera={{position:[0,0,2],fov:40}} dpr={[1,1.7]}><Suspense fallback={null}>{ready&&<Model device={device} view={view} sequence={sequence} onProbe={onProbe} portal={portal}/>}</Suspense></Canvas></ModelBoundary><div className="terminal-model-controls"><button onClick={()=>{setView('front');setSequence(v=>v+1)}}>Front view</button><button onClick={()=>{setView('perspective');setSequence(v=>v+1)}}>Frame component</button><span>Drag: orbit / Right drag: pan / Wheel: zoom</span></div></div>
})

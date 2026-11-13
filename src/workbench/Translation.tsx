import { useEffect, useRef, type ReactNode } from 'react'
import { TransformControls,DragControls } from '@react-three/drei'
import { Group,Vector3 } from 'three'
import type { TransformControls as TransformControl } from 'three-stdlib'
import type { Point3 } from './geometry'
import { useThree } from '@react-three/fiber'

export type Axis = 'all' | 'x' | 'y' | 'z'
export function Translation({position,active,axis,planeNormal,onPreview,onCommit,onCancel,children}:{position:Point3;active:boolean;axis:Axis;planeNormal?:Point3;onPreview:(p:Point3)=>void;onCommit:(p:Point3)=>void;onCancel:()=>void;children:ReactNode}) {
  const object=useRef<Group>(null!),control=useRef<TransformControl>(null),cancelled=useRef(false),start=useRef<Point3|null>(null)
  const orbit=useThree(state=>state.controls) as unknown as {enabled:boolean}|undefined
  const direct=useRef(false),blockedDirect=useRef(false),last=useRef<Point3|null>(null)
  useEffect(()=>()=>{if(active&&orbit)orbit.enabled=true;if(direct.current){cancelled.current=true;direct.current=false;cancelCallback.current()}},[active,orbit])
  // three-stdlib exposes these observable properties at runtime but marks them private in its declarations.
  const runtime=()=>control.current as unknown as {dragging:boolean;axis:string|null}|null
  const cancelCallback=useRef(onCancel);cancelCallback.current=onCancel
  useEffect(()=>{
    const cancelGesture=()=>{
      if(!runtime()?.dragging&&!direct.current)return
      cancelled.current=true;control.current?.reset();if(start.current)object.current?.position.fromArray(start.current);const state=runtime();if(state){state.dragging=false;state.axis=null;}if(orbit)orbit.enabled=true;cancelCallback.current()
    }
    const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape')cancelGesture()}
    window.addEventListener('keydown',cancel)
    window.addEventListener('pointercancel',cancelGesture,true);window.addEventListener('blur',cancelGesture)
    return()=>{window.removeEventListener('keydown',cancel);window.removeEventListener('pointercancel',cancelGesture,true);window.removeEventListener('blur',cancelGesture);const state=runtime();if(state)state.dragging=false}
  },[orbit])
  return <><DragControls autoTransform={false} dragConfig={{enabled:active}} onDragStart={()=>{blockedDirect.current=!!runtime()?.axis;if(blockedDirect.current)return;direct.current=true;cancelled.current=false;start.current=object.current.position.toArray() as Point3;last.current=start.current}} onDrag={matrix=>{
    if(blockedDirect.current||cancelled.current||!start.current)return
    const delta=new Vector3().setFromMatrixPosition(matrix)
    delta.set(...delta.toArray().map(v=>Math.round(v*100)/100) as Point3)
    // Body drags slide mounted equipment across its surface, preserving clearance.
    // Axis arrows deliberately retain full world-space movement, including lift-off.
    if(axis==='all'&&planeNormal)delta.projectOnPlane(new Vector3(...planeNormal).normalize())
    const p=start.current.map((v,i)=>axis!=='all'&&['x','y','z'][i]!==axis?v:v+delta.getComponent(i)) as Point3
    last.current=p;object.current.position.fromArray(p);onPreview(p)
  }} onDragEnd={()=>{if(blockedDirect.current){blockedDirect.current=false;return}direct.current=false;if(!cancelled.current&&last.current&&start.current&&last.current.some((v,i)=>Math.abs(v-start.current![i])>1e-8))onCommit(last.current);else onCancel();start.current=null}}><group ref={object} position={position}>{children}</group></DragControls>{active&&<TransformControls object={object} ref={control} mode="translate" space="world" translationSnap={.01} size={.8} showX={axis==='all'||axis==='x'} showY={axis==='all'||axis==='y'} showZ={axis==='all'||axis==='z'} onMouseDown={()=>{cancelled.current=false;start.current=object.current?.position.toArray() as Point3}} onObjectChange={()=>{if(!cancelled.current&&object.current)onPreview(object.current.position.toArray() as Point3)}} onMouseUp={()=>{
    const p=object.current?.position.toArray() as Point3|undefined
    if(!cancelled.current&&p&&start.current&&p.some((v,i)=>Math.abs(v-start.current![i])>1e-8))onCommit(p)
    else onCancel()
    start.current=null
  }}/>}</>
}

import type {Project} from './model'
import {pvVocAtTemperature,pvIscAtTemperature} from './pv-ratings'

/** Inspect clearly wired series strings at one controller. No ideal-source
 * summation of series currents, and no double counting shared modules. */
export function pvNetwork(project:Project,controllerId:string,temperature=project.ambient){
 const parent=new Map<string,string>(),key=(id:string,port:string)=>id+':'+port,root=(k:string):string=>{const p=parent.get(k);if(!p){parent.set(k,k);return k}if(p===k)return k;const r=root(p);parent.set(k,r);return r},join=(a:string,b:string)=>{const x=root(a),y=root(b);if(x!==y)parent.set(x,y)}
 for(const w of project.wires)join(key(w.from,w.fromPort),key(w.to,w.toPort))
 for(const d of project.devices)if(d.on&&['fuse','switch','bus'].includes(d.kind))for(const p of d.ports.slice(1))join(key(d.id,d.ports[0].id),key(d.id,p.id))
 const sources=project.devices.filter(d=>d.kind==='pv'&&d.on),edges=sources.map(d=>({from:root(key(d.id,'n')),to:root(key(d.id,'p')),device:d})),start=root(key(controllerId,'pv-')),end=root(key(controllerId,'pv+'))
 const paths:typeof sources[]=[],stack=[{node:start,path:[] as typeof sources,seen:new Set([start])}];let visits=0,complex=false
 if(start===end)return {known:false,strings:0,sources:[],power:0,shortCircuitCurrent:0,voc:0,operatingVoltage:0}
 while(stack.length&&visits++<10000){const current=stack.pop()!;if(current.node===end){paths.push(current.path);continue}for(const edge of edges.filter(e=>e.from===current.node)){if(current.seen.has(edge.to)){complex=true;continue}stack.push({node:edge.to,path:[...current.path,edge.device],seen:new Set([...current.seen,edge.to])})}}
 if(stack.length)complex=true
 const units=paths.flat(),unique=new Set(units.map(d=>d.id));if(unique.size!==units.length)complex=true
 // Use the greatest module Isc in each string as a conservative input-rating
 // bound for mismatched modules. Identical series modules contribute once.
 return {known:!complex&&paths.length>0,strings:paths.length,sources:[...unique],power:units.reduce((sum,d)=>sum+d.spec.watts,0),shortCircuitCurrent:paths.reduce((sum,path)=>sum+Math.max(...path.map(d=>pvIscAtTemperature(d.spec,temperature))),0),voc:Math.max(0,...paths.map(path=>path.reduce((sum,d)=>sum+pvVocAtTemperature(d.spec,temperature),0))),operatingVoltage:paths.length?Math.min(...paths.map(path=>path.reduce((sum,d)=>sum+d.spec.voltage,0))):0}
}

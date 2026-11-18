import type {Project,Device} from './model'

/** Installed series/parallel topology. Converter sides and protective earth never join. */
export function sourceArrangement(project:Project,sourceId:string){
 const first=project.devices.find(d=>d.id===sourceId)
 if(!first||!['pv','battery'].includes(first.kind))throw Error('Choose an individual panel or battery.')
 const parent=new Map<string,string>(),key=(id:string,p:string)=>id+':'+p
 const root=(k:string):string=>{const p=parent.get(k);if(!p){parent.set(k,k);return k}if(p===k)return k;const r=root(p);parent.set(k,r);return r}
 const join=(a:string,b:string)=>{const x=root(a),y=root(b);if(x!==y)parent.set(x,y)}
 for(const w of project.wires)join(key(w.from,w.fromPort),key(w.to,w.toPort))
 for(const d of project.devices)if(['bus','fuse','switch'].includes(d.kind))for(const p of d.ports.filter(p=>p.domain!=='earth').slice(1))join(key(d.id,d.ports[0].id),key(d.id,p.id))
 const edges=project.devices.filter(d=>d.kind===first.kind).map(d=>({d,low:root(key(d.id,'n')),high:root(key(d.id,'p'))}))
 const startEdge=edges.find(e=>e.d.id===sourceId)!,seen=new Set([startEdge.low,startEdge.high]),connected=new Set([sourceId]);let changed=true
 while(changed){changed=false;for(const e of edges)if(!connected.has(e.d.id)&&(seen.has(e.low)||seen.has(e.high))){connected.add(e.d.id);seen.add(e.low);seen.add(e.high);changed=true}}
 const selected=edges.filter(e=>connected.has(e.d.id)),starts=[...new Set(selected.map(e=>e.low))].filter(n=>!selected.some(e=>e.high===n)),ends=[...new Set(selected.map(e=>e.high))].filter(n=>!selected.some(e=>e.low===n))
 if(starts.length!==1||ends.length!==1)throw Error('Bank replacement needs clear series strings sharing one positive and one negative collector. Review shorts, taps or disconnected branches first.')
 const branches:Device[][]=[],stack=[{node:starts[0],path:[] as Device[],nodes:new Set([starts[0]])}];let visits=0
 while(stack.length&&visits++<2000){const s=stack.pop()!;if(s.node===ends[0]){branches.push(s.path);continue}for(const e of selected.filter(e=>e.low===s.node)){if(s.nodes.has(e.high))throw Error('Source arrangement contains a loop.');stack.push({node:e.high,path:[...s.path,e.d],nodes:new Set([...s.nodes,e.high])})}}
 if(stack.length||!branches.length||branches.flat().length!==connected.size||new Set(branches.flat().map(d=>d.id)).size!==connected.size)throw Error('Shared modules, middle taps or a complex source mesh require explicit rewiring before bank replacement.')
 if(new Set(branches.map(b=>b.length)).size!==1)throw Error('Unequal series strings require explicit review before bank replacement.')
 const voltages=branches.map(b=>b.reduce((sum,d)=>sum+d.spec.voltage,0))
 if(voltages.some(v=>Math.abs(v-voltages[0])>Math.max(.2,voltages[0]*.02)))throw Error('Source branches have different nominal voltages.')
 return {kind:first.kind as 'battery'|'pv',branches,ids:connected,series:branches[0].length,parallel:branches.length,voltage:voltages[0],energyWh:branches.flat().reduce((sum,d)=>sum+d.spec.voltage*d.spec.capacityAh,0),watts:branches.flat().reduce((sum,d)=>sum+d.spec.watts,0),node:(id:string,p:string)=>root(key(id,p)),low:starts[0],high:ends[0]}
}

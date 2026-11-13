import type {Project} from './model'
import {schematicProjection} from './equipment-groups'

/** Place only visible diagram items. Physical positions and conductors stay intact. */
export async function diagramPositions(project:Project,mode:'layered'|'compact'|'screen'='compact',viewport={width:1000,height:600}):Promise<Record<string,{x:number;y:number}>>{
 const projection=schematicProjection(project),display=projection.project
 const {default:ELK}=await import('elkjs/lib/elk.bundled.js'),elk=new ELK()
 const height=(id:string)=>projection.groups.find(g=>g.group.id===id)?.height??180
 const sides={left:'WEST',right:'EAST',top:'NORTH',bottom:'SOUTH'}
 const result=await elk.layout({id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT','elk.spacing.nodeNode':mode==='layered'?'100':'55','elk.layered.spacing.nodeNodeBetweenLayers':mode==='layered'?'150':'100','elk.layered.crossingMinimization.strategy':'LAYER_SWEEP'},children:display.devices.map(d=>({id:d.id,width:210,height:height(d.id),layoutOptions:{'elk.portConstraints':'FIXED_SIDE'},ports:d.ports.map(p=>({id:d.id+':'+p.id,width:1,height:1,layoutOptions:{'elk.port.side':sides[p.side]}}))})),edges:display.wires.map(w=>({id:w.id,sources:[w.from+':'+w.fromPort],targets:[w.to+':'+w.toPort]}))})
 const ordered=[...result.children??[]].sort((a,b)=>(a.x??0)-(b.x??0)||(a.y??0)-(b.y??0))
 if(mode!=='screen')return Object.fromEntries(ordered.map(n=>[n.id,{x:n.x??0,y:n.y??0}]))
 const aspect=viewport.width/Math.max(200,viewport.height),columns=Math.max(1,Math.ceil(Math.sqrt(ordered.length*aspect*230/310))),positions:Record<string,{x:number;y:number}>={};let y=0
 for(let i=0;i<ordered.length;i+=columns){const row=ordered.slice(i,i+columns);row.forEach((n,col)=>positions[n.id]={x:col*310,y});y+=Math.max(...row.map(n=>n.height??180))+70}
 return positions
}


import type {Kind,Project} from './model'
import {schematicProjection} from './equipment-groups'

/** Place visible equipment in electrical-flow order, independent of wire drawing direction. */
export async function diagramPositions(project:Project,mode:'layered'|'compact'|'screen'='screen',viewport={width:1000,height:600}):Promise<Record<string,{x:number;y:number}>>{
 const projection=schematicProjection(project),display=projection.project
 if(!display.devices.length)return {}
 const {default:ELK}=await import('elkjs/lib/elk.bundled.js'),elk=new ELK()
 const height=(id:string)=>projection.groups.find(g=>g.group.id===id)?.height??180
 const stages:Partial<Record<Kind,number>>={pv:0,grid:0,'three-phase':0,mppt:2,charger:2,battery:4,inverter:6,load:8,'dc-load':8,motor:8}
 const neighbours=new Map(display.devices.map(d=>[d.id,new Set<string>()]))
 for(const wire of display.wires){neighbours.get(wire.from)?.add(wire.to);neighbours.get(wire.to)?.add(wire.from)}
 const ranks=new Map(display.devices.map(d=>[d.id,stages[d.kind]??4]))
 // Interpolate protection and distribution positions between connected equipment.
 // Outgoing and return conductors then share the same diagram direction.
 for(let pass=0;pass<100;pass++){
  let difference=0
  for(const d of display.devices){
   const adjacent=[...neighbours.get(d.id)!].filter(id=>id!==d.id)
   if(stages[d.kind]!==undefined||!adjacent.length)continue
   const next=adjacent.reduce((sum,id)=>sum+ranks.get(id)!,0)/adjacent.length
   difference=Math.max(difference,Math.abs(next-ranks.get(d.id)!));ranks.set(d.id,next)
  }
  if(difference<.0001)break
 }
 const distance=new Map<string,number>(),queue=display.devices.filter(d=>['pv','battery','grid','three-phase'].includes(d.kind)).map(d=>d.id)
 queue.forEach(id=>distance.set(id,0))
 for(let i=0;i<queue.length;i++)for(const id of neighbours.get(queue[i])!)if(!distance.has(id)){distance.set(id,distance.get(queue[i])!+1);queue.push(id)}
 const order=(a:string,b:string)=>ranks.get(a)!-ranks.get(b)!||(distance.get(a)??0)-(distance.get(b)??0)||a.localeCompare(b)
 const pairs=new Map<string,{from:string;to:string}>()
 for(const wire of display.wires){
  if(wire.from===wire.to)continue
  const [from,to]=[wire.from,wire.to].sort(order)
  pairs.set(from+':'+to,{from,to})
 }
 const gapY=mode==='layered'?90:55,gapX=mode==='layered'?150:100
 const result=await elk.layout({id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT','elk.spacing.nodeNode':String(gapY),'elk.layered.spacing.nodeNodeBetweenLayers':String(gapX),'elk.layered.crossingMinimization.strategy':'LAYER_SWEEP'},children:[...display.devices].sort((a,b)=>order(a.id,b.id)).map(d=>({id:d.id,width:210,height:height(d.id)})),edges:[...pairs.values()].sort((a,b)=>order(a.from,b.from)||order(a.to,b.to)).map((edge,i)=>({id:'layout-'+i,sources:[edge.from],targets:[edge.to]}))})
 const layers=new Map<number,NonNullable<typeof result.children>>()
 for(const node of result.children??[]){const x=Math.round(node.x??0);layers.set(x,[...layers.get(x)??[],node])}
 const columns=[...layers.entries()].sort(([a],[b])=>a-b).map(([,nodes])=>nodes.sort((a,b)=>(a.y??0)-(b.y??0)||a.id.localeCompare(b.id)))
 if(mode==='layered')return Object.fromEntries(columns.flat().map(n=>[n.id,{x:n.x??0,y:n.y??0}]))
 const columnHeight=(nodes:typeof columns[number])=>nodes.reduce((sum,n)=>sum+(n.height??180),0)+Math.max(0,nodes.length-1)*gapY
 // Fold whole flow layers and keep parallel branches together. Choose a band
 // width against the visible workbench, including tall compact equipment groups.
 const aspect=Math.max(.4,viewport.width/Math.max(200,viewport.height))
 let bestColumns=1,bestScore=Infinity
 for(let count=1;count<=Math.min(6,columns.length);count++){
  let totalHeight=0
  for(let i=0;i<columns.length;i+=count)totalHeight+=Math.max(...columns.slice(i,i+count).map(columnHeight))+gapY*2
  totalHeight-=gapY*2
  const width=count*210+(count-1)*gapX,score=Math.abs(Math.log(width/totalHeight/aspect))
  if(score<bestScore){bestScore=score;bestColumns=count}
 }
 const positions:Record<string,{x:number;y:number}>={}
 let top=0
 for(let i=0;i<columns.length;i+=bestColumns){
  const band=columns.slice(i,i+bestColumns),bandHeight=Math.max(...band.map(columnHeight)),reverse=Math.floor(i/bestColumns)%2===1
  band.forEach((nodes,index)=>{
   const col=reverse?bestColumns-1-index:index
   let y=top+(bandHeight-columnHeight(nodes))/2
   for(const node of nodes){positions[node.id]={x:col*(210+gapX),y};y+=(node.height??180)+gapY}
  })
  top+=bandHeight+gapY*2
 }
 return positions
}

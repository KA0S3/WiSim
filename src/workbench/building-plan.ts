import {uid} from './model'
import type {BuildingLayout, FloorPlan, PlanPoint, PlanRoom, PlanWall} from './building-model'

export const polygonArea = (polygon:PlanPoint[]) => polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1]},0)/2
export const planDistance = (a:PlanPoint,b:PlanPoint) => Math.hypot(a[0]-b[0],a[1]-b[1])
const mix = (a:PlanPoint,b:PlanPoint,t:number):PlanPoint => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]

export function wallPoint(floor:FloorPlan,wall:PlanWall,t:number):PlanPoint {
  const a=floor.nodes.find(n=>n.id===wall.a)!.point,b=floor.nodes.find(n=>n.id===wall.b)!.point
  return wall.control?mix(mix(a,wall.control,t),mix(wall.control,b,t),t):mix(a,b,t)
}
export function wallPoints(floor:FloorPlan,wall:PlanWall):PlanPoint[] {
  const a=wallPoint(floor,wall,0),b=wallPoint(floor,wall,1)
  const divisions=wall.control?Math.min(64,Math.max(8,Math.ceil((planDistance(a,wall.control)+planDistance(wall.control,b))/.25))):1
  return Array.from({length:divisions+1},(_,i)=>wallPoint(floor,wall,i/divisions))
}
export function pointInPolygon(point:PlanPoint,polygon:PlanPoint[]):boolean {
  let inside=false
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j],dx=b[0]-a[0],dy=b[1]-a[1]
    const cross=(point[0]-a[0])*dy-(point[1]-a[1])*dx
    if(Math.abs(cross)<1e-7&&point[0]>=Math.min(a[0],b[0])-1e-7&&point[0]<=Math.max(a[0],b[0])+1e-7&&point[1]>=Math.min(a[1],b[1])-1e-7&&point[1]<=Math.max(a[1],b[1])+1e-7)return true
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside
  }
  return inside
}

/** Split drawn intersections and merge coincident junctions, including curve crossings. */
export function normalizeFloor(input:FloorPlan):FloorPlan {
  const floor=structuredClone(input),remap=new Map<string,string>()
  const nodes:FloorPlan['nodes']=[]
  for(const node of floor.nodes){const previous=nodes.find(n=>planDistance(n.point,node.point)<.001);if(previous)remap.set(node.id,previous.id);else nodes.push(node)}
  floor.nodes=nodes;floor.walls=floor.walls.map(w=>({...w,a:remap.get(w.a)??w.a,b:remap.get(w.b)??w.b})).filter(w=>w.a!==w.b)
  const splits=new Map(floor.walls.map(w=>[w.id,[0,1]])),samples=new Map(floor.walls.map(w=>[w.id,wallPoints(floor,w)]))
  for(let i=0;i<floor.walls.length;i++)for(let j=i+1;j<floor.walls.length;j++){
    const a=floor.walls[i],b=floor.walls[j],pa=samples.get(a.id)!,pb=samples.get(b.id)!
    if([0,1].some(axis=>Math.min(...pa.map(p=>p[axis]))>Math.max(...pb.map(p=>p[axis]))+1e-7||Math.min(...pb.map(p=>p[axis]))>Math.max(...pa.map(p=>p[axis]))+1e-7))continue
    for(let x=0;x<pa.length-1;x++)for(let y=0;y<pb.length-1;y++){
      const p=pa[x],q=pb[y],r:[number,number]=[pa[x+1][0]-p[0],pa[x+1][1]-p[1]],s:[number,number]=[pb[y+1][0]-q[0],pb[y+1][1]-q[1]],den=r[0]*s[1]-r[1]*s[0]
      if(Math.abs(den)<1e-9)continue
      const t=((q[0]-p[0])*s[1]-(q[1]-p[1])*s[0])/den,u=((q[0]-p[0])*r[1]-(q[1]-p[1])*r[0])/den
      if(t>=-1e-7&&t<=1+1e-7&&u>=-1e-7&&u<=1+1e-7){splits.get(a.id)!.push((x+t)/(pa.length-1));splits.get(b.id)!.push((y+u)/(pb.length-1))}
    }
  }
  const nodeAt=(point:PlanPoint)=>{let node=floor.nodes.find(n=>planDistance(n.point,point)<.01);if(!node){node={id:uid('junction'),point};floor.nodes.push(node)}return node.id}
  const walls:PlanWall[]=[]
  for(const wall of floor.walls){
    const parameters=[...new Set(splits.get(wall.id)!.map(t=>Math.max(0,Math.min(1,Math.round(t*1e7)/1e7))))].sort((a,b)=>a-b)
    for(let i=1;i<parameters.length;i++){
      const start=parameters[i-1],end=parameters[i],a=wallPoint(floor,wall,start),b=wallPoint(floor,wall,end)
      if(planDistance(a,b)<.01)continue
      let control:PlanPoint|undefined
      if(wall.control){const p=wallPoint(floor,wall,0),q=wallPoint(floor,wall,1);control=[a[0]+(end-start)*((1-start)*(wall.control[0]-p[0])+start*(q[0]-wall.control[0])),a[1]+(end-start)*((1-start)*(wall.control[1]-p[1])+start*(q[1]-wall.control[1]))]}
      walls.push({id:i===1?wall.id:uid('wall'),a:nodeAt(a),b:nodeAt(b),...(control?{control}:{}),...(wall.door?{door:true}:{})})
    }
  }
  const seen=new Set<string>()
  floor.walls=walls.filter(w=>{const key=[w.a,w.b].sort().join('/')+JSON.stringify(w.control??null);if(seen.has(key))return false;seen.add(key);return true})
  const used=new Set(floor.walls.flatMap(w=>[w.a,w.b]));floor.nodes=floor.nodes.filter(n=>used.has(n.id))
  return floor
}

export function addPlanWall(floor:FloorPlan,a:PlanPoint,b:PlanPoint,curved=false):FloorPlan {
  if(planDistance(a,b)<.05)return floor
  const nodes=[...floor.nodes]
  const at=(point:PlanPoint)=>{let node=nodes.find(n=>planDistance(n.point,point)<.05);if(!node){node={id:uid('junction'),point};nodes.push(node)}return node.id}
  const wall:PlanWall={id:uid('wall'),a:at(a),b:at(b)}
  if(curved)wall.control=[(a[0]+b[0])/2-(b[1]-a[1])*.25,(a[1]+b[1])/2+(b[0]-a[0])*.25]
  return normalizeFloor({...floor,nodes,walls:[...floor.walls,wall]})
}

export function buildingRooms(building:BuildingLayout):PlanRoom[] {
  const result:PlanRoom[]=[]
  for(const [floorIndex,floor] of building.floors.entries()){
    const edges=floor.walls.flatMap(wall=>[{wall,from:wall.a,to:wall.b,reverse:false},{wall,from:wall.b,to:wall.a,reverse:true}])
    const tangent=(edge:typeof edges[number])=>{const a=wallPoint(floor,edge.wall,edge.reverse?1:0),b=edge.wall.control??wallPoint(floor,edge.wall,edge.reverse?0:1);return Math.atan2(b[1]-a[1],b[0]-a[0])}
    const outgoing=new Map(floor.nodes.map(n=>[n.id,edges.filter(e=>e.from===n.id).sort((a,b)=>tangent(a)-tangent(b))]))
    const visited=new Set<string>()
    const key=(edge:typeof edges[number])=>edge.wall.id+(edge.reverse?'-reverse':'-forward')
    for(const first of edges){
      if(visited.has(key(first)))continue
      let edge=first
      const polygon:PlanPoint[]=[],members:string[]=[]
      for(let step=0;step<=edges.length;step++){
        if(visited.has(key(edge)))break
        visited.add(key(edge));members.push(edge.wall.id)
        const points=wallPoints(floor,edge.wall);if(edge.reverse)points.reverse();polygon.push(...points.slice(0,-1))
        const choices=outgoing.get(edge.to)!,opposite=choices.findIndex(e=>e.wall.id===edge.wall.id&&e.reverse!==edge.reverse)
        edge=choices[(opposite-1+choices.length)%choices.length]
        if(key(edge)===key(first))break
      }
      const area=polygonArea(polygon)
      if(area<=.05||key(edge)!==key(first))continue
      const hash=[...new Set(members)].sort().join('|').split('').reduce((value,c)=>Math.imul(value^c.charCodeAt(0),16777619)>>>0,2166136261).toString(36)
      const id=`${floor.id}-room-${hash}`
      result.push({id,floor:floorIndex,name:building.roomNames[id]??`Floor ${floorIndex+1} room ${result.filter(r=>r.floor===floorIndex).length+1}`,polygon,walls:[...new Set(members)],area})
    }
  }
  return result
}

export function defaultBuilding(mobile=false):BuildingLayout {
  let floor:FloorPlan={id:uid('floor'),nodes:[],walls:[]}
  const width=mobile?2:8,depth=mobile?1.5:6,points:PlanPoint[]=[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]]
  for(let i=0;i<4;i++)floor=addPlanWall(floor,points[i],points[(i+1)%4])
  return {id:uid('building'),floors:[floor],floorHeight:mobile?2.2:2.8,wallThickness:mobile?.08:.15,roofShape:mobile?'flat':'gable',roofPitch:mobile?0:25,roomNames:{}}
}

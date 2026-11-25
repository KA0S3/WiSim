import { ShapeUtils } from 'three/src/extras/ShapeUtils.js'
import { Vector2 } from 'three/src/math/Vector2.js'
import { Vector3 } from 'three/src/math/Vector3.js'
import { Matrix4 } from 'three/src/math/Matrix4.js'
import { Euler } from 'three/src/math/Euler.js'
import { SkeletonBuilder } from 'straight-skeleton'
import type { BuildingLayout, PlanPoint, PlanRoom, PlanWall } from './building-model'
import { buildingRooms, wallPoints, planDistance,polygonArea,pointInPolygon } from './building-plan'
import type { Structure, Triple } from './model'
import {rectangleFits} from './surface-domain'

export function polygonTriangles(polygon:PlanPoint[]):PlanPoint[][] {
  return ShapeUtils.triangulateShape(polygon.map(p=>new Vector2(...p)),[]).map(face=>face.map(index=>polygon[index]))
}
export function roomInterior(room:PlanRoom):PlanPoint {
  const xs=room.polygon.map(p=>p[0]),ys=room.polygon.map(p=>p[1])
  const centre:PlanPoint=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2]
  const candidates=[centre,...polygonTriangles(room.polygon).map(triangle=>[(triangle[0][0]+triangle[1][0]+triangle[2][0])/3,(triangle[0][1]+triangle[1][1]+triangle[2][1])/3] as PlanPoint)].filter(point=>pointInPolygon(point,room.polygon))
  const clearance=(point:PlanPoint)=>Math.min(...room.polygon.map((a,i)=>{
    const b=room.polygon[(i+1)%room.polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy
    const t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0
    return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)
  }))
  return candidates.sort((a,b)=>clearance(b)-clearance(a))[0]??room.polygon[0]
}
export function availableRoofRooms(layout:BuildingLayout,rooms=buildingRooms(layout)):PlanRoom[] {
  return rooms.filter(room=>exposedRoofPolygons(room,rooms).length>0)
}

export function exposedRoofPolygons(room:PlanRoom,rooms:PlanRoom[]):PlanPoint[][] {
  let pieces=polygonTriangles(room.polygon)
  for(const above of rooms.filter(r=>r.floor>room.floor))for(const triangle of polygonTriangles(above.polygon)){
    const orientation=polygonArea(triangle)>0?1:-1,next:PlanPoint[][]=[]
    for(const piece of pieces){
      let remaining=piece
      for(let i=0;i<3;i++){
        const p=triangle[i],q=triangle[(i+1)%3],a=(q[1]-p[1])*orientation,b=-(q[0]-p[0])*orientation,c=-(a*p[0]+b*p[1])
        const outside=clip(remaining,-a,-b,-c)
        if(outside.length>=3&&Math.abs(polygonArea(outside))>.001)next.push(outside)
        remaining=clip(remaining,a,b,c)
        if(remaining.length<3)break
      }
    }
    pieces=next
  }
  return pieces
}

function clip(polygon:PlanPoint[],a:number,b:number,c:number):PlanPoint[] {
  const result:PlanPoint[]=[]
  for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],first=a*p[0]+b*p[1]+c,last=a*q[0]+b*q[1]+c
    if(first<=1e-8)result.push(p)
    if((first<0)!==(last<0)){const t=first/(first-last);result.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t])}
  }
  return result
}

function subtractOpening(pieces:PlanPoint[][],opening:PlanPoint[]):PlanPoint[][] {
  const result:PlanPoint[][]=[]
  for(const piece of pieces){
    let remaining=piece
    for(let i=0;i<opening.length;i++){
      const p=opening[i],q=opening[(i+1)%opening.length],a=q[1]-p[1],b=p[0]-q[0],c=-(a*p[0]+b*p[1])
      const outside=clip(remaining,-a,-b,-c)
      if(outside.length>=3&&Math.abs(polygonArea(outside))>.001)result.push(outside)
      remaining=clip(remaining,a,b,c)
      if(remaining.length<3)break
    }
  }
  return result
}

function roofGroups(rooms:PlanRoom[]) {
  const owners=new Map<string,PlanRoom[]>()
  for(const room of rooms)for(const wall of room.walls){
    const neighbours=owners.get(wall)??[]
    neighbours.push(room)
    owners.set(wall,neighbours)
  }
  const remaining=new Set(rooms),groups:PlanRoom[][]=[]
  for(const first of remaining){
    remaining.delete(first)
    const group=[first]
    for(const room of group)for(const wall of room.walls)for(const neighbour of owners.get(wall)??[]){
      if(remaining.delete(neighbour))group.push(neighbour)
    }
    groups.push(group)
  }
  return {groups,owners}
}

function convexHipPlanes(outline:PlanPoint[],slope:number):Triple[] {
  if(outline.length>64)return []
  const planes:Triple[]=[]
  for(const [index,p] of outline.entries()){
    const q=outline[(index+1)%outline.length],length=planDistance(p,q)
    if(length<.001)continue
    const a=(p[1]-q[1])*slope/length,b=(q[0]-p[0])*slope/length,c=-a*p[0]-b*p[1]
    if(outline.some(([x,z])=>a*x+b*z+c<-.00001))return []
    if(!planes.some(([x,y,z])=>Math.abs(x-a)+Math.abs(y-b)+Math.abs(z-c)<.00001))planes.push([a,b,c])
  }
  return planes
}

function roofPlanes(layout:BuildingLayout,rooms:PlanRoom[]):Triple[] {
  const outline=rooms.flatMap(room=>room.polygon)
  const xs=outline.map(p=>p[0]),zs=outline.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),slope=Math.tan(layout.roofPitch*Math.PI/180)
  if(layout.roofShape==='flat'||!slope)return [[0,0,0]]
  if(layout.roofShape==='shed')return [[0,slope,-minZ*slope]]
  if(layout.roofShape==='gable')return [[0,slope,-minZ*slope],[0,-slope,maxZ*slope]]
  const hips=rooms.length===1?convexHipPlanes(outline,slope):[]
  return hips.length?hips:[[slope,0,-minX*slope],[-slope,0,maxX*slope],[0,slope,-minZ*slope],[0,-slope,maxZ*slope]]
}

type HipFace={plane:Triple;polygon:PlanPoint[]}

function hipFaces(rooms:PlanRoom[],pitch:number):HipFace[]|undefined {
  // Cancel opposite edges along room dividers before finding the outside rings.
  const edges=new Map<string,Map<string,PlanPoint>>()
  const key=([x,z]:PlanPoint)=>`${Math.round(x*1e7)},${Math.round(z*1e7)}`
  for(const room of rooms)for(const [index,start] of room.polygon.entries()){
    const end=room.polygon[(index+1)%room.polygon.length]
    const from=key(start),to=key(end)
    if(from===to||edges.get(to)?.delete(from))continue
    const outgoing=edges.get(from)??new Map<string,PlanPoint>()
    outgoing.set(to,start)
    edges.set(from,outgoing)
  }
  const boundary=new Map<string,[string,PlanPoint]>()
  for(const [from,outgoing] of edges){
    if(outgoing.size>1)return
    for(const edge of outgoing)boundary.set(from,edge)
  }
  // Keep complex hand-drawn curves from blocking the editor during generation.
  if(boundary.size>240)return
  const rings:PlanPoint[][]=[]
  while(boundary.size){
    const first=boundary.keys().next().value!
    const ring:PlanPoint[]=[]
    let current=first
    do{
      const edge=boundary.get(current)
      if(!edge)return
      boundary.delete(current)
      ring.push(edge[1])
      current=edge[0]
    }while(current!==first)
    rings.push(ring.filter((p,i)=>{
      const previous=ring[(i+ring.length-1)%ring.length],next=ring[(i+1)%ring.length]
      return Math.abs((p[0]-previous[0])*(next[1]-p[1])-(p[1]-previous[1])*(next[0]-p[0]))>1e-7
    }))
  }
  const outer=rings.filter(ring=>polygonArea(ring)>0)
  if(outer.length!==1||rings.some(ring=>ring.length<3))return
  const slope=Math.tan(pitch*Math.PI/180)
  try{
    const skeleton=SkeletonBuilder.BuildFromGeoJSON([[outer[0],...rings.filter(ring=>ring!==outer[0])]])
    const faces:HipFace[]=[]
    for(const face of skeleton.Edges){
      const {Begin,End}=face.Edge
      const dx=End.X-Begin.X,dz=End.Y-Begin.Y,length=Math.hypot(dx,dz)
      if(length<1e-7)return
      const a=-dz*slope/length,b=dx*slope/length,c=-a*Begin.X-b*Begin.Y
      const polygon=Array.from(face.Polygon,({X,Y}):PlanPoint=>[X,Y])
      if(polygon.length<3||polygon.some(([x,z])=>!Number.isFinite(x)||!Number.isFinite(z)||a*x+b*z+c<-.00001))return
      faces.push({plane:[a,b,c],polygon})
    }
    const area=faces.reduce((sum,face)=>sum+Math.abs(polygonArea(face.polygon)),0)
    const expected=rooms.reduce((sum,room)=>sum+room.area,0)
    if(Math.abs(area-expected)<Math.max(1e-6,expected*1e-6))return faces
  }catch{
    // Fall back to the standard roof planes if the outline cannot be solved.
  }
}

function intersectRoofFace(polygon:PlanPoint[],footprints:PlanPoint[][]):PlanPoint[][] {
  const result:PlanPoint[][]=[]
  for(const triangle of polygonTriangles(polygon))for(const footprint of footprints){
    let piece=triangle
    const direction=Math.sign(polygonArea(footprint))
    for(const [index,p] of footprint.entries()){
      const q=footprint[(index+1)%footprint.length]
      const a=(q[1]-p[1])*direction,b=(p[0]-q[0])*direction
      piece=clip(piece,a,b,-a*p[0]-b*p[1])
      if(piece.length<3)break
    }
    if(piece.length>=3&&Math.abs(polygonArea(piece))>.00001)result.push(piece)
  }
  return result
}

function roofSurfaces(layout:BuildingLayout,room:PlanRoom,footprints:PlanPoint[][],planes:Triple[],hips?:HipFace[],wholeFootprint=false):Structure[] {
  const triangles=footprints,result:Structure[]=[]
  for(const [index,plane] of (hips?.map(face=>face.plane)??planes).entries()){
    const face=hips?.[index]
    const pieces:PlanPoint[][]=face?(wholeFootprint?[face.polygon]:intersectRoofFace(face.polygon,footprints)):[]
    if(!face)for(const triangle of triangles){
      let piece=triangle
      for(const other of planes){if(other===plane)continue;piece=clip(piece,plane[0]-other[0],plane[1]-other[1],plane[2]-other[2]);if(piece.length<3)break}
      if(piece.length>=3&&Math.abs(polygonArea(piece))>.001)pieces.push(piece)
    }
    if(!pieces.length)continue
    const [a,b,c]=plane,base=new Vector3(0,(room.floor+1)*layout.floorHeight+c,0),u=new Vector3(1,a,0).normalize(),normal=new Vector3(-a,1,-b).normalize(),v=normal.clone().cross(u).normalize()
    const localPieces=pieces.map(poly=>poly.map(([x,z])=>{const d=new Vector3(x,(room.floor+1)*layout.floorHeight+a*x+b*z+c,z).sub(base);return[d.dot(u),d.dot(v)] as PlanPoint}))
    const px=localPieces.flat().map(p=>p[0]),py=localPieces.flat().map(p=>p[1]),cx=(Math.min(...px)+Math.max(...px))/2,cy=(Math.min(...py)+Math.max(...py))/2
    const width=Math.max(...px)-Math.min(...px),height=Math.max(...py)-Math.min(...py)
    if(width<.01||height<.01)continue
    const euler=new Euler().setFromRotationMatrix(new Matrix4().makeBasis(u,v,normal),'XYZ')
    result.push({id:`${layout.id}-${room.id}-roof-${index}`,kind:'roof',name:`${room.name} roof ${index+1}`,position:base.addScaledVector(u,cx).addScaledVector(v,cy).toArray() as Triple,rotation:[euler.x,euler.y,euler.z],size:[width,height,.08],color:'#7b9394',polygons:localPieces.map(poly=>poly.map(([x,y])=>[x-cx,y-cy])),building:{id:layout.id,floor:room.floor,stage:'roof',roomId:room.id}})
  }
  return result
}

function exposedWallRanges(p:PlanPoint,q:PlanPoint,exposed:PlanPoint[][]):[number,number][] {
  const dx=q[0]-p[0],dz=q[1]-p[1],lengthSquared=dx*dx+dz*dz
  const ranges:[number,number][]=[]
  for(const polygon of exposed){
    const along=polygon.filter(([x,z])=>Math.abs(dx*(z-p[1])-dz*(x-p[0]))<1e-6)
      .map(([x,z])=>((x-p[0])*dx+(z-p[1])*dz)/lengthSquared)
    const from=Math.max(0,Math.min(...along)),to=Math.min(1,Math.max(...along))
    if(to-from>1e-6)ranges.push([from,to])
  }
  const merged:[number,number][]=[]
  for(const range of ranges.sort((a,b)=>a[0]-b[0])){
    const last=merged.at(-1)
    if(last&&range[0]<=last[1]+1e-6)last[1]=Math.max(last[1],range[1])
    else merged.push(range)
  }
  return merged
}

function roofWallCaps(layout:BuildingLayout,room:PlanRoom,planes:Triple[],owners:Map<string,PlanRoom[]>,walls:Map<string,PlanWall>,exposed:PlanPoint[][]):Structure[] {
  const result:Structure[]=[]
  const base=(room.floor+1)*layout.floorHeight
  for(const wallId of room.walls){
    if(owners.get(wallId)?.length!==1)continue
    const wall=walls.get(wallId)!
    const points=wallPoints(layout.floors[room.floor],wall)
    for(let i=1;i<points.length;i++){
      const p=points[i-1],q=points[i],length=planDistance(p,q)
      if(length<.001)continue
      const ends=(point:PlanPoint)=>planes.map(([a,b,c])=>a*point[0]+b*point[1]+c)
      const from=ends(p),to=ends(q),breaks=new Set([0,1])
      for(let a=0;a<planes.length;a++)for(let b=a+1;b<planes.length;b++){
        const start=from[a]-from[b],end=to[a]-to[b]
        if(start*end<0)breaks.add(start/(start-end))
      }
      const heightAt=(t:number)=>Math.max(0,Math.min(...from.map((height,index)=>height+(to[index]-height)*t)))
      const polygons=exposedWallRanges(p,q,exposed).map(([start,end])=>{
        const top=[end,...[...breaks].filter(t=>t>start&&t<end).sort((a,b)=>b-a),start]
          .map(t=>[(t-.5)*length,heightAt(t)] as PlanPoint)
          .filter(point=>point[1]>.000001)
        return [[(start-.5)*length,0],[(end-.5)*length,0],...top] as PlanPoint[]
      }).filter(polygon=>polygon.length>2)
      const height=Math.max(0,...polygons.flat().map(point=>point[1]))
      if(height<.001)continue
      result.push({
        id:`${layout.id}-${wall.id}-roof-cap-${i}`,kind:'wall',name:`${room.name} roof wall`,
        position:[(p[0]+q[0])/2,base+height/2,(p[1]+q[1])/2],
        rotation:[0,-Math.atan2(q[1]-p[1],q[0]-p[0]),0],size:[length,height,layout.wallThickness],
        color:room.floor%2?'#e3ded1':'#e9e3d5',polygons:polygons.map(polygon=>polygon.map(([x,y])=>[x,y-height/2])),
        building:{id:layout.id,floor:room.floor,stage:'roof',roomId:room.id},
      })
    }
  }
  return result
}

export function buildingStructures(layout:BuildingLayout):Structure[] {
  const result:Structure[]=[],rooms=buildingRooms(layout)
  if(!rooms.length)throw new Error('Close at least one room by connecting its walls before building.')
  for(const stairs of layout.stairs??[]){
    const fits=(floor:number)=>rooms.filter(room=>room.floor===floor).some(room=>rectangleFits({id:'room',kind:'floor',name:room.name,position:[0,0,0],rotation:[0,0,0],size:[1,1,.1],color:'#fff',polygons:[room.polygon]},{x:stairs.position[0],y:stairs.position[1],width:stairs.width,height:stairs.run}))
    if(!fits(stairs.floor)||!fits(stairs.floor+1))throw new Error(`Stairs between floors ${stairs.floor+1} and ${stairs.floor+2} extend outside their shared room space. Move the stairs or resize the overlapping rooms.`)
  }
  for(const [floorIndex,floor] of layout.floors.entries())for(const wall of floor.walls){
    const points=wallPoints(floor,wall)
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],length=planDistance(a,b)
      if(length<.001)continue
      const surface:Structure={id:`${layout.id}-${wall.id}-${i}`,kind:'wall',name:`Floor ${floorIndex+1} ${wall.control?'curved ':''}wall`,position:[(a[0]+b[0])/2,floorIndex*layout.floorHeight+layout.floorHeight/2,(a[1]+b[1])/2],rotation:[0,-Math.atan2(b[1]-a[1],b[0]-a[0]),0],size:[length,layout.floorHeight,layout.wallThickness],color:floorIndex%2?'#e3ded1':'#e9e3d5',building:{id:layout.id,floor:floorIndex,stage:'wall',wallId:wall.id}}
      if(wall.door&&!wall.control&&length>1.6&&layout.floorHeight>2.2){
        const side=(length-1)/2,dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length
        for(const [index,start] of [0,length-side].entries())result.push({...surface,id:surface.id+`-door-${index}`,position:[a[0]+dx*(start+side/2),surface.position[1],a[1]+dz*(start+side/2)],size:[side,layout.floorHeight,layout.wallThickness]})
        result.push({...surface,id:surface.id+'-lintel',position:[surface.position[0],floorIndex*layout.floorHeight+(layout.floorHeight+2.1)/2,surface.position[2]],size:[1,layout.floorHeight-2.1,layout.wallThickness]})
      }else result.push(surface)
    }
  }
  for(const room of rooms){
    const xs=room.polygon.map(p=>p[0]),zs=room.polygon.map(p=>p[1]),x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2
    let pieces=polygonTriangles(room.polygon)
    for(const stairs of layout.stairs?.filter(s=>s.floor+1===room.floor)??[]){
      const [cx,cz]=stairs.position,w=stairs.width/2,r=stairs.run/2
      pieces=subtractOpening(pieces,[[cx-w,cz-r],[cx+w,cz-r],[cx+w,cz+r],[cx-w,cz+r]])
    }
    for(const opening of layout.floorOpenings?.filter(o=>o.floor===room.floor)??[]){
      const [cx,cz]=opening.position,w=opening.width/2,d=opening.depth/2
      pieces=subtractOpening(pieces,[[cx-w,cz-d],[cx+w,cz-d],[cx+w,cz+d],[cx-w,cz+d]])
    }
    result.push({id:`${layout.id}-${room.id}-floor`,kind:'floor',name:`${room.name} floor`,position:[x,room.floor*layout.floorHeight,z],rotation:[-Math.PI/2,0,0],size:[Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs),.12],color:'#cdbb9d',polygons:pieces.map(poly=>poly.map(p=>[p[0]-x,z-p[1]])),building:{id:layout.id,floor:room.floor,stage:'floor',roomId:room.id}})
  }
  for(const [index,stairs] of (layout.stairs??[]).entries()){
    const steps=Math.ceil(layout.floorHeight/.18),tread=stairs.run/steps
    for(let step=0;step<steps;step++)result.push({id:`${layout.id}-stairs-${stairs.floor}-${index}-${step}`,kind:'floor',name:`Stairs to floor ${stairs.floor+2}, step ${step+1}`,position:[stairs.position[0],stairs.floor*layout.floorHeight+(step+1)*layout.floorHeight/steps,stairs.position[1]-stairs.run/2+(step+.5)*tread],rotation:[-Math.PI/2,0,0],size:[stairs.width,tread,.1],color:'#b9a887',building:{id:layout.id,floor:stairs.floor,stage:'floor'}})
  }
  for(const [floorIndex] of layout.floors.entries()){
    const {groups,owners}=roofGroups(rooms.filter(room=>room.floor===floorIndex))
    const walls=new Map(layout.floors[floorIndex].walls.map(wall=>[wall.id,wall]))
    for(const group of groups){
      const planes=roofPlanes(layout,group)
      const hips=layout.roofShape==='hip'&&layout.roofPitch>0?hipFaces(group,layout.roofPitch):undefined
      for(const room of group){
        const exposed=exposedRoofPolygons(room,rooms)
        if(!exposed.length)continue
        const wholeFootprint=group.length===1&&Math.abs(exposed.reduce((area,poly)=>area+Math.abs(polygonArea(poly)),0)-room.area)<1e-6
        result.push(...roofSurfaces(layout,room,exposed,planes,hips,wholeFootprint))
        if(!hips&&layout.roofShape!=='flat'&&layout.roofPitch>0)result.push(...roofWallCaps(layout,room,planes,owners,walls,exposed))
      }
    }
  }
  if(result.length>5000)throw new Error('This building exceeds the 5000-surface workspace capacity. Reduce curve detail or divide the layout.')
  return result
}

import { ShapeUtils } from 'three/src/extras/ShapeUtils.js'
import { Vector2 } from 'three/src/math/Vector2.js'
import { Vector3 } from 'three/src/math/Vector3.js'
import { Matrix4 } from 'three/src/math/Matrix4.js'
import { Euler } from 'three/src/math/Euler.js'
import type { BuildingLayout, PlanPoint, PlanRoom } from './building-model'
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

function roofSurfaces(layout:BuildingLayout,room:PlanRoom,footprints:PlanPoint[][],rooms:PlanRoom[]):Structure[] {
  // Shared planes keep internal room divisions from creating competing ridges.
  // Each surface is still clipped to its exposed room footprint.
  const outline=rooms.filter(candidate=>candidate.floor===room.floor).flatMap(candidate=>candidate.polygon)
  const xs=outline.map(p=>p[0]),zs=outline.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),slope=Math.tan(layout.roofPitch*Math.PI/180)
  const planes:Triple[]=layout.roofShape==='flat'||layout.roofPitch===0?[[0,0,0]]:layout.roofShape==='shed'?[[0,slope,-minZ*slope]]:layout.roofShape==='gable'?[[0,slope,-minZ*slope],[0,-slope,maxZ*slope]]:[[slope,0,-minX*slope],[-slope,0,maxX*slope],[0,slope,-minZ*slope],[0,-slope,maxZ*slope]]
  const triangles=footprints,result:Structure[]=[]
  for(const [index,plane] of planes.entries()){
    const pieces:PlanPoint[][]=[]
    for(const triangle of triangles){
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
  for(const room of rooms){const exposed=exposedRoofPolygons(room,rooms);if(exposed.length)result.push(...roofSurfaces(layout,room,exposed,rooms))}
  if(result.length>5000)throw new Error('This building exceeds the 5000-surface workspace capacity. Reduce curve detail or divide the layout.')
  return result
}

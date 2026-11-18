import type {PlanPoint} from './building-model'
import {pointInPolygon} from './building-plan'
import type {Structure} from './model'

export const surfacePolygons=(surface:Structure):PlanPoint[][]=>surface.polygons??[[[-surface.size[0]/2,-surface.size[1]/2],[surface.size[0]/2,-surface.size[1]/2],[surface.size[0]/2,surface.size[1]/2],[-surface.size[0]/2,surface.size[1]/2]]]
export function surfaceContains(surface:Structure,point:PlanPoint,tolerance=0):boolean {
  return surfacePolygons(surface).some(poly=>{
    if(pointInPolygon(point,poly))return true
    if(!tolerance)return false
    return poly.some((a,i)=>{const b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)<=tolerance})
  })
}
export function segmentFits(surface:Structure,a:PlanPoint,b:PlanPoint,tolerance=0):boolean {
  if(!surfaceContains(surface,a,tolerance)||!surfaceContains(surface,b,tolerance))return false
  const r=[b[0]-a[0],b[1]-a[1]],parameters=[0,1]
  for(const poly of surfacePolygons(surface))for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],s=[q[0]-p[0],q[1]-p[1]],den=r[0]*s[1]-r[1]*s[0]
    if(Math.abs(den)<1e-9)continue
    const t=((p[0]-a[0])*s[1]-(p[1]-a[1])*s[0])/den,u=((p[0]-a[0])*r[1]-(p[1]-a[1])*r[0])/den
    if(t>0&&t<1&&u>=0&&u<=1)parameters.push(t)
  }
  parameters.sort((a,b)=>a-b)
  for(let i=1;i<parameters.length;i++){const t=(parameters[i-1]+parameters[i])/2;if(!surfaceContains(surface,[a[0]+r[0]*t,a[1]+r[1]*t],tolerance))return false}
  return true
}
export function rectangleFits(surface:Structure,r:{x:number;y:number;width:number;height:number}):boolean {
  const points:PlanPoint[]=[[r.x-r.width/2,r.y-r.height/2],[r.x+r.width/2,r.y-r.height/2],[r.x+r.width/2,r.y+r.height/2],[r.x-r.width/2,r.y+r.height/2]]
  return points.every((point,i)=>segmentFits(surface,point,points[(i+1)%4]))
}

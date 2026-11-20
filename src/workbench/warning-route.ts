import {buildOrthogonalRoute,type RouteObstacle,type RoutePoint} from '../routing'

export function clearLeader(points:RoutePoint[],obstacles:RouteObstacle[]):boolean{
 return points.slice(1).every((b,i)=>{
  const a=points[i]
  return obstacles.every(r=>a.x===b.x?!(a.x>r.left&&a.x<r.right&&Math.max(a.y,b.y)>r.top&&Math.min(a.y,b.y)<r.bottom):a.y===b.y?!(a.y>r.top&&a.y<r.bottom&&Math.max(a.x,b.x)>r.left&&Math.min(a.x,b.x)<r.right):false)
 })
}
/** Prefer short orthogonal leaders. Never fall back to a line through equipment. */
export function warningLeader(anchors:RoutePoint[],end:RoutePoint,obstacles:RouteObstacle[]):RoutePoint[]|null{
 const candidates:RoutePoint[][]=[]
 for(const start of anchors){
  candidates.push([start,{x:end.x,y:start.y},end],[start,{x:start.x,y:end.y},end])
  for(const y of [...new Set(obstacles.flatMap(r=>[r.top-5,r.bottom+5]))])for(const x of [start.x-6,start.x+6])candidates.push([start,{x,y:start.y},{x,y},{x:end.x,y},end])
 }
 const length=(p:RoutePoint[])=>p.slice(1).reduce((sum,b,i)=>sum+Math.abs(p[i].x-b.x)+Math.abs(p[i].y-b.y),0)
 const clear=candidates.filter(p=>clearLeader(p,obstacles)).sort((a,b)=>length(a)-length(b))[0]
 if(clear)return clear
 if(obstacles.length<=18)for(const start of anchors){const route=buildOrthogonalRoute(start,end,[],obstacles);if(!route.blocked&&clearLeader(route.points,obstacles))return route.points}
 return null
}

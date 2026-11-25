import {validSiteSnapshot,type SiteSnapshot} from './site-snapshot'
export type PlanPoint = [number, number]
export type PlanNode = { id: string; point: PlanPoint }
export type PlanWall = { id: string; a: string; b: string; control?: PlanPoint; door?:boolean }
export type FloorPlan = { id: string; nodes: PlanNode[]; walls: PlanWall[] }
export type BuildingLayout = {
  id: string; floors: FloorPlan[]; floorHeight: number; wallThickness: number;
  roofShape: 'flat' | 'gable' | 'hip' | 'shed'; roofPitch: number;
  siteSnapshot?: SiteSnapshot
  northBearing?: number; solarHemisphere?: 'south' | 'north'; equipmentPlacements?: Record<string,{roomId:string;wallId?:string}>; roomNames: Record<string, string>; equipmentRoomId?: string; panelRoomId?: string
  stairs?:Array<{floor:number;position:PlanPoint;width:number;run:number}>
  floorOpenings?:Array<{id:string;floor:number;position:PlanPoint;width:number;depth:number}>
}
export type PlanRoom = { id: string; floor: number; name: string; polygon: PlanPoint[]; walls: string[]; area: number }

export function validBuilding(value: unknown): value is BuildingLayout {
  if (!value || typeof value !== 'object') return false
  const b = value as BuildingLayout
  const id = (value: unknown) => typeof value === 'string' && /^[\w-]+$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value)
  const point = (value: unknown): value is PlanPoint => Array.isArray(value) && value.length === 2 && value.every(n => Number.isFinite(n) && Math.abs(n) <= 10000)
  if (!id(b.id) || !Array.isArray(b.floors) || !b.floors.length || b.floors.length > 100 || !Number.isFinite(b.floorHeight) || b.floorHeight < .2 || b.floorHeight > 10 || !Number.isFinite(b.wallThickness) || b.wallThickness < .05 || b.wallThickness > 1 || !['flat', 'gable', 'hip', 'shed'].includes(b.roofShape) || !Number.isFinite(b.roofPitch) || b.roofPitch < 0 || b.roofPitch > 65 || !b.roomNames || typeof b.roomNames !== 'object' || Array.isArray(b.roomNames) || Object.values(b.roomNames).some(name => typeof name !== 'string') || b.equipmentRoomId !== undefined && !id(b.equipmentRoomId) || b.panelRoomId !== undefined && !id(b.panelRoomId)) return false
  if(b.siteSnapshot!==undefined&&!validSiteSnapshot(b.siteSnapshot))return false
  if(b.northBearing!==undefined&&(!Number.isFinite(b.northBearing)||b.northBearing<0||b.northBearing>=360))return false
  if(b.solarHemisphere!==undefined&&!['south','north'].includes(b.solarHemisphere))return false
  if(b.equipmentPlacements!==undefined&&(!b.equipmentPlacements||typeof b.equipmentPlacements!=='object'||Object.values(b.equipmentPlacements).some(p=>!p||!id(p.roomId)||p.wallId!==undefined&&!id(p.wallId))))return false
  if(b.stairs!==undefined&&(!Array.isArray(b.stairs)||b.stairs.length>99||b.stairs.some(s=>!s||!Number.isSafeInteger(s.floor)||s.floor<0||s.floor>=b.floors.length-1||!point(s.position)||!Number.isFinite(s.width)||s.width<.7||s.width>5||!Number.isFinite(s.run)||s.run<1||s.run>15)))return false
  if(b.floorOpenings!==undefined&&(!Array.isArray(b.floorOpenings)||b.floorOpenings.length>100||b.floorOpenings.some(o=>!o||!id(o.id)||!Number.isSafeInteger(o.floor)||o.floor<0||o.floor>=b.floors.length||!point(o.position)||!Number.isFinite(o.width)||o.width<=0||!Number.isFinite(o.depth)||o.depth<=0)))return false
  const ids = new Set<string>([b.id])
  let total = 0
  for (const floor of b.floors) {
    if (!floor || !id(floor.id) || ids.has(floor.id) || !Array.isArray(floor.nodes) || !Array.isArray(floor.walls) || floor.nodes.length > 2000 || floor.walls.length > 2000) return false
    ids.add(floor.id)
    const nodes = new Set<string>()
    for (const node of floor.nodes) { if (!node || !id(node.id) || ids.has(node.id) || !point(node.point)) return false; nodes.add(node.id); ids.add(node.id) }
    for (const wall of floor.walls) { if (!wall || !id(wall.id) || ids.has(wall.id) || wall.a === wall.b || !nodes.has(wall.a) || !nodes.has(wall.b) || wall.control !== undefined && !point(wall.control) || wall.door!==undefined&&typeof wall.door!=='boolean') return false; ids.add(wall.id) }
    total += floor.walls.length
  }
  return total <= 5000
}

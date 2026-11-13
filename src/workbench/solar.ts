import {getPosition} from 'suncalc'
import {Quaternion} from 'three/src/math/Quaternion.js'
import {Vector3} from 'three/src/math/Vector3.js'
import type {Device,Project,SolarSite,Triple} from './model'
import {angles,orientation,rotateDevice,updateStructure} from './spatial'

const radians=Math.PI/180,degrees=180/Math.PI
export const defaultSolarSite:SolarSite={enabled:false,latitude:-26.2041,longitude:28.0473,date:'2026-11-12T10:00:00.000Z',utcOffsetMinutes:120,diffuseFraction:.15}
export function facing(rotation:Triple=[0,0,0]){
 const normal=new Vector3(0,0,1).applyQuaternion(orientation(rotation))
 return {tilt:Math.acos(Math.max(-1,Math.min(1,normal.y)))*degrees,azimuth:Math.hypot(normal.x,normal.z)<1e-8?180:(Math.atan2(normal.x,-normal.z)*degrees+360)%360,normal}
}
export function facingRotation(tilt:number,azimuth:number):Triple {
 return angles(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),(180-azimuth)*radians).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),(tilt-90)*radians)))
}
export function setPanelFacing(project:Project,id:string,tilt:number,azimuth:number):Project {
 if(!Number.isFinite(tilt)||!Number.isFinite(azimuth)||tilt<0||tilt>90)throw new Error('Panel tilt must be between 0 and 90 degrees')
 return rotateDevice(project,id,facingRotation(tilt,azimuth))
}
export function setRoofFacing(project:Project,id:string,tilt:number,azimuth:number):Project {
 if(!Number.isFinite(tilt)||!Number.isFinite(azimuth)||tilt<0||tilt>90)throw new Error('Roof pitch must be between 0 and 90 degrees')
 return updateStructure(project,id,{rotation:facingRotation(tilt,azimuth)})
}
export function siteSun(site:SolarSite){
 const position=getPosition(new Date(site.date),site.latitude,site.longitude)
 const a=position.azimuth*radians,h=position.altitude*radians
 return {...position,direction:new Vector3(Math.sin(a)*Math.cos(h),Math.sin(h),-Math.cos(a)*Math.cos(h))}
}
/** Relative beam incidence plus an explicit isotropic diffuse-sky assumption; no weather/shadow model. */
export function solarExposure(project:Project,device:Device):number {
 const site=project.solarSite;if(!site?.enabled)return 1
 const sun=siteSun(site);if(sun.altitude<=0)return 0
 const normal=facing(device.rotation).normal
 return Math.max(0,(1-site.diffuseFraction)*Math.max(0,normal.dot(sun.direction))+site.diffuseFraction*(1+normal.y)/2)
}

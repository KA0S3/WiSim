import type {Device} from './model'
import {physicalProfile} from './profiles'
export function ProfileNote({device}:{device:Device}){
 const p=physicalProfile(device.physicalProfile)
 if(!p)return <p className="small muted">Generic enclosure dimensions. Terminal placement is approximate.</p>
 const unchanged=p.dimensions.every((n,i)=>Math.abs(n-device.spec[(['width','height','depth'] as const)[i]])<1e-8)
 return <p className="small muted"><a href={p.source} target="_blank" rel="noreferrer">{unchanged?'Manufacturer dimensions':'Edited dimensions; original reference'}: {p.name}</a><br/>{p.dimensions.map(n=>Math.round(n*1000)).join(' × ')} mm (W × H × D). Appearance and terminal positions are approximate. {p.geometryOnly&&'Enclosure reference only; electrical behaviour uses the generic model. '}Reference checked {p.checked}.</p>
}

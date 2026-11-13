import test from 'node:test'
import assert from 'node:assert/strict'
import {Vector3} from 'three/src/math/Vector3.js'
import {blankProject,makeDevice,connect,validateProject} from '../src/workbench/model.ts'
import {CATALOG_RECORDS} from '../src/catalog.ts'
import {matchingProducts} from '../src/workbench/product-matching.ts'
import {defaultSolarSite,facing,facingRotation,siteSun,solarExposure,setPanelFacing,setRoofFacing} from '../src/workbench/solar.ts'
import {makeStructure,mountDevice,deviceCenter,transformPoint,orientation} from '../src/workbench/spatial.ts'
import {ensureReferences} from '../src/workbench/references.ts'

test('catalogue matching respects voltage and configured capacity without substituting an undersized product',()=>{
 const b=makeDevice('battery',0,0);assert.equal(matchingProducts(b,CATALOG_RECORDS).length,0)
 b.spec.voltage=12.8;b.spec.capacityAh=150
 const matches=matchingProducts(b,CATALOG_RECORDS)
 assert.ok(matches.length);assert.equal(matches[0].capacityAh,160)
 assert.ok(matches.every(r=>r.voltage===12.8&&r.capacityAh>=150&&r.status==='verified'))
 b.spec.capacityAh=500;assert.equal(matchingProducts(b,CATALOG_RECORDS).length,0)
})
test('compass tilt and azimuth produce the expected north/east/south panel normals',()=>{
 for(const azimuth of [0,90,180,270]){
  const pose=facing(facingRotation(30,azimuth));assert.ok(Math.abs(pose.tilt-30)<1e-8)
  assert.ok(Math.abs(pose.azimuth-azimuth)<1e-8)
 }
 assert.ok(Math.abs(facing(facingRotation(0,0)).normal.y-1)<1e-10)
})
test('tilted roof-mounted panels retain clearance instead of penetrating the roof plane',()=>{
 let p=blankProject();const roof=makeStructure('roof'),panel=makeDevice('pv',0,0);p.structures=[roof];p.devices=[panel]
 p=setRoofFacing(p,roof.id,20,0);p=mountDevice(p,panel.id,roof.id);p=setPanelFacing(p,panel.id,45,90)
 const d=p.devices[0],s=p.structures[0],inverse=orientation(s.rotation).invert()
 let closest=Infinity
 for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){
  const world=transformPoint([x*d.spec.width,y*d.spec.height,z*d.spec.depth],deviceCenter(d),d.rotation)
  const local=new Vector3(...world).sub(new Vector3(...s.position)).applyQuaternion(inverse)
  closest=Math.min(closest,local.z-s.size[2]/2)
 }
 assert.ok(Math.abs(closest-.01)<1e-8)
 assert.ok(validateProject(p))
})
test('solar incidence is opt-in, responds to facing and becomes zero at night',()=>{
 let p=blankProject();const d=makeDevice('pv',0,0);p.devices=[d]
 assert.equal(solarExposure(p,d),1)
 p.solarSite={...defaultSolarSite,enabled:true};const sun=siteSun(p.solarSite)
 assert.ok(sun.altitude>0)
 p=setPanelFacing(p,d.id,90-sun.altitude,sun.azimuth)
 assert.ok(solarExposure(p,p.devices[0])>.9)
 p=setPanelFacing(p,d.id,90,(sun.azimuth+180)%360);assert.ok(solarExposure(p,p.devices[0])<.1)
 p.solarSite.date='2026-11-12T22:00:00.000Z';assert.equal(solarExposure(p,p.devices[0]),0)
 assert.ok(validateProject(JSON.parse(JSON.stringify(p))))
 const invalid=structuredClone(p);invalid.solarSite.latitude=100;assert.equal(validateProject(invalid),false)
})
test('drawing references survive deletion, geometry edits and later additions',()=>{
 const p=blankProject(),a=makeDevice('battery',0,0),b=makeDevice('resistor',300,0);p.devices=[a,b];p.wires=[connect(a,'p',b,'p')]
 const first=ensureReferences(p),later=ensureReferences({...first,devices:[first.devices[1],makeDevice('resistor',500,0)],wires:[]})
 assert.equal(later.devices[0].reference,'D2');assert.equal(later.devices[1].reference,'D3')
 assert.equal(first.wires[0].reference,'W1')
 const invalid=structuredClone(first);invalid.devices[1].reference='D1';assert.equal(validateProject(invalid),false)
})

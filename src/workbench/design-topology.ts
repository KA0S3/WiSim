import {blankProject,makeDevice,connect,type Device,type Project,type Requirements,type Wire} from './model'
import {physicalWirePoints,routeLength,synchronizeLengths} from './geometry'
import {sizeVoltageDropPath} from './design-sizing'
import {createEquipmentGroup} from './equipment-groups'

export function buildDesignTopology(r:Requirements,modules:number,packs:number,inverterW:number,controllerCurrent:number):Project{
 if(!Number.isSafeInteger(modules)||modules<2||modules%2||!Number.isSafeInteger(packs)||packs<1||![inverterW,controllerCurrent].every(v=>Number.isFinite(v)&&v>0))throw new Error('Individual design quantities and ratings must be positive; two-panel strings require an even panel count.')
 if(modules+modules/2+packs*2+8>500)throw new Error('This proposal exceeds the current 500-device interactive project limit. Split the installation into projects.')
 let p=blankProject();p.requirements={...r}
 const strings=modules/2,pvMid=(strings-1)*600/2,bankY=Math.max(strings*600+300,pvMid+1800)
 const add=(kind:Device['kind'],x:number,y:number,name:string,physical:Device['physical'])=>{const d=makeDevice(kind,x,y,name);d.physical=physical;p.devices.push(d);return d}
 const pvPlus=add('bus',1950,pvMid,'PV positive collector',[2,.8,-.5]),pvMinus=add('bus',1950,pvMid+600,'PV negative collector',[2,.4,-.5])
 const controller=add('mppt',2600,pvMid+300,`${controllerCurrent} A solar controller`,[2.8,.8,0]);Object.assign(controller.spec,{watts:modules*400,voltage:80,rating:controllerCurrent})
 const positive=add('bus',3900,bankY,'Battery positive bus',[.5,.5,1]),negative=add('bus',3900,bankY+600,'Battery negative bus',[.5,.2,1])
 const mainFuse=add('fuse',4550,bankY, 'Main battery protection',[1,.5,1]);mainFuse.spec.rating=Math.ceil(((inverterW/.94+8)/44)*1.25/25)*25
 const inverter=add('inverter',5200,bankY,`${inverterW/1000} kW inverter`,[1.5,.2,1]);Object.assign(inverter.spec,{watts:inverterW,rating:inverterW*2})
 const load=add('load',5850,bankY,'Essential loads',[2.5,0,1.5]);load.spec.watts=r.peakW
 if(r.region==='US')for(const d of [inverter,load]){d.spec.voltage=120;d.spec.frequency=60}
 const physicalLength=(w:Wire)=>routeLength(physicalWirePoints(p,w))
 const lengthAtLeast=(w:Wire,minimum:number)=>{w.lengthMode='physical';w.slack=Math.max(0,minimum-physicalLength(w));w.length=physicalLength(w)+w.slack;return w}
 const wire=(a:Device,ap:string,b:Device,bp:string,minimum=0,positive=false)=>{const w=lengthAtLeast(connect(a,ap,b,bp),minimum);if(positive)w.color='#d47c62';p.wires.push(w);return w}
 for(let i=0;i<strings;i++){
  const a=add('pv',0,i*600,`PV string ${i+1} / panel 1`,[0,1.1,-i*2]),b=add('pv',650,i*600,`PV string ${i+1} / panel 2`,[1.2,1.1,-i*2])
  for(const panel of [a,b]){Object.assign(panel.spec,{watts:400,voltage:40,voc:48,isc:10.7});panel.rotation=[-Math.PI/2,0,0]}
  const fuse=add('fuse',1300,i*600,`PV string ${i+1} protection`,[2,.8,-i*2]);fuse.spec.rating=15
  const path=[wire(a,'p',fuse,'p'),wire(fuse,'n',pvPlus,'p',0,true),wire(a,'n',b,'p'),wire(b,'n',pvMinus,'p')]
  sizeVoltageDropPath(path,10.7,80,.005,p.ambient,`PV string ${i+1}`,4)
 }
 const collect=[wire(pvPlus,'n',controller,'pv+',8,true),wire(pvMinus,'n',controller,'pv-',8)]
 sizeVoltageDropPath(collect,strings*10.7,80,.015,p.ambient,'PV collector to controller',4)
 const branches:Wire[][]=[]
 for(let i=0;i<packs;i++){
  const battery=add('battery',2600,bankY+i*600,`Battery pack ${i+1} / 5.12 kWh`,[i*.6,0,2])
  Object.assign(battery.spec,{voltage:51.2,capacityAh:100,rating:100,resistance:.015})
  const fuse=add('fuse',3250,bankY+i*600,`Battery pack ${i+1} protection`,[i*.6,.3,1.7]);fuse.spec.rating=125
  branches.push([wire(battery,'p',fuse,'p'),wire(fuse,'n',positive,'p',0,true),wire(battery,'n',negative,'p')])
 }
 // Equal loop lengths/areas keep identical parallel packs balanced at the design operating point.
 const branchLength=Math.max(1,...branches.flatMap(path=>[path[0].length+path[1].length,path[2].length]))
 const inputCurrent=(inverterW/.94+8)/44,branchCurrent=Math.max(inputCurrent,controllerCurrent)/packs
 for(const path of branches){lengthAtLeast(path[1],branchLength-path[0].length);lengthAtLeast(path[2],branchLength);sizeVoltageDropPath(path,branchCurrent,44,.005,p.ambient,'Parallel battery branch',10)}
 const inverterPath=[wire(positive,'n',mainFuse,'p',r.cableLength/2,true),wire(mainFuse,'n',inverter,'dc+',r.cableLength/2,true),wire(negative,'n',inverter,'dc-',r.cableLength)]
 sizeVoltageDropPath(inverterPath,inputCurrent,44,.015,p.ambient,'Battery bus to inverter',10)
 const chargePath=[wire(controller,'bat+',positive,'t',2),wire(controller,'bat-',negative,'t',2)]
 sizeVoltageDropPath(chargePath,controllerCurrent,44,.015,p.ambient,'Controller to battery bus',6)
 sizeVoltageDropPath([wire(inverter,'l',load,'p',10),wire(inverter,'n',load,'n',10)],inverterW/inverter.spec.voltage,inverter.spec.voltage,.01,p.ambient,'Inverter AC output')
 p=createEquipmentGroup(p,p.devices.filter(d=>d.kind==='pv'||d.id===pvPlus.id||d.id===pvMinus.id||d.kind==='fuse'&&d.name.startsWith('PV string')).map(d=>d.id),'Solar array / '+modules+' panels')
 if(packs>1)p=createEquipmentGroup(p,p.devices.filter(d=>d.kind==='battery'||d.id===positive.id||d.id===negative.id||d.kind==='fuse'&&d.name.startsWith('Battery pack')).map(d=>d.id),'Battery bank / '+packs+' packs')
 p=synchronizeLengths(p)
 return p
}

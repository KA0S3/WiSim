import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import path from 'node:path'
import {blankProject,makeDevice,connect,validateProject} from '../src/workbench/model.ts'
import {synchronizeLengths} from '../src/workbench/geometry.ts'
await mkdir('artifacts',{recursive:true});await mkdir('.cache/browser-temp',{recursive:true});process.env.TEMP=path.resolve('.cache/browser-temp');process.env.TMP=process.env.TEMP
const baseUrl=process.env.WISIM_URL??'http://127.0.0.1:4182/';let server
if(!process.env.WISIM_URL){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4182','--strictPort'],{stdio:'pipe',windowsHide:true});let ready=false;for(let i=0;i<80;i++){try{if((await fetch(baseUrl)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}if(!ready){server.kill();throw Error('Large-system preview failed to start')}}
const browser=await chromium.launch({channel:'msedge',headless:true}).catch(e=>{server?.kill();throw e}),results=[]
function coupledSolar(){
 const p=blankProject();p.name='500-device coupled solar, storage and AC network'
 const add=(kind,name)=>{const d=makeDevice(kind,(p.devices.length%20)*300,Math.floor(p.devices.length/20)*250,name);p.devices.push(d);return d},wire=(a,ap,b,bp,area=240,length=.3)=>p.wires.push(connect(a,ap,b,bp,area,length))
 const battery=add('battery','Main battery bank'),pos=add('bus','Positive bus'),neg=add('bus','Negative bus'),pvPos=add('bus','PV positive collector'),pvNeg=add('bus','PV negative collector'),controller=add('mppt','Solar controller'),inverter=add('inverter','AC inverter')
 Object.assign(battery.spec,{capacityAh:2000,rating:5000,resistance:.0002});Object.assign(controller.spec,{watts:40000,rating:1000});Object.assign(inverter.spec,{watts:24000,rating:48000})
 wire(battery,'p',pos,'p');wire(battery,'n',neg,'p');wire(controller,'bat+',pos,'t');wire(controller,'bat-',neg,'t');wire(pos,'n',inverter,'dc+');wire(neg,'n',inverter,'dc-');wire(pvPos,'n',controller,'pv+');wire(pvNeg,'n',controller,'pv-')
 for(let i=0;i<50;i++){const a=add('pv',`String ${i+1} panel A`),b=add('pv',`String ${i+1} panel B`),f=add('fuse',`String ${i+1} fuse`);for(const d of [a,b])Object.assign(d.spec,{watts:400,voltage:40,voc:48,isc:10.7});f.spec.rating=15;wire(a,'p',f,'p',6);wire(f,'n',pvPos,'p',6);wire(a,'n',b,'p',6);wire(b,'n',pvNeg,'p',6)}
 for(let i=0;i<20;i++){const d=add('load',`AC load ${i+1}`);d.spec.watts=600;wire(inverter,'l',d,'p',4);wire(inverter,'n',d,'n',4)}
 while(p.devices.length<500){const d=add('dc-load',`DC branch ${p.devices.length}`);d.spec.watts=1;wire(pos,'b',d,'p',2.5);wire(neg,'b',d,'n',2.5)}
 return p
}
try{
 for(const scenario of (process.env.WISIM_LARGE_CASES??'100,250,500,solar').split(',')){
  let count=Number(scenario)
  let project=blankProject();project.name=`Connected ${count}-device DC distribution`;const battery=makeDevice('battery',0,0,'Main battery bank');Object.assign(battery.spec,{rating:2000,capacityAh:2000,resistance:.001});project.devices=[battery]
  for(let i=1;i<count;i++){const d=makeDevice('dc-load',(i%20)*300,Math.floor(i/20)*250,`Branch ${i}`);d.spec.watts=d.spec.voltage**2/100;project.devices.push(d);project.wires.push(connect(battery,'p',d,'p',2.5,2),connect(battery,'n',d,'n',2.5,2))}
  if(scenario==='solar'){project=coupledSolar();count=500}
  project=synchronizeLengths(project);expect(validateProject(project)).toBe(true)
  const context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(({project,sourceId})=>{
   localStorage.setItem('wisim-workbench-v4',JSON.stringify(project));window.largeFrames=[];const NativeWorker=Worker
   const sum=(f,kind)=>project.devices.filter(d=>d.kind===kind).reduce((total,d)=>total+f.devices[d.id].power,0)
   window.Worker=class extends NativeWorker{constructor(url,options){super(url,options);this.addEventListener('message',e=>{if(e.data.type==='frame'){const f=e.data.frame;window.largeFrames.push({time:f.time,durationMs:f.durationMs,sourcePower:f.devices[sourceId].power,loadPower:sum(f,'dc-load')+sum(f,'load'),acLoadPower:sum(f,'load'),pvPower:sum(f,'pv'),inverterPower:sum(f,'inverter'),cableLoss:Object.values(f.wires).reduce((sum,r)=>sum+r.loss,0),devices:Object.keys(f.devices).length,wires:Object.keys(f.wires).length,transferred:f.times instanceof Float64Array,samples:f.times.length})}})}}
  },{project,sourceId:project.devices.find(d=>d.kind==='battery').id})
  const start=Date.now();await page.goto(baseUrl,{waitUntil:'networkidle'});await expect.poll(()=>page.evaluate(()=>window.largeFrames.length),{timeout:60000}).toBeGreaterThanOrEqual(2)
  const frames=await page.evaluate(()=>window.largeFrames),last=frames.at(-1)
  expect(last.devices).toBe(count);expect(last.wires).toBe(project.wires.length);expect(last.time).toBeGreaterThan(frames[0].time);expect(last.transferred).toBe(true)
  if(scenario==='solar'){expect(last.pvPower).toBeGreaterThan(20000);expect(last.sourcePower).toBeLessThan(0);expect(last.acLoadPower).toBeGreaterThan(11000);expect(last.inverterPower).toBeGreaterThan(last.acLoadPower)}
  else expect(Math.abs(last.sourcePower-last.loadPower-last.cableLoss)).toBeLessThan(Math.max(.1,last.sourcePower*.0001))
  await expect(page.locator('.power-metrics')).not.toContainText('—')
  await expect(page.locator('.react-flow__edge')).toHaveCount(project.wires.length,{timeout:15000})
  await page.getByRole('button',{name:'Pause simulation',exact:true}).click();await expect(page.getByRole('button',{name:'Run simulation',exact:true})).toBeVisible();expect(errors).toEqual([])
  const result={scenario,devices:count,conductors:project.wires.length,renderedConductors:await page.locator('.react-flow__edge').count(),twoLiveFramesMs:Date.now()-start,firstSolveMs:frames[0].durationMs,nextSolveMs:last.durationMs,...last,errors};results.push(result);console.log(JSON.stringify(result));await page.screenshot({path:`artifacts/qa-large-${scenario}.png`});await context.close()
 }
}finally{await writeFile('artifacts/large-system-check.json',JSON.stringify({date:new Date().toISOString(),environment:'Headless Edge on this host; real connected source/load networks using the production worker, not mocked solver replies.',results},null,2));await browser.close();server?.kill()}

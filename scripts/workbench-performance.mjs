import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import path from 'node:path'
import {blankProject,validateProject} from '../src/workbench/model.ts'
import {solarProject} from '../src/workbench/templates.ts'
import {synchronizeLengths} from '../src/workbench/geometry.ts'

await mkdir('artifacts',{recursive:true});await mkdir('.cache/browser-temp',{recursive:true})
process.env.TEMP=path.resolve('.cache/browser-temp');process.env.TMP=process.env.TEMP
const baseUrl=process.env.WISIM_URL??'http://127.0.0.1:4177/'
let server
if(!process.env.WISIM_URL){
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4177','--strictPort'],{stdio:'pipe',windowsHide:true})
 let ready=false
 for(let i=0;i<80;i++){try{if((await fetch(baseUrl)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}
 if(!ready){server.kill();throw Error('Benchmark preview failed to start')}
}
const browser=await chromium.launch({channel:'msedge',headless:true}).catch(e=>{server?.kill();throw e})
const results=[]
const fixture=groups=>{
 let p=blankProject();p.name=`Interaction benchmark / ${groups*7} devices`
 for(let i=0;i<groups;i++){
  const part=solarProject(),column=i%5,row=Math.floor(i/5)
  for(const d of part.devices){d.x+=column*1600;d.y+=row*800;d.physical[0]+=column*5;d.physical[2]+=row*4}
  p.devices.push(...part.devices);p.wires.push(...part.wires)
 }
 p=synchronizeLengths(p);if(!validateProject(p))throw Error('Invalid benchmark fixture');return p
}
try{
 for(const groups of (process.env.WISIM_BENCH_GROUPS??'1,12,28').split(',').map(Number)){
  const project=fixture(groups),context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>{
   window.webglDraws=0
   for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
    const prototype=WebGL2RenderingContext.prototype,original=prototype[name]
    prototype[name]=function(...args){window.webglDraws++;return original.apply(this,args)}
   }
  })
  await page.addInitScript(p=>localStorage.setItem('wisim-workbench-v4',JSON.stringify(p)),project)
  const started=Date.now()
  await page.goto(baseUrl,{waitUntil:'networkidle'})
  await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000})
  const readyMs=Date.now()-started
  await page.getByRole('button',{name:'3D workbench',exact:true}).click()
  const canvas=page.locator('.physical-view canvas');await expect(canvas).toBeVisible();await page.waitForTimeout(1500)
  const renderer=await canvas.evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'})
  const idleStart=await page.evaluate(()=>window.webglDraws);await page.waitForTimeout(1200)
  const idleDrawCalls=await page.evaluate(start=>window.webglDraws-start,idleStart)
  const measure=async(action)=>{
   await page.evaluate(()=>{
    window.bench={frames:[],pointerLatencies:[],longTasks:[],active:true,started:performance.now()};let last=performance.now()
    const listener=e=>{if(e.buttons)requestAnimationFrame(now=>{if(window.bench.active)window.bench.pointerLatencies.push(Math.max(0,now-e.timeStamp))})};window.addEventListener('pointermove',listener,true);window.bench.listener=listener
    const observer=new PerformanceObserver(list=>window.bench.longTasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({type:'longtask',buffered:false});window.bench.observer=observer
    const frame=now=>{if(!window.bench.active)return;window.bench.frames.push(now-last);last=now;requestAnimationFrame(frame)};requestAnimationFrame(frame)
   })
   await action()
   return page.evaluate(()=>{const b=window.bench;b.active=false;b.observer.disconnect();window.removeEventListener('pointermove',b.listener,true);const frames=b.frames.filter(n=>n>0).sort((a,c)=>a-c),latencies=b.pointerLatencies.sort((a,c)=>a-c),q=(list,f)=>list[Math.min(list.length-1,Math.floor(list.length*f))]??0;return {durationMs:performance.now()-b.started,frames:frames.length,medianMs:q(frames,.5),p95Ms:q(frames,.95),maxMs:frames.at(-1)??0,p95PointerToFrameMs:q(latencies,.95),longTasks:b.longTasks.length,maxLongTaskMs:Math.max(0,...b.longTasks)}})
  }
  const box=await canvas.boundingBox()
  const pan=await measure(async()=>{await page.mouse.move(box.x+box.width*.8,box.y+box.height*.6);await page.mouse.down({button:'right'});for(let i=0;i<45;i++){await page.mouse.move(box.x+box.width*.8+Math.sin(i/7)*80,box.y+box.height*.6+i/2);await page.waitForTimeout(16)}await page.mouse.up({button:'right'})})
  const battery=project.devices.find(d=>d.kind==='battery')
  await page.getByLabel('3D selection',{exact:true}).selectOption(battery.id)
  await page.getByRole('button',{name:'Focus selected',exact:true}).click();await page.keyboard.press('w');await page.keyboard.press('x');await page.waitForTimeout(600)
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4')))
  const before=await read(),x=box.x+box.width/2+50,y=box.y+box.height/2
  const drag=await measure(async()=>{await page.mouse.move(x,y);await page.mouse.down();for(let i=0;i<45;i++){await page.mouse.move(x+i*1.5,y);await page.waitForTimeout(16)}expect(await read()).toEqual(before);await page.mouse.up()})
  await page.waitForTimeout(600)
  const after=await read()
  const result={devices:project.devices.length,wires:project.wires.length,renderer,readyMs,idleDrawCalls,pan,drag,moved:after.devices.find(d=>d.id===battery.id).physical[0]!==battery.physical[0],errors}
  results.push(result);console.log(JSON.stringify(result))
  if(!result.moved)await page.screenshot({path:'artifacts/performance-failure.png'})
  expect(after.devices.find(d=>d.id===battery.id).physical[0]).toBeGreaterThan(battery.physical[0])
  expect(after.wires.map(w=>[w.id,w.from,w.fromPort,w.to,w.toPort])).toEqual(before.wires.map(w=>[w.id,w.from,w.fromPort,w.to,w.toPort]))
  await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForTimeout(500)
  expect((await read()).devices.find(d=>d.id===battery.id)).toEqual(before.devices.find(d=>d.id===battery.id))
  expect(errors).toEqual([])
  await context.close()
 }
}finally{await writeFile('artifacts/interaction-performance.json',JSON.stringify({date:new Date().toISOString(),environment:'Headless Microsoft Edge; timings describe this renderer and host, not all user hardware.',results},null,2));await browser.close();server?.kill()}

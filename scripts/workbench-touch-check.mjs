import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import path from 'node:path'
await mkdir('artifacts',{recursive:true});await mkdir('.cache/browser-temp',{recursive:true})
process.env.TEMP=path.resolve('.cache/browser-temp');process.env.TMP=process.env.TEMP
const baseUrl=process.env.WISIM_URL??'http://127.0.0.1:4178/'
let server
if(!process.env.WISIM_URL){
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4178','--strictPort'],{stdio:'pipe',windowsHide:true})
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(baseUrl)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}
 if(!ready){server.kill();throw Error('Touch preview failed to start')}
}
const browser=await chromium.launch({channel:'msedge',headless:true}).catch(e=>{server?.kill();throw e})
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage(),checks=[],errors=[]
page.on('pageerror',e=>errors.push(e.message))
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name)}
try{
 await page.goto(baseUrl,{waitUntil:'networkidle'})
 await expect(page.getByText('Physics engine connected',{exact:true})).toBeAttached({timeout:25000})
 await page.getByRole('button',{name:'3D workbench',exact:true}).tap()
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4'))),before=await saved(),battery=before.devices.find(d=>d.kind==='battery')
 const select=page.getByLabel('3D selection',{exact:true})
 await select.selectOption(battery.id)
 await check('phone settings can hide and reopen while keeping the selected equipment',async()=>{
  await expect(page.locator('.inspector')).toBeVisible()
  await page.getByRole('button',{name:'Hide equipment settings',exact:true}).tap()
  await expect(page.locator('.inspector')).toBeHidden();await expect(select).toHaveValue(battery.id)
  await page.getByRole('button',{name:'Show equipment settings',exact:true}).tap()
  await expect(page.getByRole('spinbutton',{name:'Nominal voltage',exact:true})).toHaveValue('51.2')
  await page.getByRole('button',{name:'Hide equipment settings',exact:true}).tap()
 })
 await page.getByRole('button',{name:'Focus selected',exact:true}).tap()
 await page.getByRole('button',{name:'Move W',exact:true}).tap()
 await page.getByRole('button',{name:'Hide 3D controls',exact:true}).tap()
 await expect(page.locator('.physical-editor')).toBeHidden();await page.waitForTimeout(700)
 const canvas=page.locator('.physical-view canvas'),box=await canvas.boundingBox(),x=box.x+box.width/2-50,y=box.y+box.height/2+40
 const cdp=await context.newCDPSession(page)
 await page.evaluate(()=>{window.touchEvents=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel','blur'])window.addEventListener(type,e=>window.touchEvents.push({type,pointerType:e.pointerType,x:e.clientX,y:e.clientY,target:e.target?.tagName,touchAction:getComputedStyle(document.querySelector('.physical-view canvas')).touchAction}),true)})
 const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id=1])=>({x,y,id,radiusX:4,radiusY:4,force:1}))})
 const drag=async(cancel=false)=>{
  await touch('touchStart',[[x,y]])
  for(let i=1;i<=12;i++){await touch('touchMove',[[x+i*4,y-i*2]]);await page.waitForTimeout(16)}
  await page.waitForTimeout(400)
  expect((await saved()).devices.find(d=>d.id===battery.id)).toEqual(battery)
  await touch(cancel?'touchCancel':'touchEnd',[]);await page.waitForTimeout(600)
 }
 await check('touch body dragging preserves wires and commits once with Undo',async()=>{
  await drag()
  const after=await saved();expect(after.devices.find(d=>d.id===battery.id).physical).not.toEqual(battery.physical)
  expect(after.wires).toEqual(before.wires)
  await page.getByRole('button',{name:'Undo',exact:true}).tap();await page.waitForTimeout(500)
  expect((await saved()).devices.find(d=>d.id===battery.id)).toEqual(battery)
 })
 await check('cancelled touch gestures discard the movement and unlock camera controls',async()=>{
  await drag(true)
  expect((await saved()).devices.find(d=>d.id===battery.id)).toEqual(battery)
 })
 await page.getByRole('button',{name:'Show 3D controls',exact:true}).tap()
 await page.getByRole('button',{name:'Camera V',exact:true}).tap()
 await page.getByRole('button',{name:'Hide 3D controls',exact:true}).tap()
 await check('one-finger orbit and two-finger zoom change only the camera',async()=>{
  const hardware=await saved(),image=await canvas.screenshot()
  await touch('touchStart',[[x,y]]);for(let i=1;i<=12;i++){await touch('touchMove',[[x+i*4,y+i*2]]);await page.waitForTimeout(16)}await touch('touchEnd',[]);await page.waitForTimeout(400)
  expect(await canvas.screenshot()).not.toEqual(image);expect(await saved()).toEqual(hardware)
  const rotated=await canvas.screenshot(),cx=box.x+box.width/2,cy=box.y+box.height/2
  await touch('touchStart',[[cx-30,cy,1],[cx+30,cy,2]])
  for(let i=1;i<=10;i++){await touch('touchMove',[[cx-30-i*3,cy,1],[cx+30+i*3,cy,2]]);await page.waitForTimeout(16)}await touch('touchEnd',[]);await page.waitForTimeout(400)
  expect(await canvas.screenshot()).not.toEqual(rotated);expect(await saved()).toEqual(hardware)
 })
 await page.screenshot({path:'artifacts/qa-phone-3d.png'});expect(errors).toEqual([])
}catch(e){await page.screenshot({path:'artifacts/touch-failure.png'});await writeFile('artifacts/touch-failure.txt',await page.locator('body').innerText());await writeFile('artifacts/touch-events.json',JSON.stringify(await page.evaluate(()=>window.touchEvents),null,2));throw e}
finally{await writeFile('artifacts/touch-check.json',JSON.stringify({checks,errors},null,2));await browser.close();server?.kill()}

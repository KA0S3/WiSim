import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {spawn} from 'node:child_process'

async function open3DMenu(page){
 const button=page.getByRole('button',{name:'3D controls',exact:true})
 if(await button.getAttribute('aria-pressed')==='false')await button.click()
}

await mkdir('artifacts',{recursive:true})
await mkdir('.cache/browser-temp',{recursive:true})
process.env.TEMP=path.resolve('.cache/browser-temp')
process.env.TMP=process.env.TEMP
const url=process.env.WISIM_URL??'http://127.0.0.1:4186/'
let server
if(!process.env.WISIM_URL){
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4186','--strictPort'],{stdio:'pipe',windowsHide:true})
 let ready=false
 for(let attempt=0;attempt<60;attempt++){try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,200))}
 if(!ready){server.kill();throw Error('Designer browser preview failed to start')}
}
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:900}})
const page=await context.newPage(),checks=[],errors=[]
page.on('pageerror',error=>errors.push(error.message))
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4')))
const filter=process.env.WISIM_UI_CHECKS?new RegExp(process.env.WISIM_UI_CHECKS):null
const check=async(name,action)=>{if(filter&&!filter.test(name))return;await action();checks.push(name);console.log('PASS '+name)}
const point=async(target,x,y)=>target.locator('.floor-plan').evaluate((svg,{x,y})=>{
 const box=svg.getBoundingClientRect(),view=svg.viewBox.baseVal
 return {x:box.left+(x-view.x)/view.width*box.width,y:box.top+(y-view.y)/view.height*box.height}
},{x,y})
const planClick=async(target,x,y)=>{const p=await point(target,x,y);await target.mouse.click(p.x,p.y)}
try{
 await page.goto(url,{waitUntil:'networkidle'})
 await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000})
 await page.getByRole('button',{name:'Auto design',exact:true}).click()
 await check('blank designer inputs restore automatic cable and MPPT sizing',async()=>{
  const cable=page.getByRole('spinbutton',{name:'Battery cable route, one way',exact:true})
  await expect(cable).toHaveValue('');await cable.fill('5');await cable.fill('');await cable.blur();await expect(cable).toHaveValue('')
  const text=await page.getByLabel('Panel and controller layout',{exact:true}).locator('option').first().textContent(),numbers=text.match(/\d+(?:\.\d+)?/g).map(Number)
  const power=page.getByRole('spinbutton',{name:'Panel strength (blank = compare models)',exact:true}),panels=page.getByRole('spinbutton',{name:'Number of panels (blank = automatic)',exact:true}),strings=page.getByRole('spinbutton',{name:'Number of strings (blank = automatic)',exact:true})
  await power.fill(String(numbers[1]));await panels.fill(String(numbers[0]));await strings.fill(String(numbers[2]));await strings.blur()
  expect(await page.getByLabel('Panel and controller layout',{exact:true}).locator('option').count()).toBeGreaterThan(0)
  await power.fill('');await panels.fill('');await strings.fill('');await strings.blur()
  await expect(power).toHaveValue('');await expect(panels).toHaveValue('');await expect(strings).toHaveValue('')
 })
 await page.locator('.building-fold>summary').click()
 await page.getByRole('checkbox',{name:'Include a home layout',exact:true}).check()
 await check('desktop floor plan connects intersecting walls and edits a curve',async()=>{
  await page.locator('.floor-plan').scrollIntoViewIfNeeded()
  const walls=page.locator('.floor-plan [aria-label^="Plan wall "]')
  const initialWalls=await walls.count()
  await planClick(page,-2,-1)
  const cancel=await point(page,-1,1)
  await page.mouse.click(cancel.x,cancel.y,{button:'right'})
  await expect(walls).toHaveCount(initialWalls)
  await expect(page.getByRole('button',{name:'Straight wall',exact:true})).toHaveAttribute('aria-pressed','true')
  await planClick(page,0,-3)
  await expect(walls).toHaveCount(initialWalls)
  await planClick(page,0,3)
  await page.mouse.click(cancel.x,cancel.y,{button:'right'})
  await expect(page.getByLabel('Indoor equipment room',{exact:true}).locator('option')).toHaveCount(3)
  await page.getByRole('button',{name:'Select',exact:true}).click()
  await planClick(page,0,0)
  await page.getByLabel('Selected wall shape',{exact:true}).selectOption('curve')
  await expect(page.locator('.floor-plan circle[fill="#d08e45"]')).toBeVisible()
  await page.getByRole('spinbutton',{name:'Number of floors',exact:true}).fill('2')
  await expect(page.getByLabel('Plan floor',{exact:true}).locator('option')).toHaveCount(2)
  await page.getByLabel('Plan floor',{exact:true}).selectOption('1')
  await expect(walls).toHaveCount(0)
  await page.getByRole('button',{name:'Copy layout from floor below',exact:true}).click()
  await expect.poll(()=>walls.count()).toBeGreaterThan(0)
  await expect(page.getByLabel('Floor 1 reference',{exact:true})).toBeAttached()
  await expect(page.getByRole('checkbox',{name:'Show outline of floor below and snap to its junctions',exact:true})).toBeChecked()
  await expect(page.getByLabel('Plan compass',{exact:true})).toBeAttached()
  await page.screenshot({path:'artifacts/qa-building-editor-desktop.png'})
 })
 await page.getByRole('checkbox',{name:'Include a home layout',exact:true}).uncheck()
 await page.getByRole('checkbox',{name:'Include a home layout',exact:true}).check()
 await check('system generation shows staged construction and a fitted 3D home',async()=>{
  await page.getByLabel('AC input',{exact:true}).selectOption('shore')
  await page.getByRole('button',{name:'Generate my system',exact:true}).click()
  await expect(page.locator('.physical-view canvas')).toBeVisible({timeout:30000})
  await expect(page.locator('.build-status')).toContainText('Building walls')
  await page.screenshot({path:'artifacts/qa-building-walls-stage.png'})
  await expect(page.locator('.build-status')).toContainText('Mounting solar panels',{timeout:10000})
  await expect(page.locator('.build-status')).toBeHidden({timeout:10000})
  await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000})
  const p=await saved()
  expect(p.building.floors).toHaveLength(1);expect(p.fitIssues).toHaveLength(0)
  expect(p.requirements.acInput).toBe('shore')
  const source=p.devices.find(d=>d.kind==='grid'),charger=p.devices.find(d=>d.kind==='charger')
  expect(source).toBeTruthy();expect(charger).toBeTruthy()
  expect(p.wires.some(w=>w.from===source.id&&w.fromPort==='n'&&w.to===charger.id&&w.toPort==='n')).toBe(true)
  expect(p.devices.every(d=>d.mount)).toBe(true);expect(p.wires.every(w=>w.autoRoute&&!w.autoRoute.error)).toBe(true)
  await page.keyboard.press('Escape')
  await page.screenshot({path:'artifacts/qa-building-complete.png'})
  await open3DMenu(page,'Selection')
 })
 await check('supported routes preview and cancel locally, apply and Undo once',async()=>{
  const original=await saved(),wire=original.wires[0]
  await open3DMenu(page,'Selection');await page.getByLabel('3D selection',{exact:true}).selectOption(wire.id)
  await page.getByRole('button',{name:'Add wire bend',exact:true}).click()
  await expect.poll(async()=>(await saved()).wires.find(w=>w.id===wire.id).autoRoute).toBeUndefined()
  const before=await saved()
  await page.getByRole('button',{name:'Preview supported route',exact:true}).click()
  await expect(page.getByRole('button',{name:'Apply supported route',exact:true})).toBeVisible()
  expect(await saved()).toEqual(before)
  await page.getByRole('button',{name:'Cancel route preview',exact:true}).click()
  expect(await saved()).toEqual(before)
  await page.getByRole('button',{name:'Preview supported route',exact:true}).click()
  await page.getByRole('button',{name:'Apply supported route',exact:true}).click()
  await expect.poll(async()=>!!(await saved()).wires.find(w=>w.id===wire.id).autoRoute).toBe(true)
  await page.getByRole('button',{name:'Undo',exact:true}).click()
  await expect.poll(async()=>!!(await saved()).wires.find(w=>w.id===wire.id).autoRoute).toBe(false)
 })
 await check('independent building editing preserves equipment placement and terminal connections',async()=>{
  const before=await saved()
  await page.getByRole('button',{name:'House designer',exact:true}).click()
  const compass=page.getByLabel('Plan compass',{exact:true})
  await compass.scrollIntoViewIfNeeded()
  const dial=await compass.locator('circle').first().boundingBox()
  const cx=dial.x+dial.width/2,cy=dial.y+dial.height/2,r=dial.width*.35
  const bearing=Number(await compass.getAttribute('aria-valuenow'))
  await page.mouse.move(cx+r,cy);await page.mouse.down()
  await page.mouse.move(cx+r,cy+1)
  expect(Math.abs(Number(await compass.getAttribute('aria-valuenow'))-bearing)).toBeLessThanOrEqual(5)
  await page.mouse.move(cx,cy+r,{steps:10});await page.mouse.up()
  await expect(compass).toHaveAttribute('aria-valuenow',String((bearing+90)%360))
  await page.getByRole('button',{name:'Undo floor plan edit',exact:true}).click()
  await page.getByRole('button',{name:'Select',exact:true}).click()
  const floor=before.building.floors[0],straight=floor.walls.find(w=>!w.control)
  const a=floor.nodes.find(n=>n.id===straight.a).point,b=floor.nodes.find(n=>n.id===straight.b).point
  await planClick(page,(a[0]+b[0])/2,(a[1]+b[1])/2)
  const length=page.getByRole('spinbutton',{name:'Selected wall length',exact:true})
  const previousLength=Math.hypot(a[0]-b[0],a[1]-b[1])
  expect(Number(await length.inputValue())).toBeCloseTo(previousLength,2)
  const targetLength=Number((previousLength-.25).toFixed(3))
  await length.fill(String(targetLength))
  await page.getByRole('button',{name:'Apply wall length',exact:true}).click()
  await expect(length).toHaveValue(String(targetLength))
  await page.getByRole('button',{name:'Apply building',exact:true}).click()
  await page.getByRole('button',{name:'Take control',exact:true}).click()
  await expect.poll(async()=>{
   const next=(await saved()).building.floors[0],wall=next.walls.find(w=>w.id===straight.id)
   const start=next.nodes.find(n=>n.id===wall.a).point,end=next.nodes.find(n=>n.id===wall.b).point
   return Number(Math.hypot(start[0]-end[0],start[1]-end[1]).toFixed(3))
  }).toBe(targetLength)
  const after=await saved()
  expect(after.devices.map(d=>({id:d.id,physical:d.physical,rotation:d.rotation}))).toEqual(before.devices.map(d=>({id:d.id,physical:d.physical,rotation:d.rotation})))
  expect(after.wires.map(w=>[w.id,w.from,w.fromPort,w.to,w.toPort])).toEqual(before.wires.map(w=>[w.id,w.from,w.fromPort,w.to,w.toPort]))
  await page.getByRole('button',{name:'Undo',exact:true}).click()
  await expect.poll(async()=>Math.max(...(await saved()).building.floors[0].nodes.map(n=>n.point[0]))).toBe(4)
 })
 const phoneContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true})
 const phone=await phoneContext.newPage()
 phone.on('pageerror',error=>errors.push(error.message))
 await phone.goto(url,{waitUntil:'networkidle'})
 await expect(phone.getByText('Physics engine connected',{exact:true})).toBeAttached({timeout:30000})
 await check('mobile designer keeps its plan and submission controls reachable',async()=>{
  await phone.getByRole('button',{name:'Auto design',exact:true}).tap()
  await phone.locator('.building-fold>summary').tap()
  await phone.getByRole('checkbox',{name:'Include a home layout',exact:true}).check()
  await phone.locator('.floor-plan').scrollIntoViewIfNeeded()
  expect(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const bounds=await phone.locator('.floor-plan').boundingBox();expect(bounds.width).toBeLessThan(390)
  await phone.screenshot({path:'artifacts/qa-building-editor-phone.png'})
  await phone.getByRole('button',{name:'Generate my system',exact:true}).scrollIntoViewIfNeeded()
  await expect(phone.getByRole('button',{name:'Generate my system',exact:true})).toBeInViewport()
  await phone.getByRole('button',{name:'Close dialog',exact:true}).tap()
 })
 await check('meter modes are reachable on a phone and explain selection requirements',async()=>{
  await phone.getByRole('button',{name:'Voltmeter tool',exact:true}).tap()
  await phone.getByLabel('Meter mode',{exact:true}).selectOption('current')
  await expect(phone.locator('.meter-popover output')).toContainText('SELECT CONDUCTOR')
  await phone.getByLabel('Meter mode',{exact:true}).selectOption('continuity')
  await expect(phone.locator('.meter-popover')).toContainText('de-energised')
  expect(await phone.getByLabel('Meter mode',{exact:true}).locator('option').count()).toBe(10)
  await phone.screenshot({path:'artifacts/qa-meter-phone.png'})
 })
 expect(errors).toEqual([])
 await phoneContext.close()
}catch(error){
 await page.screenshot({path:'artifacts/designer-ui-failure.png'}).catch(()=>{})
 await writeFile('artifacts/designer-ui-failure.txt',await page.locator('body').innerText().catch(()=>''))
 throw error
}finally{
 await writeFile('artifacts/designer-ui-check.json',JSON.stringify({checks,errors},null,2))
 await browser.close()
 server?.kill()
}

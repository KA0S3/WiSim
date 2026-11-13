import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
const baseUrl=process.env.WISIM_URL??'http://127.0.0.1:4184/';let server
await mkdir('artifacts',{recursive:true})
if(!process.env.WISIM_URL){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4184','--strictPort'],{stdio:'pipe',windowsHide:true});let ready=false;for(let i=0;i<80;i++){try{if((await fetch(baseUrl)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}if(!ready){server.kill();throw Error('Controls preview failed to start')}}
const browser=await chromium.launch({channel:'msedge',headless:true}),checks=[],errors=[];let page
const fresh=async()=>{await page?.close();page=await browser.newPage({viewport:{width:1366,height:700}});page.on('pageerror',e=>errors.push(e.message));await page.goto(baseUrl,{waitUntil:'networkidle'});await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000})}
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4'))),matrix=()=>page.locator('.react-flow__viewport').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return {zoom:m.a,x:m.e,y:m.f}})
const check=async(name,fn)=>{if(process.env.WISIM_TERMINAL_ONLY&&!name.includes('desktop terminal detail'))return;await fn();checks.push(name);console.log('PASS '+name)}
try{
 await fresh()
 await check('normal wheel zooms while Ctrl/Shift wheel pan without browser zoom',async()=>{
  await page.waitForTimeout(800);const rect=await page.locator('.schematic-diagram').boundingBox();await page.mouse.move(rect.x+rect.width*.7,rect.y+rect.height*.65)
  let before=await matrix();await page.mouse.wheel(0,150);await expect.poll(async()=>(await matrix()).zoom).toBeLessThan(before.zoom)
  before=await matrix();await page.keyboard.down('Control');await page.mouse.wheel(0,100);await page.keyboard.up('Control');await expect.poll(async()=>(await matrix()).y).toBeLessThan(before.y-50);expect((await matrix()).zoom).toBeCloseTo(before.zoom,5)
  before=await matrix();await page.keyboard.down('Shift');await page.mouse.wheel(0,100);await page.keyboard.up('Shift');await expect.poll(async()=>(await matrix()).x).toBeLessThan(before.x-50);expect((await matrix()).zoom).toBeCloseTo(before.zoom,5)
  expect(await page.evaluate(()=>visualViewport.scale)).toBe(1)
  await page.getByRole('button',{name:'Fit system',exact:true}).click();await page.waitForTimeout(650)
 })
 await check('Ctrl-click supports group actions with cancellable deletion, copying and independent paste',async()=>{
  await page.locator('.node-name').filter({hasText:/^Rooftop solar$/}).click();await page.keyboard.down('Control');await page.locator('.node-name').filter({hasText:/^Solar controller$/}).click();await page.keyboard.up('Control')
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);await expect(page.getByRole('heading',{name:'2 selected items'})).toBeVisible()
  const before=await saved(),selectedIds=before.devices.filter(d=>['pv','mppt'].includes(d.kind)).map(d=>d.id),handle=await page.locator('.node-name').filter({hasText:/^Rooftop solar$/}).boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+45,handle.y+handle.height/2+30,{steps:10});await page.mouse.up();await expect.poll(async()=>(await saved()).devices.find(d=>d.id===selectedIds[0]).x).not.toBe(before.devices.find(d=>d.id===selectedIds[0]).x);const moved=await saved();for(const id of selectedIds){expect(moved.devices.find(d=>d.id===id).x).not.toBe(before.devices.find(d=>d.id===id).x)}expect(moved.wires).toEqual(before.wires);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await saved()).devices.find(d=>d.id===selectedIds[0]).x).toBe(before.devices.find(d=>d.id===selectedIds[0]).x)
  await page.getByRole('button',{name:'Delete selection',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm delete selection',exact:true})).toBeVisible();expect((await saved()).devices).toHaveLength(7);await page.getByRole('button',{name:'Keep everything',exact:true}).click()
  await page.getByRole('button',{name:'Copy for another system',exact:true}).click();await page.getByRole('button',{name:'Paste copied equipment',exact:true}).click()
  await expect(page.locator('.react-flow__node')).toHaveCount(9);await expect.poll(async()=>(await saved()).devices.length).toBe(9)
  const after=await saved();expect(after.wires.slice(0,before.wires.length)).toEqual(before.wires);expect(after.wires).toHaveLength(13)
  await page.getByRole('button',{name:'Delete other equipment',exact:true}).click();await page.getByRole('button',{name:'Confirm delete others',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(9)
  await page.getByRole('button',{name:'Use as new system',exact:true}).click();await expect(page.locator('.project-name')).toContainText('/ selection');await expect(page.locator('.react-flow__node')).toHaveCount(2);await expect.poll(async()=>(await saved()).id).not.toBe(before.id)
  await page.getByRole('button',{name:'Paste copied equipment',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(4);await expect.poll(async()=>(await saved()).devices.length).toBe(4)
 })
 await fresh()
 await check('rectangle selection and screen organisation preserve electrical wiring',async()=>{
  await page.waitForTimeout(800);const battery=await page.locator('.react-flow__node').filter({has:page.locator('.node-name').filter({hasText:/^Home battery$/})}).boundingBox(),fuse=await page.locator('.react-flow__node').filter({has:page.locator('.node-name').filter({hasText:/^Battery protection$/})}).boundingBox()
  await page.mouse.move(Math.min(battery.x,fuse.x)-6,Math.max(battery.y+battery.height,fuse.y+fuse.height)+6);await page.mouse.down();await page.mouse.move(Math.max(battery.x+battery.width,fuse.x+fuse.width)+6,Math.min(battery.y,fuse.y)-6,{steps:12});await page.mouse.up();await expect.poll(()=>page.locator('.react-flow__node.selected').count()).toBeGreaterThanOrEqual(2)
  const before=await saved();await page.getByLabel('Arrangement options',{exact:true}).click();await page.getByRole('button',{name:'Arrange for screen',exact:true}).click();await expect.poll(async()=>JSON.stringify((await saved()).devices.map(d=>[d.x,d.y]))).not.toBe(JSON.stringify(before.devices.map(d=>[d.x,d.y])));expect((await saved()).wires).toEqual(before.wires)
 })
 await fresh()
 await check('nearest catalogue alternatives show differences and create actual parallel units',async()=>{
  await page.locator('.node-name').filter({hasText:/^Rooftop solar$/}).click();await expect(page.locator('.product-differences').first()).toBeVisible()
  const button=page.getByRole('button',{name:/Use \d+ units in parallel/}).first(),quantity=Number((await button.innerText()).match(/\d+/)[0]),before=await saved();await button.click()
  await expect(page.locator('.react-flow__node')).toHaveCount(7);await expect.poll(async()=>(await saved()).devices.length).toBe(7+quantity-1)
  expect((await saved()).wires.slice(0,before.wires.length)).toEqual(before.wires);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(7)
 })
 await fresh()
 await check('short-window 3D and settings panels reach their final positioning fields at normal zoom',async()=>{
  await page.getByRole('button',{name:'3D workbench',exact:true}).click();await expect(page.locator('.physical-view canvas')).toBeVisible()
  await page.getByRole('button',{name:'Add roof',exact:true}).click();const field=page.getByRole('spinbutton',{name:'Structure rotation Z degrees',exact:true});await field.scrollIntoViewIfNeeded();await field.fill('15');await field.press('Tab')
  const box=await field.boundingBox(),panel=await page.locator('.physical-editor').boundingBox();expect(box.y).toBeGreaterThanOrEqual(panel.y);expect(box.y+box.height).toBeLessThanOrEqual(panel.y+panel.height+1)
  await page.getByLabel('3D selection',{exact:true}).selectOption((await saved()).devices.find(d=>d.kind==='battery').id)
  await page.locator('.inspector-content').getByText('Physical dimensions',{exact:true}).click();const placement=page.getByRole('spinbutton',{name:'Placement Z',exact:true});await placement.scrollIntoViewIfNeeded();await expect(placement).toBeInViewport()
  expect(await page.evaluate(()=>({zoom:visualViewport.scale,overflow:document.documentElement.scrollWidth>innerWidth}))).toEqual({zoom:1,overflow:false})
  await page.screenshot({path:'artifacts/qa-short-window-controls.png'})
 })
 await fresh()
 await check('desktop terminal detail shares the 3D model, switches components and preserves the inspected device while checking a wire',async()=>{
  const before=await saved(),battery=before.devices.find(d=>d.kind==='battery'),load=before.devices.find(d=>d.kind==='load')
  await page.getByRole('button',{name:'Terminal detail',exact:true}).click();await expect(page.locator('.terminal-model canvas')).toBeVisible({timeout:20000})
  await page.getByLabel('Terminal detail component',{exact:true}).selectOption(load.id);await expect(page.locator('.terminal-hero h2')).toHaveText(load.name);await expect(page.locator('.terminal-live-readings')).toContainText('597');await expect(page.locator('.terminal-live-readings')).toBeInViewport()
  await page.getByLabel('Terminal detail component',{exact:true}).selectOption(battery.id);await expect(page.locator('.terminal-hero h2')).toHaveText(battery.name)
  const canvas=page.locator('.terminal-model canvas'),box=await canvas.boundingBox(),image=await canvas.screenshot();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.65+65,box.y+box.height*.4+35,{steps:12});await page.mouse.up();await page.waitForTimeout(300);expect(await canvas.screenshot()).not.toEqual(image)
  await page.getByRole('button',{name:'Front view',exact:true}).click();await page.getByRole('button',{name:'3D probe +',exact:true}).click();await page.getByRole('button',{name:'3D probe −',exact:true}).click();await expect(page.locator('.meter-popover')).toBeVisible();await expect.poll(async()=>parseFloat(await page.locator('.meter-popover output').innerText())).toBeGreaterThan(50);await page.getByRole('button',{name:'Close voltmeter',exact:true}).click()
  await page.locator('.terminal-wire').first().click();await expect(page.getByLabel('Terminal detail component',{exact:true})).toHaveValue(battery.id);await expect(page.locator('.terminal-hero h2')).toHaveText(battery.name)
  await page.locator('.terminal-follow').first().click();await expect(page.getByLabel('Terminal detail component',{exact:true})).not.toHaveValue(battery.id)
  expect((await saved()).devices).toEqual(before.devices);expect((await saved()).wires).toEqual(before.wires)
  await page.screenshot({path:'artifacts/qa-terminal-3d.png'})
 })
 expect(errors).toEqual([])
}catch(e){await page?.screenshot({path:'artifacts/controls-failure.png'});if(page)await writeFile('artifacts/controls-failure.txt',await page.locator('body').innerText());throw e}
finally{await writeFile(process.env.WISIM_TERMINAL_ONLY?'artifacts/controls-terminal-check.json':'artifacts/controls-check.json',JSON.stringify({checks,errors},null,2));await browser.close();server?.kill()}

import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import path from 'node:path'
import {solarProject} from '../src/workbench/templates.ts'
import {synchronizeLengths} from '../src/workbench/geometry.ts'
await mkdir('artifacts',{recursive:true});await mkdir('.cache/browser-temp',{recursive:true});process.env.TEMP=path.resolve('.cache/browser-temp');process.env.TMP=process.env.TEMP
const baseUrl=process.env.WISIM_URL??'http://127.0.0.1:4180/';let server
if(!process.env.WISIM_URL){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4180','--strictPort'],{stdio:'pipe',windowsHide:true});let ready=false;for(let i=0;i<80;i++){try{if((await fetch(baseUrl)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}if(!ready){server.kill();throw Error('Diagnostics preview failed to start')}}
const browser=await chromium.launch({channel:'msedge',headless:true}).catch(e=>{server?.kill();throw e}),page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],checks=[]
page.on('pageerror',e=>errors.push(e.message));const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name)}
let p=solarProject();p.devices.find(d=>d.kind==='battery').spec.voltage=12.8;p=synchronizeLengths(p)
try{
 await page.addInitScript(p=>localStorage.setItem('wisim-workbench-v4',JSON.stringify(p)),p);await page.goto(baseUrl,{waitUntil:'networkidle'})
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4')))
 const openDiagnostics=()=>page.getByRole('button',{name:'System diagnostics',exact:true}).click()
 const drawer=page.getByRole('complementary',{name:'System diagnostics',exact:true})
 const fault=drawer.getByRole('article',{name:'fault: Battery bank and inverter voltage classes differ',exact:true})
 const closeDiagnostics=openDiagnostics
 await check('fault markers stay visible while complete findings open in the left drawer',async()=>{
  await expect(page.locator('.equipment-node.has-fault').first()).toBeVisible()
  await expect(page.locator('.warning-callout')).toHaveCount(0)
  await expect(page.getByRole('button',{name:'System diagnostics',exact:true})).toHaveClass(/has-fault/)
  expect((await saved()).devices.find(d=>d.kind==='battery').spec.voltage).toBe(12.8)
  expect((await saved()).wires).toEqual(p.wires)
  const title=await page.locator('.inspector-title').innerText()
  await page.getByRole('button',{name:'Find fault on Hybrid inverter',exact:true}).click()
  await expect(fault).toBeFocused()
  await closeDiagnostics()
  await page.locator('.node-name').filter({hasText:'Hybrid inverter'}).click({button:'right'})
  await page.getByRole('menuitem',{name:'Find issue in Diagnostics'}).click()
  await expect(fault).toBeFocused()
  await expect(drawer.getByRole('article',{name:/^(info|warning):/})).toHaveCount(0)
  await fault.getByText('Explain issue',{exact:true}).click()
  await expect(fault.getByText('Next step:',{exact:true})).toBeVisible()
  await expect(drawer.getByRole('button',{name:'Close sidebar tool'})).toHaveCount(0)
  await page.getByRole('button',{name:'Export',exact:true}).click()
  await page.getByRole('button',{name:'Close dialog',exact:true}).click()
  await expect(fault.getByText('Next step:',{exact:true})).toBeVisible()
  const [left,right]=await Promise.all([drawer.boundingBox(),page.locator('.schematic-diagram').boundingBox()])
  expect(left.x+left.width).toBeLessThanOrEqual(right.x+1)
  expect(await page.locator('.inspector-title').innerText()).toBe(title)
  await fault.getByRole('button',{name:/^Inspect .*Hybrid inverter/}).click()
  await expect(page.locator('.inspector-name')).toHaveText('Hybrid inverter')
  await expect(drawer).toBeVisible()
  await expect(page.locator('[data-warning-leader]')).not.toHaveCount(0)
  await closeDiagnostics()
 })
 await check('full diagnostics exposes more than five findings and includes unconnected-terminal notes',async()=>{
  await expect(page.getByRole('button',{name:'Equipment library',exact:true})).toHaveAttribute('aria-expanded','false')
  await page.getByRole('button',{name:'Equipment library',exact:true}).click()
  for(let i=0;i<9;i++)await page.getByRole('button',{name:'Resistor Linear resistor / discharge load',exact:true}).click()
  await page.waitForTimeout(800);await page.getByRole('button',{name:'System diagnostics',exact:true}).click()
  await expect(page.getByRole('article',{name:'info: Unconnected terminal',exact:true})).toHaveCount(0)
  await page.getByRole('combobox',{name:'Diagnostic severity',exact:true}).selectOption('info');await expect(page.locator('.diagnostic-item')).toHaveCount(9)
  await page.getByRole('textbox',{name:'Search diagnostics',exact:true}).fill('Resistor');await expect(page.locator('.diagnostic-item')).toHaveCount(9)
  await closeDiagnostics()
 })
 await check('suggested fixes preview one change, stay optional and undo in one step',async()=>{
  await openDiagnostics()
  const before=await saved(),card=fault
  await expect(card.getByRole('button',{name:/Preview fix for Battery bank/})).toHaveText(/Auto-fix/)
  await card.getByRole('button',{name:/Preview fix for Battery bank/}).click();await expect(card).toContainText('Use generic 12 V inverter settings');expect(await saved()).toEqual(before)
  await card.getByRole('button',{name:'Keep as is',exact:true}).click();expect(await saved()).toEqual(before)
  await card.getByRole('button',{name:/Preview fix for Battery bank/}).click();await card.getByRole('button',{name:'Apply fix: Use generic 12 V inverter settings',exact:true}).click()
  await expect.poll(async()=>(await saved()).devices.find(d=>d.kind==='inverter').spec.cutoff).toBe(11);expect((await saved()).wires).toEqual(before.wires)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await saved()).devices.find(d=>d.kind==='inverter').spec.cutoff).toBe(44)
  expect(await saved()).toEqual(before)
  await closeDiagnostics()
 })
 await check('conflicting catalogue replacements can still be applied in the sandbox with warnings',async()=>{
  await page.getByRole('button',{name:'Fit system',exact:true}).click();await page.waitForTimeout(600);await page.locator('.node-name').filter({hasText:'Home battery'}).click()
  await page.getByRole('spinbutton',{name:'Capacity',exact:true}).fill('150');await page.getByRole('spinbutton',{name:'Current limit',exact:true}).fill('100')
  await expect(page.locator('.product-conflicts').first()).toContainText('voltage classes differ');await expect(page.locator('.product-matches button').first()).toBeEnabled()
  const before=await saved();await page.locator('.product-matches button').first().click();await page.waitForTimeout(600)
  expect((await saved()).devices.find(d=>d.id===p.devices.find(d=>d.kind==='battery').id).spec.capacityAh).toBe(160);expect((await saved()).wires).toEqual(before.wires)
 })
 await check('low inverter voltage offers a visible repair that previews and reconnects the missing example battery',async()=>{
  const example=solarProject(),battery=example.devices.find(d=>d.kind==='battery')
  example.devices=example.devices.filter(d=>d!==battery)
  example.wires=example.wires.filter(w=>w.from!==battery.id&&w.to!==battery.id)
  await page.locator('input[hidden][type=file]').setInputFiles({name:'missing-battery.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(example))})
  await expect.poll(async()=>(await saved()).devices.length).toBe(6)
  await openDiagnostics()
  const low=drawer.getByRole('article',{name:'fault: Inverter input voltage is low',exact:true})
  await low.getByRole('button',{name:/Auto-fix/}).click()
  await expect(low).toContainText('connect four cables')
  expect((await saved()).devices).toHaveLength(6)
  await low.getByRole('button',{name:/Apply fix:/}).click()
  await expect.poll(async()=>(await saved()).wires.length).toBe(11)
  await expect(page.locator('.power-metrics')).toContainText('597 W',{timeout:20000})
  await expect(low).toHaveCount(0)
  await closeDiagnostics()
 })
 await check('phone diagnostics keeps the fault list and schematic on screen together',async()=>{
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300)
  await page.locator('input[hidden][type=file]').setInputFiles({name:'voltage-mismatch.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))})
  await expect.poll(async()=>(await saved()).devices.find(d=>d.kind==='battery').spec.voltage).toBe(12.8)
  await openDiagnostics()
  await expect(drawer).toBeVisible()
  await fault.getByRole('button',{name:/^Inspect .*Hybrid inverter/}).click()
  await expect(drawer).toBeVisible()
  await expect(page.locator('.inspector')).not.toBeVisible()
  await expect(page.locator('[data-warning-leader]')).not.toHaveCount(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'artifacts/qa-phone-diagnostics.png'})
 })
 expect(errors).toEqual([])
}catch(e){await page.screenshot({path:'artifacts/diagnostics-failure.png'});await writeFile('artifacts/diagnostics-failure.txt',await page.locator('body').innerText());throw e}
finally{await writeFile('artifacts/diagnostics-check.json',JSON.stringify({checks,errors},null,2));await browser.close();server?.kill()}

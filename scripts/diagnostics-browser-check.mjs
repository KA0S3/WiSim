import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import path from 'node:path'
import {solarProject} from '../src/workbench/templates.ts'
import {synchronizeLengths} from '../src/workbench/geometry.ts'
import {clearLeader} from '../src/workbench/warning-route.ts'
await mkdir('artifacts',{recursive:true});await mkdir('.cache/browser-temp',{recursive:true});process.env.TEMP=path.resolve('.cache/browser-temp');process.env.TMP=process.env.TEMP
const baseUrl=process.env.WISIM_URL??'http://127.0.0.1:4180/';let server
if(!process.env.WISIM_URL){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4180','--strictPort'],{stdio:'pipe',windowsHide:true});let ready=false;for(let i=0;i<80;i++){try{if((await fetch(baseUrl)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}if(!ready){server.kill();throw Error('Diagnostics preview failed to start')}}
const browser=await chromium.launch({channel:'msedge',headless:true}).catch(e=>{server?.kill();throw e}),page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],checks=[]
page.on('pageerror',e=>errors.push(e.message));const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name)}
let p=solarProject();p.devices.find(d=>d.kind==='battery').spec.voltage=12.8;p=synchronizeLengths(p)
try{
 await page.addInitScript(p=>localStorage.setItem('wisim-workbench-v4',JSON.stringify(p)),p);await page.goto(baseUrl,{waitUntil:'networkidle'})
 await expect(page.getByRole('complementary',{name:'Schematic fault callouts',exact:true})).toBeVisible()
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4')))
 await check('wrong sandbox settings and wiring remain editable with red and amber callouts',async()=>{
  await expect(page.locator('.warning-callout.fault').first()).toBeVisible();await expect(page.locator('.warning-callout.warning').first()).toBeVisible();await expect(page.locator('.equipment-node.has-fault').first()).toBeVisible()
  expect((await saved()).devices.find(d=>d.kind==='battery').spec.voltage).toBe(12.8);expect((await saved()).wires).toEqual(p.wires)
  expect(await page.locator('.warning-callout.fault').first().evaluate(e=>getComputedStyle(e).borderLeftColor)).not.toBe(await page.locator('.warning-callout.warning').first().evaluate(e=>getComputedStyle(e).borderLeftColor))
 })
 await check('floating callout cards occupy a separate margin and routed leaders avoid equipment',async()=>{
  await page.waitForTimeout(1200)
  const geometry=await page.locator('.schematic-wrap').evaluate(host=>{const r=host.getBoundingClientRect(),diagram=host.querySelector('.schematic-diagram').getBoundingClientRect();return {diagram:{right:diagram.right,bottom:diagram.bottom},cards:[...host.querySelectorAll('.warning-callout')].map(e=>{const b=e.getBoundingClientRect();return {left:b.left,top:b.top}}),nodes:[...host.querySelectorAll('.react-flow__node')].map(e=>{const b=e.getBoundingClientRect();return {left:b.left-r.left+1,right:b.right-r.left-1,top:b.top-r.top+1,bottom:b.bottom-r.top-1}}),leaders:[...host.querySelectorAll('.warning-leaders polyline:not(.leader-halo)')].map(e=>e.getAttribute('points').split(' ').map(s=>{const [x,y]=s.split(',').map(Number);return {x,y}}))}})
  for(const card of geometry.cards)expect(card.left>=geometry.diagram.right||card.top>=geometry.diagram.bottom).toBe(true)
  expect(geometry.leaders.length).toBeGreaterThan(0);for(const points of geometry.leaders)expect(clearLeader(points,geometry.nodes)).toBe(true)
  await page.screenshot({path:'artifacts/qa-warning-callouts.png'})
 })
 await check('callout location and details connect to the real equipment and diagnostics',async()=>{
  const card=page.getByRole('article',{name:'fault at Hybrid inverter',exact:true});await card.getByRole('button',{name:'Locate problem',exact:true}).click();await expect(page.locator('.inspector-name')).toHaveText('Hybrid inverter')
  await card.getByRole('button',{name:'Details & tips',exact:true}).click();await expect(page.getByRole('dialog',{name:'System diagnostics',exact:true})).toBeVisible();await expect(page.locator('.diagnostic-tip').first()).toContainText('Next step')
  await page.getByRole('button',{name:'Close dialog',exact:true}).click()
 })
 await check('full diagnostics exposes more than five findings and includes unconnected-terminal notes',async()=>{
  for(let i=0;i<9;i++)await page.getByRole('button',{name:'Resistor Linear resistor / discharge load',exact:true}).click()
  await page.waitForTimeout(800);await page.getByRole('button',{name:'System diagnostics',exact:true}).click()
  await expect.poll(()=>page.getByRole('article',{name:'info: Unconnected terminal',exact:true}).count()).toBe(9)
  await page.getByRole('combobox',{name:'Diagnostic severity',exact:true}).selectOption('info');await expect(page.locator('.diagnostic-item')).toHaveCount(9)
  await page.getByRole('textbox',{name:'Search diagnostics',exact:true}).fill('Resistor');await expect(page.locator('.diagnostic-item')).toHaveCount(9)
  await page.getByRole('button',{name:'Close dialog',exact:true}).click()
 })
 await check('suggested fixes preview one change, stay optional and undo in one step',async()=>{
  const before=await saved(),card=page.getByRole('article',{name:'fault at Hybrid inverter',exact:true})
  await card.getByRole('button',{name:/Preview fix for Battery bank/}).click();await expect(card).toContainText('Use generic 12 V inverter settings');expect(await saved()).toEqual(before)
  await card.getByRole('button',{name:'Keep as is',exact:true}).click();expect(await saved()).toEqual(before)
  await card.getByRole('button',{name:/Preview fix for Battery bank/}).click();await card.getByRole('button',{name:'Apply fix: Use generic 12 V inverter settings',exact:true}).click()
  await expect.poll(async()=>(await saved()).devices.find(d=>d.kind==='inverter').spec.cutoff).toBe(11);expect((await saved()).wires).toEqual(before.wires)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await saved()).devices.find(d=>d.kind==='inverter').spec.cutoff).toBe(44)
  expect(await saved()).toEqual(before)
 })
 await check('conflicting catalogue replacements can still be applied in the sandbox with warnings',async()=>{
  await page.getByRole('button',{name:'Fit system',exact:true}).click();await page.waitForTimeout(600);await page.locator('.node-name').filter({hasText:'Home battery'}).click()
  await page.getByRole('spinbutton',{name:'Capacity',exact:true}).fill('150');await page.getByRole('spinbutton',{name:'Current limit',exact:true}).fill('100')
  await expect(page.locator('.product-conflicts').first()).toContainText('voltage classes differ');await expect(page.locator('.product-matches button').first()).toBeEnabled()
  const before=await saved();await page.locator('.product-matches button').first().click();await page.waitForTimeout(600)
  expect((await saved()).devices.find(d=>d.id===p.devices.find(d=>d.kind==='battery').id).spec.capacityAh).toBe(160);expect((await saved()).wires).toEqual(before.wires)
 })
 await check('phone warnings stay in a separate strip while diagnostics remains available',async()=>{
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300)
  const a=await page.locator('.schematic-diagram').boundingBox(),b=await page.locator('.warning-callouts').boundingBox();expect(b.y).toBeGreaterThanOrEqual(a.y+a.height)
  await page.getByRole('button',{name:'System diagnostics',exact:true}).click();await expect(page.getByRole('dialog',{name:'System diagnostics',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'artifacts/qa-phone-diagnostics.png'})
 })
 expect(errors).toEqual([])
}catch(e){await page.screenshot({path:'artifacts/diagnostics-failure.png'});await writeFile('artifacts/diagnostics-failure.txt',await page.locator('body').innerText());throw e}
finally{await writeFile('artifacts/diagnostics-check.json',JSON.stringify({checks,errors},null,2));await browser.close();server?.kill()}

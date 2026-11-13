import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import path from 'node:path'
await mkdir('artifacts',{recursive:true});await mkdir('.cache/browser-temp',{recursive:true})
process.env.TEMP=path.resolve('.cache/browser-temp');process.env.TMP=process.env.TEMP
const baseUrl=process.env.WISIM_URL??'http://127.0.0.1:4179/'
let server
if(!process.env.WISIM_URL){
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4179','--strictPort'],{stdio:'pipe',windowsHide:true})
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(baseUrl)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}
 if(!ready){server.kill();throw Error('Project library preview failed to start')}
}
const browser=await chromium.launch({channel:'msedge',headless:true}).catch(e=>{server?.kill();throw e}),page=await browser.newPage({viewport:{width:1600,height:1000}}),checks=[],errors=[]
page.on('pageerror',e=>errors.push(e.message))
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name)}
const projects=()=>page.getByRole('link',{name:'WiSim projects',exact:true}).click()
const close=()=>page.getByRole('button',{name:'Close dialog',exact:true}).click()
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4')))
try{
 await page.goto(baseUrl,{waitUntil:'networkidle'})
 await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:25000})
 const original=await saved()
 await check('existing working copy enters the named project library with a manual version',async()=>{
  await page.locator('.project-name').click();await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Solar workshop');await page.getByRole('textbox',{name:'Project name',exact:true}).press('Enter')
  await page.getByRole('button',{name:'Save project',exact:true}).click();await expect(page.getByRole('status')).toContainText('saved version stored')
  await projects();await expect(page.getByRole('article',{name:'Saved project Solar workshop',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Previous versions of Solar workshop',exact:true}).click();await expect(page.getByRole('button',{name:'Restore saved version 1',exact:true})).toBeVisible();await close()
 })
 await check('Ctrl+S saves changed settings and an older version restores without losing the newer checkpoint',async()=>{
  await page.locator('.node-name').filter({hasText:'Essential loads'}).click();await page.getByRole('spinbutton',{name:'Rated power',exact:true}).fill('1200');await page.keyboard.press('Control+s')
  await expect.poll(async()=>(await saved()).devices.find(d=>d.name==='Essential loads').spec.watts).toBe(1200)
  await page.waitForTimeout(500);await projects();await page.getByRole('button',{name:'Previous versions of Solar workshop',exact:true}).click()
  await page.getByRole('button',{name:'Restore saved version 2',exact:true}).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(async()=>(await saved()).devices.find(d=>d.name==='Essential loads').spec.watts).toBe(600)
  await projects();await page.getByRole('button',{name:'Previous versions of Solar workshop',exact:true}).click()
  await page.getByRole('button',{name:'Restore saved version 1',exact:true}).click()
  await expect.poll(async()=>(await saved()).devices.find(d=>d.name==='Essential loads').spec.watts).toBe(1200)
  expect((await saved()).wires).toEqual(original.wires)
 })
 let copyId
 await check('Save a copy creates an independent named project',async()=>{
  await projects();await page.getByRole('textbox',{name:'Copy project name',exact:true}).fill('Weekend van');await page.getByRole('button',{name:'Save a copy',exact:true}).click()
  await expect(page.locator('.project-name')).toHaveText('Weekend van');await page.waitForTimeout(500);copyId=(await saved()).id;expect(copyId).not.toBe(original.id)
  await projects();await expect(page.getByRole('article',{name:'Saved project Weekend van',exact:true})).toBeVisible();await expect(page.getByRole('article',{name:'Saved project Solar workshop',exact:true})).toBeVisible()
 })
 await check('switching projects and reloading retains older projects and exact wiring',async()=>{
  await page.getByRole('button',{name:'Blank project',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(0)
  await projects();await page.getByRole('button',{name:'Open saved project Solar workshop',exact:true}).click();await expect(page.locator('.project-name')).toHaveText('Solar workshop')
  await expect(page.locator('.react-flow__node')).toHaveCount(7);await page.waitForTimeout(500);expect((await saved()).wires).toEqual(original.wires)
  await page.reload({waitUntil:'networkidle'});await expect(page.locator('.project-name')).toHaveText('Solar workshop')
  await projects();await page.getByRole('button',{name:'Open saved project Weekend van',exact:true}).click();await expect(page.locator('.project-name')).toHaveText('Weekend van');await page.waitForTimeout(500);expect((await saved()).id).toBe(copyId)
 })
 await check('a saved project downloads as a complete editable JSON backup',async()=>{
  await projects();const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Download saved project Solar workshop',exact:true}).click();const file=await promise
  const target=path.resolve('artifacts/library-solar-project.json');await file.saveAs(target)
  const stream=await file.createReadStream();let text='';for await(const chunk of stream)text+=chunk.toString();const backup=JSON.parse(text)
  expect(backup.name).toBe('Solar workshop');expect(backup.wires).toEqual(original.wires);expect(backup.devices.find(d=>d.name==='Essential loads').spec.watts).toBe(1200);await close()
 })
 await check('version retention keeps the newest 20 explicit saves',async()=>{
  for(let i=0;i<22;i++){await page.getByRole('button',{name:'Save project',exact:true}).click();await page.waitForTimeout(50)}
  await page.waitForTimeout(500);await projects();await page.getByRole('button',{name:'Previous versions of Weekend van',exact:true}).click()
  await expect(page.getByRole('button',{name:/^Restore saved version /})).toHaveCount(20);await page.screenshot({path:'artifacts/qa-project-library.png'});await close()
 })
 await check('a full startup cache cannot overwrite a newer library save after reload',async()=>{
  await page.locator('.node-name').filter({hasText:'Essential loads'}).click()
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='wisim-workbench-v4')throw new Error('Simulated full startup cache');return original.call(this,key,value)}})
  await page.getByRole('spinbutton',{name:'Rated power',exact:true}).fill('1400');await page.getByRole('button',{name:'Save project',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('startup cache is full')
  await page.reload({waitUntil:'networkidle'});await page.locator('.node-name').filter({hasText:'Essential loads'}).click()
  await expect(page.getByRole('spinbutton',{name:'Rated power',exact:true})).toHaveValue('1400')
 })
 await check('storage failure is explicit and does not replace the unsaved current project',async()=>{
  const isolated=await browser.newContext(),broken=await isolated.newPage()
  await broken.addInitScript(()=>{indexedDB.open=()=>{throw new Error('Simulated project storage failure')}})
  await broken.goto(baseUrl,{waitUntil:'networkidle'});await expect(broken.getByRole('alert')).toContainText('Only the last working copy was saved')
  const name=await broken.locator('.project-name').innerText();await broken.getByRole('link',{name:'WiSim projects',exact:true}).click();await broken.getByRole('button',{name:'Blank project',exact:true}).click()
  await expect(broken.locator('.project-name')).toHaveText(name);await expect(broken.getByRole('status')).toContainText('Could not archive')
  expect(await broken.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4')).devices.length)).toBe(7);await isolated.close()
 })
 await check('importing an older copy preserves the newer saved target as a checkpoint',async()=>{
  await page.locator('input[type=file]').setInputFiles({name:'older-solar.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...original,name:'Solar workshop'}))})
  await expect(page.locator('.project-name')).toHaveText('Solar workshop')
  await expect.poll(async()=>(await saved()).devices.find(d=>d.name==='Essential loads').spec.watts).toBe(600)
  await projects();await page.getByRole('button',{name:'Previous versions of Solar workshop',exact:true}).click()
  await expect(page.getByRole('region',{name:'Previous project versions',exact:true})).toContainText('Before opening an imported project or version')
  await page.getByRole('button',{name:'Restore saved version 1',exact:true}).click()
  await expect.poll(async()=>(await saved()).devices.find(d=>d.name==='Essential loads').spec.watts).toBe(1200)
 })
 expect(errors).toEqual([])
}catch(e){await page.screenshot({path:'artifacts/library-failure.png'});await writeFile('artifacts/library-failure.txt',await page.locator('body').innerText());throw e}
finally{await writeFile('artifacts/project-library-check.json',JSON.stringify({checks,errors},null,2));await browser.close();server?.kill()}

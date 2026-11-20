import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
const url=process.env.WISIM_URL??'http://127.0.0.1:4185/';let server
await mkdir('artifacts',{recursive:true})
if(!process.env.WISIM_URL){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4185','--strictPort'],{stdio:'pipe',windowsHide:true});for(let i=0;i<80;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,200))}}
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1366,height:800}}),checks=[],errors=[]
page.on('pageerror',e=>errors.push(e.message))
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4'))),check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name)}
try{
 await page.goto(url,{waitUntil:'networkidle'});await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000})
 await page.getByRole('button',{name:'Auto design',exact:true}).click();await page.getByRole('button',{name:'Generate my system',exact:true}).click()
 await check('compact design shows eight nodes while solving all 23 real devices',async()=>{
  await expect(page.locator('.react-flow__node')).toHaveCount(8,{timeout:30000});await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000});await expect.poll(async()=>(await saved()).devices.length).toBe(23)
  await expect.poll(async()=>parseFloat(await page.locator('.group-power').first().innerText())).toBeGreaterThan(0)
  await page.locator('.react-flow__node-bankArray').filter({hasText:'Solar array'}).locator('.node-name').click();await expect(page.locator('.group-inspector')).toContainText('6 panels');await expect(page.locator('.group-topology')).toContainText('3 parallel strings x 2 in series')
  const bounds=await page.locator('.react-flow__node').evaluateAll(nodes=>nodes.map(el=>{const b=el.getBoundingClientRect();return {width:b.width,height:b.height}}));expect(Math.min(...bounds.map(b=>b.width))).toBeGreaterThan(70)
  await expect(page.locator('.react-flow__edge')).toHaveCount(11);await expect.poll(()=>page.locator('.react-flow__edge-path').evaluateAll(paths=>paths.length>=11&&paths.every(p=>p.getTotalLength()>10))).toBe(true);await expect.poll(async()=>parseFloat(await page.locator('.sim-time').innerText()),{timeout:15000}).toBeGreaterThan(1);await expect(page.locator('.react-flow__edge')).toHaveCount(11)
  await writeFile('artifacts/group-conductor-paths.json',JSON.stringify(await page.locator('.react-flow__edge-path').evaluateAll(paths=>paths.map(p=>({d:p.getAttribute('d'),length:p.getTotalLength(),stroke:getComputedStyle(p).stroke,opacity:getComputedStyle(p).opacity}))),null,2))
  await page.screenshot({path:'artifacts/qa-compact-groups.png'})
 })
 await check('group dragging preserves every physical route and all unit connections; Undo restores the move',async()=>{
  const before=await saved(),g=before.groups.find(g=>g.kind==='pv-array'),node=page.locator('.react-flow__node-bankArray').filter({hasText:'Solar array'}),box=await node.locator('.node-name').boundingBox()
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2+40,{steps:12});await page.mouse.up()
  await expect.poll(async()=>(await saved()).groups.find(v=>v.id===g.id).x).not.toBe(g.x)
  const after=await saved();expect(after.wires).toEqual(before.wires);for(const d of before.devices){expect(after.devices.find(v=>v.id===d.id).physical).toEqual(d.physical);if(g.members.includes(d.id))expect(after.devices.find(v=>v.id===d.id).x).not.toBe(d.x)}await expect(page.locator('.react-flow__edge')).toHaveCount(11)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await saved()).groups.find(v=>v.id===g.id).x).toBe(g.x)
 })
 await check('expand, inspect, collapse and extract retain real wiring and live readings',async()=>{
  const before=await saved(),g=before.groups.find(g=>g.kind==='pv-array'),unit=before.devices.find(d=>g.members.includes(d.id)&&d.kind==='pv')
  await page.getByRole('button',{name:'Expand individual equipment',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(18);await expect(page.locator('.react-flow__edge')).toHaveCount(23);await expect(page.getByRole('button',{name:'Collapse on schematic',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Collapse on schematic',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(8);await expect(page.locator('.react-flow__edge')).toHaveCount(11)
  await page.getByRole('checkbox',{name:'Extract '+unit.name,exact:true}).check();await page.getByRole('button',{name:'Extract selected equipment',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(9)
  await expect.poll(async()=>(await saved()).groups.find(v=>v.id===g.id).members.length).toBe(g.members.length-1);expect((await saved()).wires).toEqual(before.wires)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(8);await expect.poll(async()=>(await saved()).groups.length).toBe(2)
 })
 await check('adding a parallel string copies its two real panels and fuse without changing existing wiring',async()=>{
  const before=await saved();await page.getByRole('button',{name:'Add matching parallel branch',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm add branch',exact:true})).toBeVisible();expect((await saved()).devices).toHaveLength(before.devices.length)
  await page.getByRole('button',{name:'Confirm add branch',exact:true}).click();await expect.poll(async()=>(await saved()).devices.length).toBe(26);await expect(page.locator('.group-inspector')).toContainText('8 panels');expect((await saved()).wires.slice(0,before.wires.length)).toEqual(before.wires);await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000})
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await saved()).devices.length).toBe(23)
 })
 await check('copying a bank pastes actual units with independent identities and confirms deletion',async()=>{
  await page.locator('.diagram-groups button').filter({hasText:'Battery bank'}).click();await page.getByText('Copy, save subset or delete',{exact:true}).click();const before=await saved(),g=before.groups.find(g=>g.kind==='battery-bank')
  await page.getByRole('button',{name:'Copy for another system',exact:true}).click();await page.getByRole('button',{name:'Paste copied equipment',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(9);await expect.poll(async()=>(await saved()).devices.length).toBe(before.devices.length+g.members.length)
  const after=await saved();expect(after.wires.slice(0,before.wires.length)).toEqual(before.wires);expect(after.groups.at(-1).members.every(id=>!before.devices.some(d=>d.id===id))).toBe(true)
  await page.keyboard.press('Delete');await expect(page.getByRole('button',{name:'Confirm delete selection',exact:true})).toBeVisible();await page.getByRole('button',{name:'Keep everything',exact:true}).click();expect((await saved()).devices).toHaveLength(after.devices.length)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(8)
 })
 await check('group metadata and live totals survive save and reload',async()=>{
  await expect.poll(async()=>(await saved()).groups.length).toBe(2);const before=await saved();await page.getByRole('button',{name:'Save project',exact:true}).click();await page.reload({waitUntil:'networkidle'});await expect(page.locator('.react-flow__node')).toHaveCount(8);await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000});expect((await saved()).groups).toEqual(before.groups);await expect.poll(async()=>parseFloat(await page.locator('.group-power').first().innerText())).toBeGreaterThan(0)
 })
 await check('faults inside a collapsed bank retain visible markers and can be inspected from diagnostics',async()=>{
  const bad=await saved(),g=bad.groups.find(g=>g.kind==='battery-bank'),unit=bad.devices.find(d=>g.members.includes(d.id)&&d.kind==='battery');unit.spec.voltage=25.6
  await page.locator('input[type=file]').setInputFiles({name:'group-fault.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))})
  await expect(page.locator('.react-flow__node-bankArray').filter({hasText:'Battery bank'}).locator('.node-issue.fault')).toBeVisible()
  await page.getByRole('button',{name:'System diagnostics',exact:true}).click()
  const fault=page.getByRole('article',{name:'fault: Battery source voltages conflict',exact:true}).filter({has:page.getByRole('button',{name:`Inspect ${unit.name}`,exact:true})})
  await fault.getByRole('button',{name:`Inspect ${unit.name}`,exact:true}).click()
  await expect(page.locator(`.react-flow__node[data-id="${unit.id}"]`)).toBeVisible();await expect(page.locator('.inspector-name')).toHaveText(unit.name);await page.screenshot({path:'artifacts/qa-group-fault.png'})
 })
 expect(errors).toEqual([])
}catch(e){await page.screenshot({path:'artifacts/groups-failure.png'});await writeFile('artifacts/groups-failure.txt',await page.locator('body').innerText());throw e}
finally{await writeFile('artifacts/groups-check.json',JSON.stringify({checks,errors},null,2));await browser.close();server?.kill()}


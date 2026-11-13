// Reproduce an explicitly supplied project without changing the source file.
import {chromium,expect} from '@playwright/test'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
const file=process.argv[2];if(!file)throw Error('Usage: node scripts/project-simulation-browser-check.mjs <project.json>')
const project=JSON.parse(await readFile(file,'utf8')),baseUrl=process.env.WISIM_URL??'http://127.0.0.1:4183/';let server
await mkdir('artifacts',{recursive:true})
if(!process.env.WISIM_URL){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4183','--strictPort'],{stdio:'pipe',windowsHide:true});let ready=false;for(let i=0;i<80;i++){try{if((await fetch(baseUrl)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}if(!ready){server.kill();throw Error('Project preview failed to start')}}
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1900,height:1000}}),errors=[],checks=[]
page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(()=>{const Native=Worker;window.solvedFrames=[];window.Worker=class extends Native{constructor(url,options){super(url,options);this.addEventListener('message',e=>{if(e.data.type==='frame')window.solvedFrames.push({time:e.data.frame.time,devices:e.data.frame.devices})})}}})
try{
 await page.goto(baseUrl,{waitUntil:'networkidle'})
 await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000})
 await page.locator('input[type=file]').setInputFiles(file)
 await expect(page.locator('.react-flow__node')).toHaveCount(project.devices.length)
 await expect.poll(()=>page.evaluate(id=>window.solvedFrames.filter(f=>f.devices[id]).length,project.devices[0].id),{timeout:30000}).toBeGreaterThan(12)
 await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible()
 await expect(page.locator('.power-metrics')).not.toContainText('—')
 const frames=await page.evaluate(id=>window.solvedFrames.filter(f=>f.devices[id]),project.devices[0].id),last=frames.at(-1)
 expect(last.time).toBeGreaterThan(1)
 for(const d of project.devices){expect(Object.values(last.devices[d.id]).filter(v=>typeof v==='number').every(Number.isFinite)).toBe(true)}
 checks.push('supplied project imports and produces continuing finite readings for every device')
 const loose=project.devices.find(d=>d.kind==='pv'&&!project.wires.some(w=>w.from===d.id||w.to===d.id))
 if(loose){expect(last.devices[loose.id].voltage).toBeCloseTo(loose.spec.voc,2);expect(Math.abs(last.devices[loose.id].current)).toBeLessThan(.000001);checks.push('disconnected panel has open-circuit voltage and negligible current')}
 const load=project.devices.find(d=>d.kind==='load')
 if(load){expect(last.devices[load.id].power).toBeGreaterThan(590);await page.locator('.node-name').filter({hasText:load.name}).click();await page.getByRole('button',{name:'Live readings',exact:true}).click();await expect(page.locator('.readings-list')).not.toContainText('—');checks.push('actual appliance readings are displayed in the inspector')}
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4')))
 expect(saved.devices.map(d=>[d.id,d.on,d.spec])).toEqual(project.devices.map(d=>[d.id,d.on,d.spec]))
 expect(saved.wires.map(w=>[w.id,w.from,w.fromPort,w.to,w.toPort])).toEqual(project.wires.map(w=>[w.id,w.from,w.fromPort,w.to,w.toPort]))
 checks.push('original equipment settings and every wire connection remain unchanged')
 await page.screenshot({path:'artifacts/qa-user-project-live.png'})
 await page.reload({waitUntil:'networkidle'})
 await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000});await expect(page.locator('.react-flow__node')).toHaveCount(project.devices.length);await expect(page.locator('.power-metrics')).not.toContainText('—')
 checks.push('the saved supplied project still displays readings after reload')
 expect(errors).toEqual([])
 await writeFile('artifacts/project-simulation-check.json',JSON.stringify({baseUrl,checks,errors,last},null,2))
 console.log(JSON.stringify({checks,errors,time:last.time,readings:last.devices},null,2))
}catch(e){await page.screenshot({path:'artifacts/project-simulation-failure.png'});await writeFile('artifacts/project-simulation-failure.txt',await page.locator('body').innerText());throw e}
finally{await browser.close();server?.kill()}

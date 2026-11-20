import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import path from 'node:path'
await mkdir('artifacts',{recursive:true});await mkdir('.cache/browser-temp',{recursive:true});process.env.TEMP=path.resolve('.cache/browser-temp');process.env.TMP=process.env.TEMP
const baseUrl=process.env.WISIM_URL??'http://127.0.0.1:4181/';let server
if(!process.env.WISIM_URL){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4181','--strictPort'],{stdio:'pipe',windowsHide:true});let ready=false;for(let i=0;i<80;i++){try{if((await fetch(baseUrl)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}if(!ready){server.kill();throw Error('Recovery preview failed to start')}}
const browser=await chromium.launch({channel:'msedge',headless:true}).catch(e=>{server?.kill();throw e}),page=await browser.newPage({viewport:{width:1600,height:1000}}),checks=[],errors=[]
page.on('pageerror',e=>errors.push(e.message));const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name)}
await page.addInitScript(()=>{
 const NativeWorker=window.Worker;window.simulationTest={mode:'delay-next',delayedAt:0,requests:[],workers:0}
 window.Worker=class{
  onmessage=null;onerror=null;dead=false;constructor(url,options){this.id=++window.simulationTest.workers;this.inner=new NativeWorker(url,options);this.inner.onmessage=e=>{if(window.simulationTest.mode==='delay-next'&&e.data.type==='frame'){window.simulationTest.mode='normal';window.simulationTest.delayedAt=Date.now();setTimeout(()=>{if(!this.dead)this.onmessage?.(e)},16000)}else if(!this.dead)this.onmessage?.(e)};this.inner.onerror=e=>{if(!this.dead)this.onerror?.(e)}}
  postMessage(data){window.simulationTest.requests.push({worker:this.id,revision:data.revision,seconds:data.seconds,time:data.checkpoint?.time});if(window.simulationTest.mode==='fail')queueMicrotask(()=>{if(!this.dead)this.onmessage?.({data:{type:'error',error:'Injected solver failure',requestId:data.requestId,revision:data.revision}})});else this.inner.postMessage(data)}
  terminate(){this.dead=true;this.inner.terminate()}
 }
})
try{
 await page.goto(baseUrl,{waitUntil:'networkidle'})
 await check('a calculation response delayed beyond 12 seconds keeps its worker and completes normally',async()=>{
  await expect.poll(()=>page.evaluate(()=>window.simulationTest.delayedAt),{timeout:30000}).toBeGreaterThan(0)
  await page.waitForTimeout(12500)
  expect(await page.evaluate(()=>window.simulationTest.workers)).toBe(1);await expect(page.locator('.calculation-progress')).toBeVisible();await expect(page.locator('.calculation-progress')).toContainText('no time limit')
  await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:15000});await page.getByRole('button',{name:'Advanced simulation readings',exact:true}).click();await expect(page.locator('.scope .trace-line')).not.toHaveAttribute('points',/NaN|Infinity/)
 })
 await check('real worker failures recover without discarding state, and an edit revives the failed circuit',async()=>{
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4'))),time=parseFloat(await page.locator('.sim-time').innerText())
  await page.evaluate(()=>{window.simulationTest.mode='fail'})
  await expect(page.locator('.live-panel')).toContainText('Engine needs attention',{timeout:20000})
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4')))).toEqual(before);expect(parseFloat(await page.locator('.sim-time').innerText())).toBeGreaterThanOrEqual(time)
  await page.evaluate(()=>{window.simulationTest.mode='normal'})
  await page.locator('.node-name').filter({hasText:'Essential loads'}).click();await page.getByRole('spinbutton',{name:'Rated power',exact:true}).fill('1200')
  await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:25000});await expect(page.locator('.power-metrics')).toContainText('1.19 kW')
  expect(await page.evaluate(()=>window.simulationTest.requests.some(r=>r.time>0))).toBe(true)
 })
 await check('long calculations can be cancelled explicitly and resumed without resetting the run',async()=>{
  await page.evaluate(()=>{window.simulationTest.mode='delay-next';window.simulationTest.delayedAt=0})
  await page.getByRole('button',{name:'Run simulation',exact:true}).click();await expect(page.locator('.calculation-progress')).toBeVisible({timeout:20000})
  const time=parseFloat(await page.locator('.sim-time').innerText());await page.getByRole('button',{name:'Cancel calculation',exact:true}).click();await expect(page.getByRole('button',{name:'Run simulation',exact:true})).toBeVisible()
  await page.evaluate(()=>{window.simulationTest.mode='normal'});await page.getByRole('button',{name:'Run simulation',exact:true}).click();await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:25000})
  await expect.poll(async()=>parseFloat(await page.locator('.sim-time').innerText()),{timeout:25000}).toBeGreaterThan(time)
 })
 await page.screenshot({path:'artifacts/qa-calculation-recovery.png'});expect(errors).toEqual([])
}catch(e){await page.screenshot({path:'artifacts/recovery-failure.png'});await writeFile('artifacts/recovery-failure.txt',await page.locator('body').innerText());throw e}
finally{await writeFile('artifacts/recovery-check.json',JSON.stringify({checks,errors},null,2));await browser.close();server?.kill()}

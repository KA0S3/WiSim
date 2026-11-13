import {chromium,expect} from '@playwright/test'
import {writeFile,mkdir} from 'node:fs/promises'
const baseUrl=process.env.WISIM_URL??'http://127.0.0.1:5173/'
await mkdir('artifacts',{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1600,height:1000}}),checks=[],errors=[]
page.on('pageerror',e=>errors.push(e.message))
try{
 await page.goto(baseUrl,{waitUntil:'networkidle'})
 await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000})
 await expect(page.locator('.power-metrics')).toContainText('597 W')
 const initial=parseFloat(await page.locator('.sim-time').innerText())
 await expect.poll(async()=>parseFloat(await page.locator('.sim-time').innerText())).toBeGreaterThan(initial+.2)
 checks.push('development preview produces continuing numerical frames')
 await page.locator('.node-name').filter({hasText:'Essential loads'}).click()
 await page.getByRole('spinbutton',{name:'Rated power',exact:true}).fill('1200')
 await expect(page.locator('.power-metrics')).toContainText('1.19 kW',{timeout:15000})
 await page.getByRole('button',{name:'Live readings',exact:true}).click()
 await expect(page.locator('.readings-list')).toContainText('1.19 kW')
 checks.push('editing load updates both canvas summary and inspector measurements')
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible()
 await page.reload({waitUntil:'networkidle'})
 await expect(page.locator('.power-metrics')).toContainText('1.19 kW',{timeout:30000})
 checks.push('reloaded saved project calculates its edited demand')
 const result=await page.evaluate(async()=>{
  const moduleUrl=new URL('/node_modules/eecircuit-engine/dist/eecircuit-engine.mjs',location.href).href
  const source=`import {Simulation} from ${JSON.stringify(moduleUrl)};
   const e=new Simulation();await e.start();
   e.setNetList('Failed network\\nV1 1 0 1\\nV2 1 0 2\\n.tran .001 .1\\n.end');
   let reason='';try{await e.runSim()}catch(error){reason=error.message}
   e.setNetList('Repaired network\\nV1 1 0 12\\nR1 1 0 10\\n.tran .001 .1\\n.end');
   const result=await e.runSim();self.postMessage({reason,volts:result.data.find(d=>d.name==='v(1)').values.at(-1)});`
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url,{type:'module'})
  try{return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Real solver failure left the browser worker waiting')),15000);worker.onmessage=e=>{clearTimeout(timer);resolve(e.data)};worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))}})}finally{worker.terminate();URL.revokeObjectURL(url)}
 })
 expect(result.reason).toMatch(/solver produced no readable output/i);expect(result.volts).toBeCloseTo(12,6)
 checks.push('real numerical failure rejects in a browser worker and the same worker subsequently solves 12 V reference')
 expect(errors).toEqual([])
 await page.screenshot({path:'artifacts/qa-dev-live-readings.png'})
}finally{await writeFile('artifacts/dev-simulation-check.json',JSON.stringify({checks,errors},null,2));await browser.close()}

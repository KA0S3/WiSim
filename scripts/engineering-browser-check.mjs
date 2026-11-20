import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import path from 'node:path'
await mkdir('artifacts',{recursive:true});await mkdir('.cache/browser-temp',{recursive:true})
process.env.TEMP=path.resolve('.cache/browser-temp');process.env.TMP=process.env.TEMP
const url=process.env.WISIM_URL??'http://127.0.0.1:4187/'
let server
if(!process.env.WISIM_URL){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4187','--strictPort'],{stdio:'pipe',windowsHide:true});let ready=false;for(let n=0;n<60;n++){try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}if(!ready){server.kill();throw Error('Engineering preview did not start')}}
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],checks=[]
page.on('pageerror',e=>errors.push(e.message))
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4')))
try{
 await page.goto(url,{waitUntil:'networkidle'});await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000})
 const initial=await saved()
 await page.getByRole('button',{name:'Electrical engineering',exact:true}).click()
 await page.getByLabel('Engineering region',{exact:true}).selectOption('US')
 await page.getByLabel('Installation method',{exact:true}).selectOption('us-raceway')
 await page.getByLabel('Listed conductor size',{exact:true}).selectOption({label:'10 AWG'})
 await page.getByRole('spinbutton',{name:'Installation temperature',exact:true}).fill('40')
 await page.getByRole('spinbutton',{name:'Design current',exact:true}).fill('15')
 await page.getByRole('button',{name:'Apply engineering settings',exact:true}).click()
 await expect.poll(async()=>(await saved()).engineering?.region).toBe('US')
 await expect.poll(async()=>(await saved()).wires[0].installation?.temperature).toBe(40)
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await saved()).engineering).toEqual(initial.engineering)
 checks.push('regional installation edits apply atomically and Undo restores the project')
 await expect(page.getByRole('button',{name:'Electrical engineering',exact:true})).toHaveAttribute('aria-expanded','true')
 await expect(page.getByLabel('Engineering region',{exact:true})).toHaveValue(initial.engineering?.region??initial.requirements?.region??'ZA')
 await page.getByLabel('Engineering item',{exact:true}).selectOption(initial.devices.find(d=>d.kind==='inverter').id)
 await page.getByRole('checkbox',{name:'Expose chassis protective-earth terminal',exact:true}).check()
 await page.getByRole('button',{name:'Apply engineering settings',exact:true}).click()
 await expect.poll(async()=>(await saved()).devices.find(d=>d.kind==='inverter').ports.some(p=>p.id==='pe')).toBe(true)
 await expect.poll(async()=>(await saved()).wires[0].installation).toEqual(initial.wires[0].installation)
 await page.reload({waitUntil:'networkidle'});await expect(page.getByText('Physics engine connected',{exact:true})).toBeVisible({timeout:30000})
 expect((await saved()).devices.find(d=>d.kind==='inverter').ports.some(p=>p.id==='pe')).toBe(true)
 checks.push('chassis earth terminal survives reload and the real solver remains connected')
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Electrical engineering',exact:true}).click()
 await page.getByLabel('Engineering item',{exact:true}).selectOption(initial.devices.find(d=>d.kind==='battery').id)
 await page.getByRole('checkbox',{name:'Use directional BMS equivalent',exact:true}).check()
 await page.getByRole('spinbutton',{name:'Maximum charge current',exact:true}).fill('40')
 await page.getByRole('button',{name:'Apply engineering settings',exact:true}).scrollIntoViewIfNeeded()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:'artifacts/qa-engineering-phone.png'})
 await page.getByRole('button',{name:'Apply engineering settings',exact:true}).click()
 await expect.poll(async()=>(await saved()).devices.find(d=>d.kind==='battery').batteryLimits?.chargeA).toBe(40)
 checks.push('phone engineering form scrolls to Apply without horizontal overflow')
 expect(errors).toEqual([]);await writeFile('artifacts/engineering-ui-check.json',JSON.stringify({url,checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2))
}finally{await browser.close();server?.kill()}

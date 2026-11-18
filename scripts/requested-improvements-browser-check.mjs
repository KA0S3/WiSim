import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {blankProject,makeDevice,connect} from '../src/workbench/model.ts'
import {makeStructure} from '../src/workbench/spatial.ts'
await mkdir('artifacts',{recursive:true})
const url='http://127.0.0.1:4188/'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4188','--strictPort'],{stdio:'pipe',windowsHide:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),checks=[],errors=[]
try{
 for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,200))}
 const p=blankProject(),battery=makeDevice('battery',0,0,'Battery behind wall'),wall=makeStructure('wall')
 battery.physical=[0,0,0];wall.position=[0,.3,.25];wall.size=[4,3,.1];wall.rotation=[0,0,0];p.devices=[battery];p.structures=[wall]
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addInitScript(p=>localStorage.setItem('wisim-workbench-v4',JSON.stringify(p)),p)
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
 await page.goto(url,{waitUntil:'networkidle'})
 await page.getByRole('button',{name:'3D workbench',exact:true}).click()
 const select=page.getByLabel('3D selection',{exact:true})
 await select.selectOption(battery.id);await page.getByRole('button',{name:'Focus selected',exact:true}).click()
 await expect(page.getByRole('checkbox',{name:'Fade obstructing walls, roofs and panels � click through to equipment',exact:true})).toBeChecked()
 await select.selectOption('');await page.waitForTimeout(900)
 await page.getByRole('checkbox',{name:'Fade obstructing walls, roofs and panels � click through to equipment',exact:true}).uncheck()
 await page.waitForTimeout(500)
 const debugRect=await page.locator('.physical-view canvas').boundingBox()
 await page.getByRole('button',{name:'Hide 3D controls',exact:true}).click();await page.waitForTimeout(500)
 await page.screenshot({path:'artifacts/qa-wall-fade-off.png'})
 const centreClip={x:debugRect.x+debugRect.width/2-30,y:debugRect.y+debugRect.height/2-30,width:60,height:60},opaquePixels=await page.screenshot({clip:centreClip})
 await page.mouse.click(debugRect.x+debugRect.width/2,debugRect.y+debugRect.height/2)
 await page.getByRole('button',{name:'Show 3D controls',exact:true}).click()
 await expect(select).toHaveValue(wall.id)
 await select.selectOption('')
 await page.getByRole('checkbox',{name:'Fade obstructing walls, roofs and panels � click through to equipment',exact:true}).check()
 await page.waitForTimeout(800)
 const canvas=page.locator('.physical-view canvas'),rect=await canvas.boundingBox()
 await page.getByRole('button',{name:'Hide 3D controls',exact:true}).click();await page.waitForTimeout(1000)
 await page.screenshot({path:'artifacts/qa-wall-fade-click-through.png'})
 expect((await page.screenshot({clip:centreClip})).equals(opaquePixels)).toBe(false)
 await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2)
 await page.getByRole('button',{name:'Show 3D controls',exact:true}).click()
 await expect(select).toHaveValue(battery.id)
 checks.push('camera-facing wall fades and centre click selects equipment behind it')
 await page.keyboard.down('Control');await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.7);await page.mouse.wheel(0,-80);await page.keyboard.up('Control')
 expect(await page.evaluate(()=>visualViewport.scale)).toBe(1)
 checks.push('Ctrl 3D zoom keeps browser page scale unchanged')
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('wisim-workbench-v4')))
 expect(saved.devices[0].physical).toEqual(battery.physical);expect(saved.structures[0].position).toEqual(wall.position)
 await context.close()
 const q=blankProject(),b=makeDevice('battery',0,0),f=makeDevice('fuse',300,0,'Test protection'),r=makeDevice('resistor',600,0)
 f.spec.rating=1;r.spec.resistance=.1;q.devices=[b,f,r];q.wires=[connect(b,'p',f,'p',16,.1),connect(f,'n',r,'p',16,.1),connect(r,'n',b,'n',16,.1)]
 const diagnostics=await browser.newContext({viewport:{width:1440,height:900}})
 await diagnostics.addInitScript(q=>localStorage.setItem('wisim-workbench-v4',JSON.stringify(q)),q)
 const d=await diagnostics.newPage();d.on('pageerror',e=>errors.push(e.message));await d.goto(url,{waitUntil:'networkidle'})
 await d.getByRole('button',{name:'System diagnostics',exact:true}).click()
 const trip=d.getByRole('article',{name:'fault: Test protection has tripped',exact:true})
 await expect(trip).toContainText('A exceeded 1 A',{timeout:30000});await expect(trip).toContainText('Connected equipment:')
 await expect(d.getByRole('button',{name:'Reset latched trips after repair',exact:true})).toBeVisible()
 await d.waitForTimeout(500);await d.screenshot({path:'artifacts/qa-retained-trip-cause.png'})
 checks.push('diagnostics retains measured trip cause and offers a charge-preserving trip reset')
 expect(errors).toEqual([])
 for(const check of checks)console.log('PASS '+check)
}finally{await writeFile('artifacts/requested-improvements-check.json',JSON.stringify({checks,errors},null,2));await browser.close();server.kill()}

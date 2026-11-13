import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {getDocument} from '../.cache/pdf-qa/node_modules/pdfjs-dist/legacy/build/pdf.mjs'
const file=process.argv[2]??'artifacts/wisim-wiring-diagram.pdf',project=JSON.parse(await readFile(process.argv[3]??'artifacts/wisim-project.json','utf8'))
const doc=await getDocument({data:new Uint8Array(await readFile(file)),useSystemFonts:true}).promise,scheduled=[],drawn=[]
for(let n=1;n<=doc.numPages;n++){
 const page=await doc.getPage(n),content=await page.getTextContent(),text=content.items.filter(i=>'str'in i),schedule=text.some(i=>i.str==='Connection schedule')
 if(schedule)scheduled.push(...text.filter(i=>/^W[1-9][0-9]*$/.test(i.str)).map(i=>i.str))
 for(const item of text){
  if(/^D[1-9][0-9]* \/ /.test(item.str))drawn.push(item.str.split(' / ')[0])
  assert.ok(item.transform[4]>=-1&&item.transform[4]+item.width<=page.view[2]+1,`Text outside horizontal page bounds on page ${n}: ${item.str}`)
  assert.ok(item.transform[5]>=0&&item.transform[5]<=page.view[3],`Text outside vertical page bounds on page ${n}: ${item.str}`)
 }
}
assert.deepEqual(scheduled.sort(),project.wires.map(w=>w.reference).sort(),'Every conductor must appear exactly once in the cross-sheet schedule')
assert.deepEqual(drawn.sort(),project.devices.map(d=>d.reference).sort(),'Every device must appear exactly once on a detail sheet')
console.log(`Verified ${doc.numPages} PDF pages: ${drawn.length} device references, ${scheduled.length} conductor endpoints/sheet rows, no out-of-page text.`)

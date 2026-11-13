import {readFile,writeFile} from 'node:fs/promises'
import {createCanvas} from '../.cache/pdf-qa/node_modules/@napi-rs/canvas/index.js'
import {getDocument} from '../.cache/pdf-qa/node_modules/pdfjs-dist/legacy/build/pdf.mjs'
const data=new Uint8Array(await readFile('artifacts/wisim-wiring-diagram.pdf'))
const document=await getDocument({data,useSystemFonts:true}).promise
for(let i=1;i<=document.numPages;i++){
 const page=await document.getPage(i),viewport=page.getViewport({scale:1.2}),canvas=createCanvas(viewport.width,viewport.height)
 await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise
 await writeFile(`artifacts/export-page-${i}.png`,canvas.toBuffer('image/png'))
 const text=await page.getTextContent();console.log(`Page ${i}: ${text.items.map(i=>i.str).join(' ').slice(0,600)}`)
}

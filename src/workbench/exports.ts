import { definitions,type Project } from './model'
import {diagramRoutes} from './drawing'
import {drawingGroups,detailProject,exportData} from './export-data'

export function download(name:string,content:string,type='application/json'){
 const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export function exportBom(project:Project){download('wisim-parts-list.csv',exportData(project).csv,'text/csv;charset=utf-8')}

export async function exportDiagram(input:Project){
 const data=exportData(input),project=data.project,groups=drawingGroups(project)
 const {jsPDF}=await import('jspdf'),doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3'}),width=420,height=297
 const response=await fetch(`${import.meta.env.BASE_URL}fonts/Roboto-Regular.ttf`)
 if(!response.ok)throw new Error('The embedded export font could not be loaded. Please retry after the application has loaded.')
 const bytes=new Uint8Array(await response.arrayBuffer());let font=''
 for(let i=0;i<bytes.length;i+=8192)font+=String.fromCharCode(...bytes.subarray(i,i+8192))
 doc.addFileToVFS('Roboto-Regular.ttf',btoa(font));doc.addFont('Roboto-Regular.ttf','Roboto','normal');doc.setFont('Roboto','normal')
 const heading=(title:string,subtitle:string)=>{
  doc.setFillColor('#f5f6f0');doc.rect(0,0,width,height,'F');doc.setTextColor('#263b31');doc.setFontSize(18);doc.text(title,15,20)
  doc.setFontSize(9);doc.setTextColor('#6b7a6c');doc.text(doc.splitTextToSize(subtitle,385),15,28)
 }
 const indexPages=Math.max(1,Math.ceil(groups.length/25)),pageFor=new Map<string,number>();groups.forEach((g,index)=>g.devices.forEach(d=>pageFor.set(d.id,index+indexPages+1)))
 heading(project.name,'WiSim / Drawing index and quantities. Detail sheets use stable device/wire references; the connection schedule lists every conductor.')
 doc.setFontSize(12);doc.setTextColor('#263b31');doc.text(`${project.devices.length} equipment items / ${project.wires.length} individual conductors / ${data.terminations.length} conductor ends`,15,49)
 let y=63
 for(const kind of Object.keys(definitions) as Array<keyof typeof definitions>){const count=project.devices.filter(d=>d.kind===kind).length;if(count){doc.setFontSize(10);doc.text(`${count} x ${definitions[kind].label}`,15,y);y+=7}}
 doc.setFontSize(12);doc.text('Drawing sheets',185,49)
 for(const [i,g]of groups.entries()){
  if(63+i*7>235)break
  doc.setFontSize(9);doc.text(`${i+indexPages+1} / ${g.name} / ${g.devices.map(d=>d.reference).join(', ')}`,185,63+i*7)
 }
 doc.setTextColor('#263b31');doc.setFontSize(12);doc.text('Configured system ratings',15,165);doc.setFontSize(10)
 const pvWatts=project.devices.filter(d=>d.kind==='pv').reduce((sum,d)=>sum+d.spec.watts,0),storage=project.devices.filter(d=>d.kind==='battery').reduce((sum,d)=>sum+d.spec.voltage*d.spec.capacityAh/1000,0)
 doc.text(`PV nameplate assumption: ${(pvWatts/1000).toFixed(2)} kW`,15,178);doc.text(`Nominal storage assumption: ${storage.toFixed(2)} kWh`,15,186)
 if(project.requirements)doc.text(`${project.requirements.dailyKwh} kWh/day demand / ${project.requirements.autonomyHours} h average-load autonomy requested`,15,198)
 doc.setFontSize(10);doc.text(doc.splitTextToSize('Equipment is counted individually. Termination ends are counted, but connector/lug hardware and stud sizes remain unspecified until verified against actual terminals. Generic sizing does not establish installation compliance.',385),15,259)
 for(let page=1;page<indexPages;page++){
  doc.addPage();heading('Drawing index / continued',project.name);doc.setFontSize(10);doc.setTextColor('#263b31')
  groups.slice(page*25,page*25+25).forEach((g,i)=>doc.text(`${page*25+i+indexPages+1} / ${g.name} / ${g.devices.map(d=>d.reference).join(', ')}`,15,50+i*7))
 }

 for(const [index,group]of groups.entries()){
  doc.addPage();heading(`${group.name} / sheet ${index+indexPages+1}`,project.name+' / Full wire endpoints and destination sheets appear in the connection schedule. Crossings are unconnected; terminal dots mark connections.')
  const ids=new Set(group.devices.map(d=>d.id)),local=detailProject(project,group),devices=local.devices
  const routes=diagramRoutes(local)
  if(routes.some(r=>r.blocked))throw new Error('A detail-sheet connection could not be routed clearly. Please report this project; the editable project and connection schedule remain available.')
  const scale=.22,px=(x:number)=>15+x*scale,py=(y:number)=>42+y*scale
  const port=(id:string,pid:string)=>{const d=devices.find(d=>d.id===id)!,p=d.ports.find(p=>p.id===pid)!;return {x:px(d.x+(p.side==='left'?0:p.side==='right'?210:p.offset*210)),y:py(d.y+(p.side==='top'?0:p.side==='bottom'?180:p.offset*180))}}
  for(const {wire,points,segments}of routes){
   for(const [color,lineWidth]of [['#f5f6f0',1.4],[wire.color,.4]] as const){doc.setDrawColor(color);doc.setLineWidth(lineWidth);for(let i=1;i<points.length;i++)doc.line(px(points[i-1].x),py(points[i-1].y),px(points[i].x),py(points[i].y))}
   const segment=segments.reduce((a,b)=>Math.hypot(b.to.x-b.from.x,b.to.y-b.from.y)>Math.hypot(a.to.x-a.from.x,a.to.y-a.from.y)?b:a),x=px((segment.from.x+segment.to.x)/2),y=py((segment.from.y+segment.to.y)/2)
   doc.setFontSize(7);const w=doc.getTextWidth(wire.reference!)+3;doc.setFillColor('#f5f6f0');doc.rect(x-w/2,y-3,w,4,'F');doc.setTextColor('#536b5d');doc.text(wire.reference!,x,y,{align:'center'})
  }
  for(const d of devices){
   const x=px(d.x),y=py(d.y),w=210*scale,h=180*scale
   doc.setFillColor('#ffffff');doc.setDrawColor('#bacbbb');doc.roundedRect(x,y,w,h,1.5,1.5,'FD');doc.setTextColor('#536b5d');doc.setFontSize(8);doc.text(d.reference!+' / '+definitions[d.kind].label,x+3,y+6)
   doc.setTextColor('#263b31');doc.setFontSize(9);const name=doc.splitTextToSize(d.name,w-6);if(name.length>3)name[2]=name[2].slice(0,-3)+'...';doc.text(name.slice(0,3),x+3,y+13)
   const rating=d.kind==='fuse'?`${d.spec.rating} A / generic`:d.kind==='bus'?'Junction / rating unspecified':d.kind==='pv'?`${d.spec.watts} W / ${d.spec.voltage} Vop`:d.kind==='battery'?`${d.spec.voltage} V / ${d.spec.capacityAh} Ah`:d.kind==='mppt'?`${d.spec.rating} A / ${d.spec.voc} V PV max`:d.kind==='inverter'||d.kind==='load'||d.kind==='motor'||d.kind==='dc-load'?`${d.spec.watts} W / ${d.spec.voltage} V`:definitions[d.kind].label
   doc.setFontSize(7);doc.text(rating,x+3,y+h-4)
   for(const p of d.ports){const a=port(d.id,p.id);doc.setFillColor('#667f70');doc.circle(a.x,a.y,.7,'F');doc.setFontSize(6);doc.text(p.label,a.x+(p.side==='right'?2:p.side==='left'?-2:0),a.y+(p.side==='bottom'?3:-1.5),{align:p.side==='left'?'right':p.side==='right'?'left':'center'})}
   const external=project.wires.filter(w=>(w.from===d.id&&!ids.has(w.to))||(w.to===d.id&&!ids.has(w.from)))
   if(external.length){doc.setFontSize(6.5);doc.setTextColor('#6b7a6c');doc.text(`${external.length} off-sheet link${external.length===1?'':'s'} (schedule)`,x+3,y+h-10)}
  }
 }
 const schedules=data.connections.map(c=>{
  const w=project.wires.find(w=>w.reference===c.reference)!,from=project.devices.find(d=>d.id===w.from)!,to=project.devices.find(d=>d.id===w.to)!
  return [c.reference,`${from.reference}.${w.fromPort} / p${pageFor.get(w.from)}`,`${to.reference}.${w.toPort} / p${pageFor.get(w.to)}`,`${c.area} mm2 ${c.material}`,`${c.length.toFixed(3)} m`]
 })
 for(let offset=0;offset<schedules.length;offset+=32){
  doc.addPage();heading('Connection schedule',project.name+' / Each row is one conductor. Each conductor has two ends; actual connector/lug hardware remains to be selected.')
  const columns=[15,46,133,224,326];doc.setFontSize(9);doc.setTextColor('#263b31');['Wire','From terminal / sheet','To terminal / sheet','Conductor','Length'].forEach((label,i)=>doc.text(label,columns[i],47))
  schedules.slice(offset,offset+32).forEach((row,i)=>{const y=57+i*6;doc.setDrawColor('#dce3d7');doc.line(15,y+2.5,400,y+2.5);row.forEach((value,j)=>doc.text(value,columns[j],y))})
 }
 doc.addPage();heading('Design record and assumptions',project.name);y=47
 for(const note of project.designNotes??['Manually assembled sandbox project. No automatic design validation is implied.']){
  doc.setFontSize(10);const lines=doc.splitTextToSize(note,380)
  for(const line of lines){if(y>260){doc.addPage();heading('Design record / continued',project.name);y=47}doc.text(line,15,y);y+=5}y+=5
 }
 const pages=doc.getNumberOfPages()
 for(let page=1;page<=pages;page++){doc.setPage(page);doc.setTextColor('#6b7a6c');doc.setFontSize(8);doc.text('Concept design - verify equipment, ampacity, protection, earthing and terminations before installation.',15,height-12);doc.text(`${page} / ${pages}`,width-15,height-12,{align:'right'})}
 doc.save('wisim-wiring-diagram.pdf')
}

export async function exportFieldLabels(project: Project) {
  const {connections, terminations} = exportData(project)
  if (!connections.length) throw new Error('Connect a conductor before exporting field labels.')
  const {jsPDF} = await import('jspdf')
  const pdf = new jsPDF({unit: 'mm', format: 'a4'})
  const perPage = 30
  for (const [index, end] of terminations.entries()) {
    const slot = index % perPage
    if (index && !slot) pdf.addPage()
    const x = 10 + (slot % 3) * 63
    const y = 12 + Math.floor(slot / 3) * 27
    const destination = terminations[index % 2 ? index - 1 : index + 1]
    pdf.setDrawColor(180)
    pdf.rect(x, y, 63, 27)
    pdf.setFontSize(13)
    pdf.text(end.reference, x + 3, y + 7)
    const lines = [end.equipment + '.' + end.port, 'To ' + destination.equipment + '.' + destination.port]
    for (const [row, line] of lines.entries()) {
      pdf.setFontSize(10)
      pdf.setFontSize(Math.min(10, 560 / Math.max(1, pdf.getTextWidth(line))))
      pdf.text(line, x + 3, y + 14 + row * 6)
    }
  }
  pdf.save('wisim-field-labels.pdf')
}

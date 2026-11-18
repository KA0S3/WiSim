import type {Installation,Region} from './engineering-model'
import type {Wire} from './model'

export const engineeringSources={
 ZA:{label:'Aberdare Facts & Figures 2025, tables 6.2/6.3, PVC SWA 3/4-core, SANS 1507 construction',url:'https://www.aberdare.co.za/wp-content/uploads/Facts-Figures-English-2025.pdf'},
 GB:{label:'Eland reproduction of BS 7671:2018 table 4D1A, single-core 70 C copper. A4:2026 changes not verified.',url:'https://www.elandcables.com/media/vyrp3kxq/table-4d1a-and-4d1b.pdf'},
 US:{label:'Southwire MC guide, NEC 2017 table 310.15(B)(16), 30 C baseline. Local adopted edition must be confirmed.',url:'https://www.southwire.com/medias/sys_master/installation-manuals/installation-manuals/hca/hff/8887676010526/MC-Installation-Guide-Southwire.pdf'},
 grouping:{label:'Schneider IEC 60364-5-52 reference factors',url:'https://www.electrical-installation.org/enwiki/General_method_for_cable_sizing'},
}
export const awgLabels=['14','12','10','8','6','4','3','2','1','1/0','2/0','3/0','4/0']
export const awgArea=(label:string)=>Math.PI/4*(.127*92**((36-(label.includes('/')?1-Number(label.split('/')[0]):Number(label)))/39))**2
const zaAreas=[1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300]
const gbAreas=[1,1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300]
const zaCu={ 'za-air':[19,26,35,45,62,83,110,135,163,203,251,290,330,378,445,510], 'za-duct':[20,26,34,43,58,75,96,115,138,171,205,234,263,298,344,385], 'za-ground':[24,32,42,53,70,91,119,143,169,210,251,284,320,361,416,465] }
const zaAl={'za-air':[80,99,119,151,182,210,240,273,321],'za-duct':[73,87,104,130,157,179,201,229,268],'za-ground':[90,108,129,158,192,217,245,278,324]}
const gb={ 'gb-B':[[13.5,17.5,24,32,41,57,76,101,125,151,192,232,269,300,341,400,458],[12,15.5,21,28,36,50,68,89,110,134,171,207,239,262,296,346,394]], 'gb-C':[[15.5,20,27,37,47,65,87,114,141,182,234,284,330,381,436,515,594],[14,18,25,33,43,59,79,104,129,167,214,261,303,349,400,472,545]] }
const usCu={60:[15,20,30,40,55,70,85,95,110,125,145,165,195],75:[20,25,35,50,65,85,100,115,130,150,175,200,230],90:[25,30,40,55,75,95,110,130,145,170,195,225,260]}
const usAl={60:[0,15,25,35,40,55,65,75,85,100,115,130,150],75:[0,20,30,40,50,65,75,90,100,120,135,155,180],90:[0,25,35,45,55,75,85,100,115,135,150,175,205]}
const index=(areas:number[],area:number)=>areas.findIndex(n=>Math.abs(n-area)<.001)
// Use the next hotter/more grouped tabulated condition, never extrapolate.
const upper=(n:number,bounds:number[],factors:number[])=>factors[bounds.findIndex(b=>n<=b)]
export function defaultInstallation(region:Region):Installation{return {method:region==='ZA'?'za-air':region==='GB'?'gb-B':'us-raceway',temperature:30,circuits:1,loadedConductors:2,insulation:region==='US'?90:70,termination:region==='US'?60:70}}
export function conductorChoices(region:Region,material:Wire['material']='copper') {return region==='US'?awgLabels.map(label=>({area:awgArea(label),label:`${label} AWG`})): (region==='GB'?gbAreas:material==='aluminium'?[25,35,50,70,95,120,150,185,240]:zaAreas).map(area=>({area,label:`${area} mm²`}))}
export type Ampacity={amps?:number;base?:number;temperatureFactor?:number;groupFactor?:number;protectionMax?:number;label:string;error?:string}
export function ampacity(w:Pick<Wire,'area'|'material'|'installation'>,region:Region):Ampacity{
 const i=w.installation,label=engineeringSources[region].label,fail=(error:string):Ampacity=>({label,error})
 if(!i)return fail('Choose the actual cable construction and installation conditions.')
 if(!i.method.startsWith(region.toLowerCase()+'-'))return fail('Installation method belongs to a different region.')
 let base:number|undefined,tf:number|undefined,gf:number|undefined,cap=Infinity
 if(region==='ZA'){
  if(i.insulation!==70||i.termination<70)return fail('This profile covers 70 C PVC SWA cable and terminals rated at least 70 C.')
  if(i.loadedConductors>3)return fail('Additional loaded neutral/harmonic derating is outside this table.')
  const method=i.method as keyof typeof zaCu,areas=w.material==='copper'?zaAreas:[25,35,50,70,95,120,150,185,240]
  base=(w.material==='copper'?zaCu:zaAl)[method]?.[index(areas,w.area)]
  const buried=method!=='za-air'
  tf=buried?upper(i.temperature,[25,30,35,40,45,50],[1,.95,.9,.85,.8,.7]):upper(i.temperature,[30,35,40,45],[1,.94,.87,.79])
  gf=buried?upper(i.circuits,[1,2,3,4,5,6],[1,.81,.7,.63,.59,.55]):upper(i.circuits,[1,2,3,6,9],[1,.9,.84,.8,.75])
  if(method==='za-duct'&&i.circuits>1)return fail('Grouped ducts require an installation-specific thermal assessment.')
 }else if(region==='GB'){
  if(w.material!=='copper'||i.insulation!==70||i.termination<70)return fail('This profile covers 70 C single-core copper and terminals rated at least 70 C.')
  if(![2,3].includes(i.loadedConductors))return fail('Choose two loaded AC/DC conductors or three loaded phase conductors. Loaded neutral harmonics need a separate assessment.')
  base=gb[i.method as keyof typeof gb]?.[i.loadedConductors-2][index(gbAreas,w.area)]
  tf=upper(i.temperature,[10,15,20,25,30,35,40,45,50,55,60],[1.22,1.17,1.12,1.06,1,.94,.87,.79,.71,.61,.5])
  gf=upper(i.circuits,[1,2,3,4,5,6,7,8,9,12,16,20],[1,.8,.7,.65,.6,.57,.54,.52,.5,.45,.41,.38])
 }else{
  if(![60,75,90].includes(i.insulation)||![60,75,90].includes(i.termination))return fail('Choose a supported NEC insulation/termination column.')
  const row=(w.material==='copper'?usCu:usAl),ix=index(awgLabels.map(awgArea),w.area)
  base=row[i.insulation as keyof typeof usCu][ix];cap=row[Math.min(i.insulation,i.termination) as keyof typeof usCu][ix]
  const factors={60:[1.29,1.22,1.15,1.08,1,.91,.82,.71,.58,.41],75:[1.2,1.15,1.11,1.05,1,.94,.88,.82,.75,.67,.58,.47,.33],90:[1.15,1.12,1.08,1.04,1,.96,.91,.87,.82,.76,.71,.65,.58,.5,.41,.29]}
  tf=upper(i.temperature,[10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85],factors[i.insulation as keyof typeof factors])
  gf=upper(i.loadedConductors,[3,6,9,20,30,40,100],[1,.8,.7,.5,.45,.4,.35])
  if(i.circuits!==1)return fail('For US grouping, enter total loaded conductors in the shared raceway; circuits must be one.')
 }
 if(!base||!cap)return fail('Conductor size/material is not in the selected table. Choose a listed size.')
 if(!tf||!gf)return fail('Temperature or grouping is outside the supported table.')
 const amps=Math.min(base*tf*gf,cap)
 let protectionMax=amps
 if(region==='US'){const ix=index(awgLabels.map(awgArea),w.area);const small=w.material==='copper'?[15,20,30]:[0,15,25];if(ix>=0&&ix<3)protectionMax=Math.min(amps,small[ix])}
 return {amps,base,temperatureFactor:tf,groupFactor:gf,protectionMax,label}
}
export function sizeAmpacity(wires:Wire[],region:Region,current:number,protectionA:number){
 for(const wire of wires){wire.installation??=defaultInstallation(region);wire.installation.designCurrent=Math.max(wire.installation.designCurrent??0,current)
  const needed=region==='US'&&wire.installation.continuous?current*1.25:current
  const size=conductorChoices(region,wire.material).find(c=>c.area+1e-6>=wire.area&&(()=>{const a=ampacity({...wire,area:c.area},region);return a.amps!==undefined&&a.amps>=needed&&(a.protectionMax??0)>=protectionA})())
  if(!size)throw Error('No available conductor meets the regional ampacity/protection assumptions. Revise routing, protection or architecture.')
  wire.area=size.area
 }
}

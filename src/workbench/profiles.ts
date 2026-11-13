import type {Device,Kind,Triple} from './model'

export type PhysicalProfile={id:string;name:string;kind:Kind;dimensions:Triple;source:string;checked:string;style:'solar-frame'|'blue-controller'|'blue-battery'|'blue-inverter';color:string;terminalAccuracy:'approximate';geometryOnly?:boolean;terminals?:Record<string,Triple>}
const solar='https://www.victronenergy.com/upload/documents/Datasheet-BlueSolar-Monocrystalline-Panels-EN.pdf'
const battery='https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/technical-data.html'
const small='https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_75-10_up_to_100-20/en/technical-specifications.html'
const medium='https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_100-30__100-50/en/technical-specifications.html'
const large='https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html'
function profile(id:string,name:string,kind:Kind,dimensions:Triple,source:string,style:PhysicalProfile['style']):PhysicalProfile{return{id,name,kind,dimensions,source,style,color:'#4784c4',checked:'2026-11-12',terminalAccuracy:'approximate'}}
// Dimensions are width, height, depth in metres. Exact referenced variants only.
export const physicalProfiles:PhysicalProfile[]=[
 {...profile('reference-blue-smart-ip22-230v-one-output','Blue Smart IP22 230 V, one-output enclosure reference','charger',[.108,.235,.065],'https://www.victronenergy.com/media/pg/Blue_Smart_IP22_Charger_230V_manual/en/technical-specifications---bsc---psc.html','blue-controller'),geometryOnly:true},
 profile('victron-bluesolar-175w-12v','BlueSolar SPM041751200 (175 W)', 'pv',[.668,1.485,.03],solar,'solar-frame'),
 profile('victron-bluesolar-215w-24v','BlueSolar SPM042152402 (215 W)', 'pv',[.705,1.58,.035],solar,'solar-frame'),
 {...profile('canadian-solar-cs6w-550ms-2278','HiKu6 CS6W-550MS / 2278 mm','pv',[1.134,2.278,.03],'https://www.canadiansolar.com/na/wp-content/uploads/sites/3/2026/01/CS-Datasheet-HiKu6_CS6W-MS_v2.7_EN-2278mm.pdf','solar-frame'),color:'#262c31',checked:'2026-11-13',terminals:{p:[-.35,0,-.55],n:[.35,0,-.55]}},
 ...(['150-70','250-70'] as const).map(v=>({...profile(`victron-smartsolar-${v}`,`SmartSolar MPPT ${v.replace('-','/')}-Tr VE.Can`,'mppt',[.25,.185,.095],large,'blue-controller'),checked:'2026-11-13'})),
 ...(['250-85','250-100'] as const).map(v=>({...profile(`victron-smartsolar-${v}`,`SmartSolar MPPT ${v.replace('-','/')}-Tr VE.Can`,'mppt',[.295,.216,.103],large,'blue-controller'),checked:'2026-11-13'})),
 ...(['75-10','75-15'] as const).map(v=>profile(`victron-smartsolar-${v}`,`SmartSolar ${v.replace('-', '/')}`,'mppt',[.113,.1,.04],small,'blue-controller')),
 profile('victron-smartsolar-100-15','SmartSolar 100/15','mppt',[.113,.1,.05],small,'blue-controller'),
 profile('victron-smartsolar-100-20','SmartSolar 100/20','mppt',[.131,.1,.06],small,'blue-controller'),
 ...(['100-30','100-50'] as const).map(v=>profile(`victron-smartsolar-${v}`,`SmartSolar ${v.replace('-', '/')}`,'mppt',[.186,.13,.07],medium,'blue-controller')),
 profile('victron-lithium-smart-12-8-50','Lithium Battery Smart 12.8 V / 50 Ah','battery',[.188,.199,.147],battery,'blue-battery'),
 profile('victron-lithium-smart-12-8-100','Lithium Battery Smart 12.8 V / 100 Ah','battery',[.321,.197,.152],battery,'blue-battery'),
 ...([160,180,200] as const).map(ah=>profile(`victron-lithium-smart-12-8-${ah}`,`Lithium Battery Smart 12.8 V / ${ah} Ah`,'battery',[.321,.237,.152],battery,'blue-battery')),
 profile('victron-lithium-smart-12-8-330','Lithium Battery Smart 12.8 V / 330 Ah','battery',[.359,.265,.206],battery,'blue-battery'),
 profile('victron-lithium-smart-25-6-100','Lithium Battery Smart 25.6 V / 100 Ah','battery',[.65,.197,.163],battery,'blue-battery'),
 profile('victron-lithium-smart-25-6-200','Lithium Battery Smart 25.6 V / 200 Ah','battery',[.65,.237,.163],battery,'blue-battery'),
 profile('victron-phoenix-12-1200-230v','Phoenix 12/1200 VE.Direct, 230 V','inverter',[.232,.117,.362],'https://www.victronenergy.com/upload/documents/Datasheet-Inverter-VE.Direct-250VA-1600VA-EN.pdf','blue-inverter'),
]
export const physicalProfile=(id?:string)=>physicalProfiles.find(p=>p.id===id)
export function applyPhysicalProfile(device:Device,id:string):Device{
 const profile=physicalProfile(id)
 if(!profile||profile.kind!==device.kind)throw new Error('The enclosure reference does not match this equipment type')
 return {...device,physicalProfile:id,spec:{...device.spec,width:profile.dimensions[0],height:profile.dimensions[1],depth:profile.dimensions[2]}}
}

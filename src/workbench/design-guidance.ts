import type {Requirements} from './model'
import {resolvedRequirements} from './appliances'
import {arrayOptions} from './design-options'
import {buildingRooms} from './building-plan'
import {CATALOG_RECORDS} from '../catalog'
import {simulationReady} from './catalog-readiness'
import {autoCirculation} from './building-circulation'

export type DesignFix = {label:string; detail:string; patch:Partial<Requirements>}
export type DesignGuidance = {message:string; fixes:DesignFix[]}

/** Suggestions retain the client's energy, peak load and backup requirements. */
export function designGuidance(input:Requirements, failure=''):DesignGuidance|null {
  let r:Requirements
  try { r=resolvedRequirements(input) }
  catch(error) { return {message:error instanceof Error?error.message:String(error),fixes:[]} }
  if(![r.dailyKwh,r.peakW,r.autonomyHours,r.sunHours,r.reserve].every(Number.isFinite)||r.dailyKwh<=0||r.peakW<=0||r.autonomyHours<=0)return {message:'Enter positive average usage, peak usage and backup hours so the designer can size the equipment.',fixes:[]}
  if(r.reserve<0||r.reserve>100)return {message:'Choose a capacity reserve between 0% and 100%.',fixes:[]}
  if(r.dailyKwh*1000>r.peakW*24)return {
    message:`Your average use is ${(r.dailyKwh*1000/24).toFixed(0)} W, which exceeds your ${r.peakW.toFixed(0)} W peak. Peak usage must be at least as high as average usage. Check these two entries.`,fixes:[],
  }
  if(r.sunHours<=0||r.sunHours>24)return {message:'Enter the equivalent hours of strong sunshine per day, between 0 and 24. This is used to size the solar array.',fixes:[]}
  let options:ReturnType<typeof arrayOptions>
  try { options=arrayOptions(r) }
  catch(error) { return {message:error instanceof Error?error.message:String(error),fixes:[]} }
  if(!options.length){
    const candidates:DesignFix[]=[
      {label:'Choose a compatible panel model',detail:'Compare available panel ratings while keeping your energy, peak and backup needs.',patch:{panelWatts:undefined,panelId:undefined,arrayOptionId:undefined}},
      {label:'Calculate the string arrangement',detail:'Keep your panel count and let the designer arrange the panels into compatible strings.',patch:{stringCount:undefined,arrayOptionId:undefined}},
      {label:'Calculate the required panel count',detail:'Size the array for your original usage and backup needs.',patch:{panelCount:undefined,stringCount:undefined,arrayOptionId:undefined}},
      {label:'Use the required roof area',detail:'Remove the panel footprint limit. Check that the resulting area is available at the property.',patch:{maxPanelArea:undefined,arrayOptionId:undefined}},
    ]
    const fixes=candidates.filter(fix=>{try{return arrayOptions({...r,...fix.patch}).length>0}catch{return false}})
    const unrestricted=arrayOptions({...r,panelId:undefined,panelWatts:undefined,panelCount:undefined,stringCount:undefined,maxPanelArea:undefined,arrayOptionId:undefined})
    if(!fixes.length&&unrestricted.length)fixes.push({label:'Automatically size compatible solar equipment',detail:'Compare panel models, counts and string arrangements for your original usage. Review the roof area shown.',patch:{panelId:undefined,panelWatts:undefined,panelCount:undefined,stringCount:undefined,maxPanelArea:undefined,arrayOptionId:undefined}})
    const target=r.dailyKwh*1000/(r.sunHours*.78)*(1+r.reserve/100+(r.priority==='headroom'?.2:0))
    const panels=CATALOG_RECORDS.filter(panel=>panel.kind==='pv'&&simulationReady(panel)),reasons:string[]=[]
    if(r.panelWatts!==undefined&&!panels.some(panel=>panel.power===r.panelWatts))reasons.push(`There is no supported ${r.panelWatts} W panel model.`)
    if(r.panelCount!==undefined&&r.stringCount!==undefined&&r.panelCount%r.stringCount!==0)reasons.push(`${r.panelCount} panels cannot be divided evenly into ${r.stringCount} strings.`)
    const selectedPanels=panels.filter(panel=>(!r.panelId||panel.id===r.panelId)&&(r.panelWatts===undefined||panel.power===r.panelWatts))
    const maximumPanelW=Math.max(0,...selectedPanels.map(panel=>panel.power??0))
    if(r.panelCount!==undefined&&maximumPanelW&&r.panelCount*maximumPanelW<target)reasons.push(`The selected ${r.panelCount} panels provide at most ${r.panelCount*maximumPanelW} W.`)
    if(r.maxPanelArea!==undefined&&unrestricted.length&&unrestricted.every(option=>option.area>r.maxPanelArea!))reasons.push(`The ${r.maxPanelArea} m² panel footprint limit is too small for the required array.`)
    return {message:`Your system needs about ${Math.ceil(target)} W of solar capacity. ${reasons.join(' ')||'The selected panel and string arrangement does not meet the controller voltage, current or temperature limits.'}${unrestricted[0]?` A compatible option uses ${unrestricted[0].modules} panels and ${unrestricted[0].area.toFixed(1)} m² of panel footprint.`:''}`,fixes}
  }
  if(r.arrayOptionId&&!options.some(option=>option.id===r.arrayOptionId))return {message:'The saved solar arrangement no longer matches these inputs. Select a current compatible arrangement.',fixes:[{label:'Select a compatible arrangement',detail:'Keep all usage and equipment constraints and select the current best match.',patch:{arrayOptionId:undefined}}]}
  if(!failure)return null
  if(r.building){
    const rooms=buildingRooms(r.building)
    if(!rooms.length)return {message:'The floor plan has no enclosed room. Connect the wall endpoints to close a room before generating.',fixes:[]}
    if(/stairs/i.test(failure)){
      const fixes:DesignFix[]=[]
      try{fixes.push({label:'Place stairs in shared floor space',detail:'Keep the house dimensions and electrical requirements. Find a staircase position shared by both floors.',patch:{building:autoCirculation({...r.building,stairs:[]})}})}catch{}
      return {message:failure,fixes}
    }
    if(/choose.*room|valid room|saved placement|no longer exists/i.test(failure))return {message:'The selected equipment room or wall is no longer available. Choose a current room, or let the designer place the equipment.',fixes:[{label:'Use an available equipment room',detail:'Keep the house and electrical requirements and select the first enclosed room for equipment.',patch:{building:{...r.building,equipmentRoomId:rooms[0].id,panelRoomId:undefined,equipmentPlacements:undefined}}}]}
    if(/placed|routed|space|fit|roof/i.test(failure))return {message:'The equipment or cable routes do not fit the selected house surfaces. Review the equipment room, wall choices and available roof space.',fixes:[{label:'Find room and wall space automatically',detail:'Keep the electrical requirements and house dimensions. Allow placement across the available roof and the largest equipment room.',patch:{building:{...r.building,equipmentRoomId:[...rooms].sort((a,b)=>b.area-a.area)[0].id,panelRoomId:undefined,equipmentPlacements:undefined}}}]}
  }
  if(/240|conductor|voltage.drop|route/i.test(failure))return {message:'The cable route is too long for the available conductor sizes. Move the battery and inverter closer together or enter the actual shorter cable route.',fixes:[]}
  return {message:failure,fixes:[]}
}

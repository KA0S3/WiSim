// Sourced transcription for existing records; rerunnable without creating new identities.
// Run with: node --loader ./scripts/ts-esbuild-loader.mjs scripts/complete-catalog-profiles.mjs
import {readFile,writeFile} from 'node:fs/promises'
import {physicalProfiles} from '../src/workbench/profiles.ts'
const file='src/catalog-data.json',db=JSON.parse(await readFile(file,'utf8')),checked='2026-11-17'
const get=id=>{const r=db.records.find(r=>r.id===id);if(!r)throw Error('Missing existing record '+id);return r}
const equivalent='Generic behavioural equivalent; internal resistance, switching dynamics, terminal coordinates and firmware are approximations.'
const profile=(r,dimensions,extra={},source=r.source)=>{r.sourceChecked=checked;r.simulation={version:1,source,checked,dimensions,geometry:'approximate',assumptions:[equivalent],...extra};return r}
for(const p of physicalProfiles){if(p.geometryOnly)continue;const r=get(p.id);profile(r,p.dimensions)}
const solar='https://www.victronenergy.com/upload/documents/Datasheet-BlueSolar-Monocrystalline-Panels-EN.pdf'
const panels=[
 [20,'SPM040201200',18.5,1.09,22.6,1.19,350,440,25],
 [30,'SPM040301200',18.7,1.61,22.87,1.76,350,560,25],
 [40,'SPM040401200',18.3,2.19,22.45,2.4,668,425,25],
 [55,'SPM040551200',18.8,2.94,22.9,3.22,668,545,25],
 [90,'SPM040901200',19.6,4.59,24.06,5.03,668,780,30],
 [115,'SPM041151202',19,6.04,23.32,6.61,668,1030,30],
 [130,'SPM041301200',18.64,6.98,22.83,7.35,668,1200,30],
 [140,'SPM041401200',19.4,7.22,23.6,8.05,668,1250,30],
 [150,'SPM041501200',18.2,8.25,22.3,8.69,668,1485,30],
 [185,'SPM041851200',19.68,9.41,24.11,9.91,668,1485,30],
 [305,'SPM043052002',32.5,9.38,39.7,10.27,1002,1658,35],
 [360,'SPM043602402',38.4,9.38,47.4,10.24,1002,1980,40],
]
for(const [power,productModel,moduleVmp,moduleImp,moduleVoc,moduleIsc,w,h,d]of panels){const r=get(`victron-bluesolar-${power}w`);Object.assign(r,{productModel,power,moduleVmp,moduleImp,moduleVoc,moduleIsc,moduleVocTemperatureCoefficientPerC:-.0035,modulePowerTemperatureCoefficientPerC:-.0045,moduleIscTemperatureCoefficientPerC:.0004,source:solar,missingData:['Appearance detail, exact connector/terminal coordinates and per-module series-fuse rating need verification.']});profile(r,[w/1000,h/1000,d/1000]);r.simulation.geometry='placeholder';r.simulation.assumptions.push('Datasheet STC ratings and temperature coefficients; no bypass-diode or partial-shading model. Exact external connector variant remains unresolved.')}
const batterySource='https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/technical-data.html'
for(const r of db.records.filter(r=>r.id.startsWith('victron-lithium-smart-'))){const v=r.voltage;profile(r,r.simulation.dimensions,{batteryLimits:{chargeA:r.maxChargeCurrentA,dischargeA:r.maxDischargeCurrentA,chargeMinC:5,chargeMaxC:50,dischargeMinC:-20,dischargeMaxC:50,lowVoltage:v/12.8*11.2,highVoltage:v/12.8*14.4,minSoc:0,maxSoc:100,control:'external',externalConnected:false,source:batterySource,maxSeries:v===12.8?4:2,maxParallel:20}});r.simulation.assumptions.push('External BMS/control is required and initially unconnected. Published pack operating voltage limits feed a bounded inhibit model; actual BMS acts on cell alarms. Total bank limit is 20 units. SOC/OCV and internal resistance remain generic.')}
const oldInverter='https://www.victronenergy.com/upload/documents/Datasheet-Inverter-VE.Direct-250VA-1600VA-EN.pdf'
const hw15='https://www.victronenergy.com/media/pg/Inverter_VE.Direct_230V_-_HW15/en/technical-specifications.html'
const legacy={250:{power:200,forty:175,surge:400,eff:[87,88,88],idle:[4.2,5.2,7.9],dims:[.165,.086,.26]},375:{power:300,forty:260,surge:700,eff:[89,89,90],idle:[5.6,6.1,8.5],dims:[.165,.086,.26]},500:{power:400,forty:350,surge:900,eff:[90,90,91],idle:[6,6.5,9],dims:[.172,.086,.275]},800:{power:650,forty:560,surge:1500,eff:[90,90,91],idle:[6.5,7,9.5],dims:[.216,.105,.305]},1200:{power:1000,forty:850,surge:2200,eff:[91,91,92],idle:[10,11,12],dims:[.232,.117,.327]},1600:{power:1450,forty:1200,surge:2200,eff:[92],idle:[12],dims:[.232,.117,.395]}}
for(const r of db.records.filter(r=>/^victron-phoenix-(12|24|48)-(250|375|500|800|1200|1600)(-230v)?$/.test(r.id))){
 const [,voltage,va]=r.id.match(/^victron-phoenix-(\d+)-(\d+)/),v=Number(voltage),size=Number(va),ix=[12,24,48].indexOf(v),current=size===1600&&v!==12,data=legacy[size]
 Object.assign(r,{voltage:v,power:data.power,surge:current?2100:data.surge,acVoltage:230,acFrequency:50,maximumEfficiencyPercent:current?[91,91,92][ix]:data.eff[ix]??data.eff[0],source:current?hw15:oldInverter,productModel:`Inverter ${v}/${size} VE.Direct 230 V ${current?'HW15':'legacy datasheet variant'}`})
 const dims=current?[.231,.117,.365]:[...data.dims];if(size===1200&&v===12)dims[2]=.362
 if(size===800&&v===12){dims[0]=.23;dims[2]=.325}
 profile(r,dims,{cutoffV:v/12*9.3,inputMinV:v/12*9.2,inputMaxV:v===48?62:v/12*17,idleW:current?[14,14,15][ix]:data.idle[ix]??data.idle[0],continuous40W:current?1300:data.forty,deratePerC:.0125})
 r.simulation.assumptions.push('230 V / 50 Hz default, editable to 60 Hz. Peak efficiency used as a constant; ECO, restart timing and dynamic cutoff are not reproduced. Hardware revisions have different ratings; match the named variant.')
 if(r.status!=='verified'){r.name=`Inverter ${v}/${size} VE.Direct 230 V (${current?'HW15':'legacy'})`;r.missingData=['Detailed appearance, terminal coordinates and exact outlet SKU remain unverified.']}
}
for(const [id,voc,amps]of [['victron-smartsolar-150-60',150,60],['victron-smartsolar-250-60',250,60],['victron-smartsolar-150-85',150,85],['victron-smartsolar-150-100',150,100]]){
 const r=get(id),restricted=amps>70,nominal=amps===60?[860,1720,2580,3440]:amps===85?[1200,2400]:[1450,2900]
 const source=restricted?'https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html':'https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-60_up_to_250-70/en/technical-specifications.html'
 Object.assign(r,{name:`SmartSolar MPPT ${voc}/${amps}-Tr${restricted?' VE.Can SCC115'+(amps===85?'085412':'110412')+' (12/24 V only)':''}`,productModel:`SmartSolar ${voc}/${amps}-Tr${restricted?' VE.Can restricted 12/24 V SKU':''}`,voltage:restricted?24:48,current:amps,chargeCurrent:amps,pvVoc:voc,pvMaxOperatingVoltage:voc-5,pvStartHeadroomV:5,pvRunHeadroomV:1,supportedBatteryVoltages:restricted?[12,24]:[12,24,36,48],nominalPvPowerWByBatteryVoltage:Object.fromEntries((restricted?[12,24]:[12,24,36,48]).map((v,i)=>[v,nominal[i]])),power:nominal.at(-1),maximumEfficiencyPercent:voc===150?98:99,maxPvShortCircuitCurrentA:restricted?70:voc===150?50:60,source,missingData:['Detailed appearance, exact terminal coordinates and installation drawing remain unverified.']})
 profile(r,restricted?[.295,.216,.103]:[.25,.185,.095]);r.simulation.geometry='placeholder';r.simulation.assumptions.push('Tr screw-terminal variant. One independent tracker. 150/85 and 150/100 listed restricted SKUs support 12/24 V only; do not apply 36/48 V ratings from other labels.')
}
const chargerSource='https://www.victronenergy.com/media/pg/Blue_Smart_IP22_Charger_230V_manual/en/technical-specifications---bsc---psc.html'
for(const r of db.records.filter(r=>r.id.startsWith('victron-blue-smart-ip22-'))){const [,v,a]=r.id.match(/ip22-(\d+)-(\d+)$/),voltage=Number(v);Object.assign(r,{name:`Blue Smart IP22 ${v}/${a} 230 V / one output`,productModel:`IP22 ${v}/${a}, 230 V one-output variant`,voltage,chargeCurrent:Number(a),maximumEfficiencyPercent:voltage===12?93:94,source:chargerSource,missingData:['Exact market plug SKU, detailed appearance and terminal coordinates remain unverified.']});profile(r,[.108,.235,.065],{acVoltage:230,acFrequency:50,chargeVoltage:voltage*1.2,idleW:.5});r.simulation.geometry='placeholder';r.simulation.assumptions.push('One DC output, normal 14.4/28.8 V target. Constant maximum efficiency and generic rectifier/link model; adaptive stages and power factor are not reproduced.')}
for(const r of db.records.filter(r=>r.id.startsWith('xantrex-freedom-x-1200'))){Object.assign(r,{acVoltage:120,acFrequency:60,maximumEfficiencyPercent:86,sourceChecked:checked,missingData:['Detailed appearance and exact terminal coordinates remain unverified.']});profile(r,[.263,.091,.376],{cutoffV:10.5,inputMinV:10.5,inputMaxV:16.5,idleW:10});r.simulation.geometry='placeholder';r.simulation.assumptions.push('Conservative 86% full-load efficiency and 10 W no-load upper bound used as constants. AC pass-through/transfer relay is not represented; inverter output only. Actual specified bounds are >86% and <10 W.')}
db.lastReviewed=checked
await writeFile(file,JSON.stringify(db,null,2)+'\n')
console.log('Completed existing panel, inverter, controller, charger and battery simulation profiles.')

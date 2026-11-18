import type { ResultType } from 'eecircuit-engine'
import {solarExposure} from './solar'
import {pvVocAtTemperature,pvIscAtTemperature,pvDiodeScale} from './pv-ratings'
import {networkMeasurements,measurementKey,measurementStart,timeAverage as average} from './measurements'
import { synchronizeLengths } from './geometry'
import {staticFindings} from './static-findings'
import {solverReferences} from './solver-references'
import {withSchedules} from './appliances'
import {batteryPermission,engineeringFindings} from './engineering'
import { emptyState, wireResistance, type Device, type Finding, type Frame, type Project, type RuntimeState } from './model'

export const terminalKey = (id: string, port: string) => `${id}:${port}`
// SPICE identifiers are case-insensitive. Encode, rather than normalize, so
// imported IDs differing by punctuation or case cannot silently join circuits.
const safe = (value: string) => Array.from(value, c => c.codePointAt(0)!.toString(16)).join('x')
export const nodeName = (id: string, port: string) => `n_${safe(id)}_${safe(port)}`
const sensor = (id: string) => `v_d_${safe(id)}`
const wireSensor = (id: string) => `v_w_${safe(id)}`
const positivePort = (d: Device) => d.kind === 'inverter' ? 'l' : (d.kind === 'mppt'||d.kind==='charger') ? 'bat+' : d.kind === 'three-phase' ? 'a' : 'p'
const negativePort = (d: Device) => (d.kind === 'mppt'||d.kind==='charger') ? 'bat-' : 'n'

export function prepareState(project: Project, state: RuntimeState): RuntimeState {
  project=withSchedules(project)
  const next=structuredClone(state)
  const ids=new Set(project.devices.map(d=>d.id))
  for(const group of ['soc','capacitors','inductors','overloadSeconds','starts','enabled'] as const)for(const key of Object.keys(next[group]))if(!ids.has(key.split(':')[0]))delete next[group][key]
  next.trips=next.trips.filter(id=>ids.has(id))
  for(const d of project.devices) { if(d.on&&!state.enabled[d.id]) next.starts[d.id]=state.time; next.enabled[d.id]=d.on }
  return next
}

export function compileCircuit(project: Project, state: RuntimeState = emptyState(), seconds = .1) {
  project=withSchedules(project)
  project=synchronizeLengths(project)
  const lines = ['WiSim terminal network', '.options reltol=0.001 abstol=1e-9 vntol=1e-6 itl1=300 itl4=100 method=gear', '.model Dgeneric D(Is=1e-12 N=1.5 Rs=.01)']
  const findings: Finding[] = staticFindings(project)
  for (const d of project.devices) {
    const id = safe(d.id), s = d.spec, n = (p: string) => nodeName(d.id, p), internal = `int_${id}`, sense = sensor(d.id)
    // Tiny bleeders define unused/open behavioral terminals. Each electrical
    // island gets its common-mode reference after all elements are stamped.
    d.ports.forEach(port => lines.push(`Rref_${id}_${safe(port.id)} ${n(port.id)} 0 1e12`))
    if (!d.on || state.trips.includes(d.id)) { lines.push(`${sense} ${n(positivePort(d))} ${internal} 0`, `Roff_${id} ${internal} ${n(d.ports.length > 1 ? negativePort(d) : 'p')} 1e12`); continue }
    const source = (value: string, out = 'p', returnPort = 'n') => { lines.push(`Bsrc_${id} src_${id} ${n(returnPort)} V=${value}`, `Rsrc_${id} src_${id} ${internal} ${Math.max(.00001, s.resistance)}`, `${sense} ${internal} ${n(out)} 0`) }
    switch (d.kind) {
      case 'battery': {
        const soc = state.soc[d.id] ?? project.initialSoc
        const ocv = s.voltage * (.92 + .1 * Math.min(1, soc / 100))
        if(d.batteryLimits){
          const b=d.batteryLimits,permission=batteryPermission(project,d,state),v=`v(${n('p')},${n('n')})`
          const charge=permission.charge?String(b.chargeA):'0'
          const discharge=permission.discharge?String(b.dischargeA):'0'
          if(permission.discharge||permission.charge)lines.push(`.nodeset v(${n('p')})=${ocv} v(${n('n')})=0`)
          lines.push(`Bbattery_${id} ${n('n')} ${internal} I=max(-(${charge}),min(${discharge},(${ocv}-${v})/${Math.max(.00001,s.resistance)}))`,`${sense} ${internal} ${n('p')} 0`)
          for(const [index,reason]of permission.reasons.entries())findings.push({id:`bms-${d.id}-${index}`,severity:'warning',title:'Battery management limits active',detail:reason+' Directional current/voltage limits use a bounded equivalent, not cell-level BMS firmware.',target:d.id})
          break
        }
        source(soc <= 0 ? '0' : String(ocv)); break
      }
      case 'pv': {
        const voc = pvVocAtTemperature(s,project.ambient), isc = pvIscAtTemperature(s,project.ambient) * project.sun / 100 * solarExposure(project,d)
        // Native diode voltage limiting converges at open circuit. The old
        // clipped behavioural exponential lost its derivative after a Newton
        // overshoot, so a disconnected illuminated panel could stall all output.
        // Iph - Is*(exp(V/a)-1) matches the existing generic I/V assumption.
        const a=pvDiodeScale(s,project.ambient),saturation=Math.max(1e-15,isc*Math.exp(-voc/a)),thermalVoltage=8.617333262145e-5*300.15
        lines.push(`.model Dpv_${id} D(Is=${saturation} N=${a/thermalVoltage} Tnom=27)`,
          `Ipv_${id} ${n('n')} ${internal} ${Math.max(0,isc-saturation)}`,
          `Dpv_${id} ${internal} ${n('n')} Dpv_${id} temp=27`, `${sense} ${internal} ${n('p')} 0`); break
      }
      case 'grid': source(`${s.voltage * Math.SQRT2}*sin(2*pi*${s.frequency}*(time+${state.time}))`); break
      case 'three-phase': {
        for (const [i, phase] of ['a', 'b', 'c'].entries()) {
          lines.push(`Bsrc_${id}_${phase} src_${id}_${phase} ${n('n')} V=${s.voltage * Math.SQRT2}*sin(2*pi*${s.frequency}*(time+${state.time})-${i * 2 * Math.PI / 3})`, `Rsrc_${id}_${phase} src_${id}_${phase} int_${id}_${phase} ${Math.max(.001, s.resistance)}`, `${i === 0 ? sense : `${sense}_${phase}`} int_${id}_${phase} ${n(phase)} 0`)
        } break
      }
      case 'mppt': {
        const resistance = s.voltage ** 2 / Math.max(1, s.watts)
        const pv=`max(0,v(${n('pv+')},${n('pv-')}))`,battery=`v(${n('bat+')},${n('bat-')})`,out=`max(1,${battery})`,target=s.chargeVoltage??60
        // One shared input-power expression feeds both converter sides. Current
        // limiting/taper must curtail PV draw as well as battery output, otherwise
        // an inactive/full controller silently consumes the entire panel output.
        const threshold=state.enabled[d.id+':tracking']?(s.pvRunHeadroom??1):(s.pvStartHeadroom??2)
        const taper=`max(0,min(1,(${target}-${battery})/${target/30}))`,present=`max(0,min(1,${battery}-1))`,headroom=`max(0,min(1,(${pv}-${battery}-${threshold})/.25))`
        const limit=`min(1,${s.rating}*${out}/(${s.efficiency}*max(1e-9,${pv}^2/${resistance})))`
        const conductance=`(${taper}*${present}*${headroom}*${limit}/${resistance})`,power=`(${pv}^2*${conductance})`
        // Keep an inactive input defined in darkness or with an open return.
        // This high-impedance sensing path is included in measured input power.
        lines.push(`Vpvinput_${id} ${n('pv+')} pv_in_${id} 0`,
          `Rpvbleed_${id} pv_in_${id} ${n('pv-')} 1e9`,
          `Bpvload_${id} pv_in_${id} ${n('pv-')} I=${pv}*${conductance}`,
          `Bcharge_${id} ${n('bat-')} ${internal} I=${s.efficiency}*${power}/${out}`,
          `${sense} ${internal} ${n('bat+')} 0`); break
      }
      case 'charger': {
        const plus='rect_p_'+id,minus='rect_n_'+id,ac='charger_ac_'+id,link='v('+plus+','+minus+')',battery='v('+n('bat+')+','+n('bat-')+')'
        const enable='max(0,min(1,('+link+'-'+Math.max(20,s.voltage*.5)+')/20))'
        lines.push(
          'Vinput_'+id+' '+n('l')+' '+ac+' 0',
          'Rinput_'+id+' '+ac+' bridge_'+id+' '+Math.max(.001,s.resistance),
          'Dbridge1_'+id+' bridge_'+id+' '+plus+' Dgeneric',
          'Dbridge2_'+id+' '+n('n')+' '+plus+' Dgeneric',
          'Dbridge3_'+id+' '+minus+' bridge_'+id+' Dgeneric',
          'Dbridge4_'+id+' '+minus+' '+n('n')+' Dgeneric',
          'Clink_'+id+' '+plus+' '+minus+' '+Math.max(1e-6,s.capacitance)+' IC='+(state.capacitors[d.id]??0),
          'Rbleed_'+id+' '+plus+' '+minus+' 1e6',
          'Rreference_'+id+' '+minus+' '+n('n')+' 1e9',
          'Bcharge_'+id+' '+n('bat-')+' '+internal+' I='+s.rating+'*max(0,min(1,('+(s.chargeVoltage??14.4)+'-'+battery+')/.5))*'+enable,
          sense+' '+internal+' '+n('bat+')+' 0',
          'Coutput_'+id+' '+n('bat+')+' '+n('bat-')+' .0001 IC='+(state.capacitors[d.id+':output']??0),
          'Routput_'+id+' '+n('bat+')+' '+n('bat-')+' 10000',
          'Binput_'+id+' '+plus+' '+minus+' I=(max(0,'+battery+'*i('+sense+'))/'+s.efficiency+'+'+(s.idleWatts??2)+'*'+enable+')/max(5,'+link+')'
        );break
      }
      case 'inverter': {
        const vdc = `v(${n('dc+')},${n('dc-')})`
        source(`${s.voltage * Math.SQRT2}*sin(2*pi*${s.frequency}*(time+${state.time})-${(s.phaseDegrees??0)*Math.PI/180})*min(1,max(0,(${vdc}-${s.cutoff})/2))`, 'l')
        lines.push(`Vdcinput_${id} ${n('dc+')} inverter_dc_${id} 0`, `Bdraw_${id} inverter_dc_${id} ${n('dc-')} I=(max(0,v(${n('l')},${n('n')})*i(${sense}))/${s.efficiency}+${s.idleWatts??8})/max(5,${vdc})*max(0,min(1,(${vdc}-${s.cutoff})/2))`); break
      }
      case 'load': case 'dc-load': case 'motor': {
        const boost = d.kind === 'motor' && state.time - (state.starts[d.id] ?? 0) < s.startupSeconds ? s.surge : 1
        const resistance = Math.max(.001, s.voltage ** 2 / Math.max(1, s.watts * boost))
        lines.push(`${sense} ${n('p')} ${internal} 0`)
        if (d.kind === 'motor') lines.push(`Rload_${id} ${internal} motor_${id} ${resistance}`, `Lload_${id} motor_${id} ${n('n')} ${Math.max(.000001, s.inductance)} IC=${state.inductors[d.id] ?? 0}`)
        else lines.push(`Rload_${id} ${internal} ${n('n')} ${resistance}`)
        break
      }
      case 'resistor': case 'switch': case 'fuse': lines.push(`${sense} ${n('p')} ${internal} 0`, `R_${id} ${internal} ${n('n')} ${Math.max(.000001, s.resistance)}`); break
      case 'capacitor': lines.push(`${sense} ${n('p')} ${internal} 0`, `C_${id} ${internal} ${n('n')} ${Math.max(1e-12, s.capacitance)} IC=${state.capacitors[d.id] ?? 0}`); break
      case 'inductor': lines.push(`${sense} ${n('p')} ${internal} 0`, `R_${id} ${internal} inductor_${id} ${Math.max(.000001, s.resistance)}`, `L_${id} inductor_${id} ${n('n')} ${Math.max(1e-9, s.inductance)} IC=${state.inductors[d.id] ?? 0}`); break
      case 'diode': lines.push(`${sense} ${n('p')} ${internal} 0`, `D_${id} ${internal} ${n('n')} Dgeneric`); break
      case 'bus': lines.push(`${sense} ${n('p')} ${internal} 0`, ...['n', 't', 'b'].map(p => `Rbus_${id}_${p} ${internal} ${n(p)} ${Math.max(.000001, s.resistance)}`)); break
      case 'ground': lines.push(`${sense} ${n('p')} 0 0`); break
    }
  }
  for (const w of project.wires) {
    const from = nodeName(w.from, w.fromPort), to = nodeName(w.to, w.toPort), mid = `wire_${safe(w.id)}`
    lines.push(`${wireSensor(w.id)} ${from} ${mid} 0`, `Rwire_${safe(w.id)} ${mid} ${to} ${Math.max(1e-7, wireResistance(w, project.ambient))}`)
  }
  for(const id of project.engineering?.earthing?.neutralBondIds??[]){const d=project.devices.find(d=>d.id===id);if(d?.ports.some(p=>p.id==='pe')&&['inverter','grid','three-phase'].includes(d.kind))lines.push(`Rbond_${safe(id)} ${nodeName(id,'n')} ${nodeName(id,'pe')} .001`)}
  const preferred=project.devices.flatMap(d=>d.ports.filter(p=>['n','pv-','bat-','dc-'].includes(p.id)).map(p=>nodeName(d.id,p.id)))
  const {references,offsets}=solverReferences(lines,preferred,state.nodes)
  lines.push(...references)
  // Restart each short transient segment with retained reactive state and source phase.
  const existingNodes=new Set(project.devices.flatMap(d=>d.ports.map(p=>nodeName(d.id,p.id))))
  for (const [node, voltage] of Object.entries(state.nodes)) if (Number.isFinite(voltage) && existingNodes.has(node)) lines.push(`.ic v(${node})=${voltage-(offsets.get(node)??0)}`)
  if (!state.time) for (const d of project.devices.filter(d => d.kind === 'capacitor')) lines.push(`.ic v(${nodeName(d.id, 'p')})=0 v(${nodeName(d.id, 'n')})=0`)
  // ngspice otherwise exports every internal wire/source node. Keep all real
  // terminals and branch currents, but avoid exporting unused implementation nodes.
  const signals=new Set<string>(['time'])
  for(const d of project.devices){
    for(const p of d.ports)signals.add(`v(${nodeName(d.id,p.id)})`)
    signals.add(`i(${sensor(d.id)})`)
    if(d.on&&!state.trips.includes(d.id)){
      if(d.kind==='three-phase')for(const phase of ['b','c'])signals.add(`i(${sensor(d.id)}_${phase})`)
      if(d.kind==='charger'){signals.add(`i(vinput_${safe(d.id)})`);signals.add(`v(rect_p_${safe(d.id)})`);signals.add(`v(rect_n_${safe(d.id)})`)}
      if(d.kind==='inverter')signals.add(`i(vdcinput_${safe(d.id)})`)
      if(d.kind==='mppt')signals.add(`i(vpvinput_${safe(d.id)})`)
    }
  }
  for(const w of project.wires)signals.add(`i(${wireSensor(w.id)})`)
  // Imported IDs can make a batch exceed ngspice's input-line limit.
  for(const signal of signals)lines.push('.save '+signal)
  // Algebraic DC networks do not need 500 repeated samples per window.
  // Keep fine sampling whenever an AC source or stored-energy device is present.
  const dynamic=project.devices.some(d=>['grid','three-phase','inverter','charger','capacitor','inductor','motor'].includes(d.kind)),step=dynamic?.0002:seconds
  lines.push(`.tran ${step} ${seconds} 0 ${step}${state.time ? ' uic' : ''}`, '.end')
  return { netlist: lines.join('\n'), findings }
}

export function interpret(project: Project, raw: ResultType, state: RuntimeState, revision: number, durationMs: number, initialFindings: Finding[] = [],expectedDuration=.1): { frame: Frame; state: RuntimeState } {
  project=withSchedules(project)
  project=synchronizeLengths(project)
  if (raw.dataType !== 'real' || !raw.numPoints) throw new Error('The solver returned no usable transient data.')
  const data = Object.fromEntries(raw.data.map(v => {
    const name=v.name.toLowerCase()
    return [name.endsWith('#branch')?`i(${name.slice(0,-7)})`:name,v.values]
  }))
  const times = data.time ?? [], end = times[times.length - 1] ?? 0
  if (!times.length || end < expectedDuration*.999 || !raw.data.every(v => v.values.every(Number.isFinite))) throw new Error('The network did not converge to a complete solution. Review source connections and component values.')
  if(times.length!==raw.numPoints||times.some((t,i)=>i>0&&t<=times[i-1])||raw.data.some(v=>v.values.length!==times.length))throw new Error('The solver returned inconsistent transient samples; live readings were not accepted.')
  // Required measurements must exist. Missing export data is not a zero reading.
  for(const d of project.devices){
    const required=[...d.ports.map(p=>`v(${nodeName(d.id,p.id)})`),`i(${sensor(d.id)})`]
    if(d.on&&!state.trips.includes(d.id)){
      if(d.kind==='three-phase')for(const phase of ['b','c'])required.push(`i(${sensor(d.id)}_${phase})`)
      if(d.kind==='charger')required.push(`i(vinput_${safe(d.id)})`,`v(rect_p_${safe(d.id)})`,`v(rect_n_${safe(d.id)})`)
      if(d.kind==='inverter')required.push(`i(vdcinput_${safe(d.id)})`)
      if(d.kind==='mppt')required.push(`i(vpvinput_${safe(d.id)})`)
    }
    if(required.some(key=>!data[key]))throw new Error(`The solver omitted required measurements for ${d.name}; live readings were not accepted.`)
  }
  for(const w of project.wires)if(!data[`i(${wireSensor(w.id)})`])throw new Error(`The solver omitted the branch current for conductor ${w.reference??w.id}; live readings were not accepted.`)
  const zeros = () => times.map(() => 0), voltage = (id: string, port: string) => data[`v(${nodeName(id, port)})`] ?? zeros()
  const next = structuredClone(state), findings = [...initialFindings]
  const measurements=networkMeasurements(project,state)
  const frame: Frame = { revision, time: state.time + end, durationMs, devices: {}, wires: {}, terminals: {}, waveforms: {}, times, measurements, findings, engine: 'ngspice 45.2 · WASM' }
  next.nodes={}
  for (const [key, values] of Object.entries(data)) if (key.startsWith('v(n_')) next.nodes[key.slice(2, -1)] = values[values.length - 1]
  for (const d of project.devices) {
    const s = d.spec, positive = voltage(d.id, positivePort(d)), negative = d.kind === 'ground' ? zeros() : voltage(d.id, negativePort(d))
    const delta = positive.map((v, i) => v - negative[i]), current = data[`i(${sensor(d.id)})`] ?? zeros()
    const measurement=measurements[measurementKey(d.id,positivePort(d))]??{ac:false,frequency:null},ac=measurement.ac&&!['battery','mppt','charger'].includes(d.kind),cut=measurementStart(times,{...measurement,ac})
    frame.measurements![d.id]={...measurement,ac}
    const power = average(delta.map((v, i) => v * current[i]), times, cut)
    const reading: Frame['devices'][string] = { voltage: average(delta, times, cut, ac), current: average(current, times, cut, ac), power, state: (!d.on ? 'open' : state.trips.includes(d.id) ? 'tripped' : Math.abs(power) > .01 || Math.abs(average(current, times, cut)) > .001 ? 'active' : 'idle') as Frame['devices'][string]['state'] }
    frame.devices[d.id] = reading
    if(d.kind==='three-phase') {
      reading.power=['a','b','c'].reduce((total,phase,i)=>{
        const pv=voltage(d.id,phase),neutral=voltage(d.id,'n'),amps=data[`i(${i===0?sensor(d.id):`${sensor(d.id)}_${phase}`})`]??zeros()
        return total+average(pv.map((v,j)=>(v-neutral[j])*amps[j]),times,cut)
      },0)
    }
    frame.waveforms[d.id] = delta
    d.ports.forEach(port => { const wave = voltage(d.id, port.id); frame.terminals[terminalKey(d.id, port.id)] = average(wave, times, cut); frame.waveforms[terminalKey(d.id, port.id)] = wave })
    if(d.kind==='pv')reading.exposure=solarExposure(project,d)
    if (d.kind === 'battery') {
      const averagePower = average(delta.map((v, i) => v * current[i]), times, 0)
      next.soc[d.id] = Math.max(0, Math.min(100, (state.soc[d.id] ?? project.initialSoc) - averagePower * end / 3600 / (s.voltage * Math.max(.1, s.capacityAh)) * 100))
      frame.devices[d.id].soc = next.soc[d.id]
      if(d.batteryLimits&&d.on){const b=d.batteryLimits;if(reading.current>1e-6&&reading.voltage<b.lowVoltage)next.enabled[d.id+':discharge-blocked']=true;if(reading.current< -1e-6&&reading.voltage>b.highVoltage)next.enabled[d.id+':charge-blocked']=true}
      if (Math.abs(reading.current) > s.rating) findings.push({ id: `battery-limit-${d.id}`, severity: 'warning', title: 'Battery current limit', detail: `${Math.abs(reading.current).toFixed(1)} A exceeds the configured ${s.rating} A limit.`, target: d.id })
    }
    if(d.kind==='charger') {
      const id=safe(d.id),input=voltage(d.id,'l').map((v,i)=>v-voltage(d.id,'n')[i]),amps=data['i(vinput_'+id+')']??zeros()
      const inputCut=measurementStart(times,measurements[measurementKey(d.id,'l')])
      reading.inputVoltage=average(input,times,inputCut,true)
      reading.inputCurrent=average(amps,times,inputCut,true)
      reading.inputPower=average(input.map((v,i)=>v*amps[i]),times,inputCut)
      const positive=data['v(rect_p_'+id+')']??zeros(),negative=data['v(rect_n_'+id+')']??zeros()
      if (d.on && !state.trips.includes(d.id)) {
        next.capacitors[d.id]=positive.at(-1)!-negative.at(-1)!
        next.capacitors[d.id+':output']=delta.at(-1)!
      }
    }
    if(d.kind==='mppt'){
      const input=voltage(d.id,'pv+').map((v,i)=>v-voltage(d.id,'pv-')[i]),amps=data[`i(vpvinput_${safe(d.id)})`]??zeros()
      reading.inputVoltage=average(input,times,cut)
      reading.inputCurrent=average(amps,times,cut)
      reading.inputPower=average(input.map((v,i)=>v*amps[i]),times,cut)
      next.enabled[d.id+':tracking']=d.on&&reading.inputCurrent>1e-6&&reading.inputVoltage>reading.voltage+(s.pvRunHeadroom??1)
    }
    if (d.on && !state.trips.includes(d.id)) {
      if (d.kind === 'capacitor') next.capacitors[d.id] = delta[delta.length - 1]
      if (d.kind === 'inductor' || d.kind === 'motor') next.inductors[d.id] = current[current.length - 1]
    }
    if (d.kind === 'inverter') {
      const vp = voltage(d.id, 'dc+'), vn = voltage(d.id, 'dc-'), vdc = average(vp.map((v, i) => v - vn[i]), times, measurementStart(times,measurements[measurementKey(d.id,'dc+')]))
      const amps=data[`i(vdcinput_${safe(d.id)})`]??zeros(),input=vp.map((v,i)=>v-vn[i])
      reading.inputVoltage=vdc
      reading.inputCurrent=average(amps,times,cut)
      reading.inputPower=average(input.map((v,i)=>v*amps[i]),times,cut)
      if(d.on&&s.dcMaxVoltage&&vdc>s.dcMaxVoltage)findings.push({id:'inverter-dc-voltage-'+d.id,severity:'fault',title:'Inverter DC input voltage exceeds its rating',detail:`${vdc.toFixed(1)} V at the input exceeds the configured ${s.dcMaxVoltage} V maximum. Review the battery series arrangement and inverter input rating.`,target:d.id})
      if(d.on&&s.dcMaxCurrent&&Math.abs(reading.inputCurrent)>s.dcMaxCurrent)findings.push({id:'inverter-dc-current-'+d.id,severity:'warning',title:'Inverter DC input current exceeds its rating',detail:`${Math.abs(reading.inputCurrent).toFixed(1)} A at the input exceeds the configured ${s.dcMaxCurrent} A maximum. Review demand, battery voltage and inverter sizing.`,target:d.id})
      if (d.on && vdc < s.cutoff + 2) { reading.state = 'warning'; findings.push({ id: `low-dc-${d.id}`, severity: 'fault', title: 'Inverter input voltage is low', detail: `${vdc.toFixed(1)} V at the input; cutoff is ${s.cutoff} V. Check the battery and both DC conductors.`, target: d.id }) }
    }
    if (d.kind === 'fuse' || d.kind === 'inverter') {
      const ratio = d.kind === 'fuse' ? average(current, times, cut, true) / Math.max(1, s.rating) : Math.abs(power) / Math.max(1, s.watts)
      next.overloadSeconds[d.id] = ratio > 1 ? (state.overloadSeconds[d.id] ?? 0) + end : 0
      const tripTime = d.kind === 'fuse' ? 5 / Math.max(.01, ratio * ratio - 1) : Math.abs(power) > s.rating ? .1 : 2
      if (ratio > 1) findings.push({ id: `overload-${d.id}`, severity: 'warning', title: `${d.name} is overloaded`, detail: `${ratio.toFixed(2)} × rating. Generic protection delay ${tripTime.toFixed(2)} s; not a manufacturer curve.`, target: d.id })
      if (next.overloadSeconds[d.id] >= tripTime && !next.trips.includes(d.id)) { next.trips.push(d.id); next.tripCauses ??= {}; next.tripCauses[d.id] = `${d.kind==='fuse'?`${average(current,times,cut,true).toFixed(1)} A exceeded ${s.rating} A`:`${Math.abs(power).toFixed(0)} W exceeded ${s.watts} W continuous (${s.rating} W surge)`} for ${next.overloadSeconds[d.id].toFixed(2)} s. Connected equipment: ${project.devices.filter(other=>project.wires.some(w=>w.from===d.id&&w.to===other.id||w.to===d.id&&w.from===other.id)).map(other=>other.name).join(', ')}.` }
      if (next.trips.includes(d.id)) { reading.state = 'tripped'; findings.push({ id: `trip-${d.id}`, severity: 'fault', title: `${d.name} has tripped`, detail: `${next.tripCauses?.[d.id] ?? 'The original trip measurement is unavailable for this older simulation state.'} Reduce connected demand or correct the circuit, then reset the simulation to clear the latched trip.`, target: d.id }) }
    }
    if (d.kind === 'mppt') {
      const a = voltage(d.id, 'pv+'), b = voltage(d.id, 'pv-'), pvV = average(a.map((v, i) => v - b[i]), times, measurementStart(times,measurements[measurementKey(d.id,'pv+')]))
      if (pvV > s.voc) findings.push({ id: `pv-limit-${d.id}`, severity: 'fault', title: 'PV input overvoltage', detail: `${pvV.toFixed(1)} V exceeds the configured ${s.voc} V input limit.`, target: d.id })
    }
  }
  for (const w of project.wires) {
    const wave = data[`i(${wireSensor(w.id)})`] ?? zeros(), r = wireResistance(w, project.ambient)
    const measurement=measurements[measurementKey(w.from,w.fromPort)]??{ac:false,frequency:null},ac=measurement.ac,cut=measurementStart(times,measurement)
    frame.measurements![w.id]=measurement
    const rms = average(wave, times, cut, true), current = average(wave, times, cut, ac)
    frame.wires[w.id] = { current, drop: rms * r, loss: rms * rms * r, resistance: r }
    frame.waveforms[w.id] = wave
    if (rms * r > 1) findings.push({ id: `drop-${w.id}`, severity: 'warning', title: 'Conductor voltage drop', detail: `${(rms * r).toFixed(2)} V lost over ${w.length} m of ${w.area} mm² conductor, including contact resistance.`, target: w.id })
  }
  const engineering=engineeringFindings(project,frame)
  const engineeringIds=new Set(engineering.map(f=>f.id))
  for(let index=findings.length-1;index>=0;index--)if(engineeringIds.has(findings[index].id))findings.splice(index,1)
  findings.push(...engineering)
  const conflictingSources=project.devices.filter(d=>d.on&&['grid','three-phase','inverter'].includes(d.kind)&&frame.measurements?.[d.id]?.ac&&frame.measurements[d.id].frequency===null)
  for (const d of project.devices) {
    const s = d.spec, reading = frame.devices[d.id]
    if (d.kind === 'capacitor') reading.storedEnergyJ = .5 * s.capacitance * (next.capacitors[d.id] ?? 0) ** 2
    if (d.kind === 'inductor' || d.kind === 'motor') reading.storedEnergyJ = .5 * s.inductance * (next.inductors[d.id] ?? 0) ** 2
    if (d.kind === 'charger') reading.storedEnergyJ = .5 * s.capacitance * (next.capacitors[d.id] ?? 0) ** 2 + .5 * .0001 * (next.capacitors[d.id + ':output'] ?? 0) ** 2
    if (d.on && d.kind === 'capacitor' && Math.abs(reading.voltage) > s.voltage) findings.push({ id: `capacitor-voltage-${d.id}`, severity: 'fault', title: 'Capacitor voltage rating exceeded', detail: `${Math.abs(reading.voltage).toFixed(2)} V exceeds the configured ${s.voltage} V rating. Isolate and discharge before changing equipment.`, target: d.id })
    if (d.on && d.kind === 'capacitor' && reading.voltage < -.5) findings.push({ id: `capacitor-polarity-${d.id}`, severity: 'warning', title: 'Capacitor has reverse voltage', detail: `${reading.voltage.toFixed(2)} V from + to −. Review polarity and whether the actual capacitor permits bipolar operation.`, target: d.id })
    if (d.on && ['load', 'dc-load', 'motor'].includes(d.kind) && reading.voltage > s.voltage * 1.1) findings.push({ id: `load-voltage-${d.id}`, severity: 'warning', title: 'Appliance supply exceeds its configured voltage', detail: `${reading.voltage.toFixed(1)} V at ${d.name}, configured for ${s.voltage} V. Check its actual input range and connected source.`, target: d.id })
  }
  if(Object.values(measurements).some(m=>m.observationFrequency===null))findings.push({id:'coupled-observation-window',severity:'info',title:'Power-coupled sources use a shared measurement window',detail:`Different source frequencies share a power-coupled network. Associated readings use the full ${(end*1000).toFixed(1)} ms sample window so source, conversion and cable power can be compared. Inspect source and transfer arrangements; individual AC/DC classifications are retained.`})
  if(conflictingSources.length)findings.push({id:'frequency-conflict',severity:'fault',title:'AC sources have incompatible frequencies',detail:'Connected sources do not share one frequency: '+conflictingSources.map(d=>d.name+' ('+d.spec.frequency+' Hz)').join(', ')+'. Readings use the full sampled window; check source and transfer connections.'})
  next.time = state.time + end
  return { frame, state: next }
}

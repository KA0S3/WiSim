import { Simulation } from 'eecircuit-engine'
import { compileCircuit, interpret, prepareState } from './engine'
import { type Project, type Frame,type RuntimeState } from './model'
import { SimulationSession } from './session'
import {transferableFrame} from './frame-transfer'

const session = new SimulationSession()
const engine = new Simulation()
let busy = false
self.onmessage = async ({ data }: MessageEvent<{ type: 'run' | 'reset'; project: Project; revision: number; requestId: number;seconds?:number;checkpoint?:RuntimeState }>) => {
  if (data.type === 'reset') { session.reset(); return }
  if (busy) return
  busy = true
  try {
    const start = performance.now()
    let state = session.prepare(data.project)
    if(data.checkpoint){session.state=structuredClone(data.checkpoint);state=session.state}
    if (!data.project.devices.length) {
      const frame: Frame = { revision: data.revision, time: 0, durationMs: 0, devices: {}, wires: {}, terminals: {}, waveforms: {}, times: [], findings: [], engine: 'ngspice 45.2 · WASM' }
      self.postMessage({ type: 'frame', frame, requestId: data.requestId })
      return
    }
    self.postMessage({type:'phase',phase:'initialising',requestId:data.requestId})
    await engine.start()
    self.postMessage({type:'phase',phase:'compiling',requestId:data.requestId})
    state=prepareState(data.project,state)
    const seconds=data.seconds??.1,compiled = compileCircuit(data.project, state,seconds)
    engine.setNetList(compiled.netlist)
    self.postMessage({type:'phase',phase:'solving',requestId:data.requestId})
    const raw = await engine.runSim()
    self.postMessage({type:'phase',phase:'reading',requestId:data.requestId})
    const result = interpret(data.project, raw, state, data.revision, performance.now() - start, compiled.findings,seconds)
    session.state = result.state
    const packed=transferableFrame(result.frame);packed.frame.durationMs=performance.now()-start
    self.postMessage({ type: 'frame', frame: packed.frame,state:result.state, requestId: data.requestId },{transfer:packed.transfer})
  } catch (error) {
    const reason=error instanceof Error?error.message:String(error)
    const details=[...new Set([...reason.split('\n'),...engine.getError().slice(-6)].map(line=>line.trim()).filter(line=>line&&line!=='[object Object]'))].join('\n')
    self.postMessage({ type: 'error', error: details, requestId: data.requestId, revision: data.revision })
  } finally { busy = false }
}

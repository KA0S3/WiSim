import {useEffect,useRef,useState} from 'react'
import {runCommissioning} from './commissioning-replay'
import {download} from './exports'

export function CommissioningReplay() {
  const active=useRef<AbortController|null>(null)
  const [result,setResult]=useState<Awaited<ReturnType<typeof runCommissioning>>>()
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  useEffect(()=>()=>active.current?.abort(),[])
  async function run(){
    if(active.current)return
    const controller=new AbortController()
    active.current=controller
    setBusy(true);setResult(undefined);setError('')
    let worker:Worker|undefined
    try {
      worker=new Worker(new URL('./simulation.worker.ts',import.meta.url),{type:'module'})
      setResult(await runCommissioning(worker,controller.signal))
    } catch(cause) {
      if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:String(cause))
    } finally {
      worker?.terminate();active.current=null
      if(!controller.signal.aborted)setBusy(false)
    }
  }
  function cancel(){active.current?.abort();setBusy(false)}
  return <details><summary>Guided commissioning replay</summary>
    <p>Watch the branch as a second load starts, protection trips, the overload is removed, and the source is isolated and restored.</p>
    <p>Measure across the essential load’s positive and negative terminals. Expect about 12.8 V at baseline and after repair, and about 0 V after the trip or during source isolation.</p>
    <button className="secondary-button" disabled={busy} onClick={()=>void run()}>Run commissioning replay</button>
    {busy&&<button onClick={cancel}>Cancel replay</button>}
    {error&&<p role="alert">{error}</p>}
    {result&&<section aria-label="Commissioning results">
      <ul>{result.stages.map(stage=>{
        const point=result.trace.filter(row=>row.stage===stage.name).at(-1)!
        return <li key={stage.name}>{stage.name} · {point.loadV.toFixed(2)} V at load · {Math.abs(point.currentA).toFixed(2)} A{point.tripped?' · Tripped':''}{point.cause?' · '+point.cause:''}</li>
      })}</ul>
      <button className="secondary-button" onClick={()=>download('wisim-commissioning.json',JSON.stringify(result,null,2))}>Export trace and repair sequence</button>
    </section>}
  </details>
}

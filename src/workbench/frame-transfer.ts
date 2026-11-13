import type {Frame,NumericSeries} from './model'

/** Transfer sample buffers instead of cloning millions of boxed numbers on the UI thread. */
export function transferableFrame(frame:Frame):{frame:Frame;transfer:ArrayBuffer[]}{
 const arrays=new Map<NumericSeries,Float64Array>(),transfer:ArrayBuffer[]=[]
 const pack=(series:NumericSeries)=>{let packed=arrays.get(series);if(!packed){packed=new Float64Array(series);arrays.set(series,packed);transfer.push(packed.buffer as ArrayBuffer)}return packed}
 return {frame:{...frame,times:pack(frame.times),waveforms:Object.fromEntries(Object.entries(frame.waveforms).map(([key,values])=>[key,pack(values)]))},transfer}
}

import {useEffect,useRef,useState} from 'react'
import {PropertyPicker,type MapStart} from './PropertyPicker'
import {MapPinned} from 'lucide-react'
import {findProperties,siteCoordinates,propertyImagery,type PropertyMatch,type SiteSnapshot} from './site-snapshot'
import {NumberField} from './NumberField'

type Props = {site?:SiteSnapshot; onChange:(site?:SiteSnapshot,fit?:boolean)=>void}
export function SiteMapControl({site,onChange}:Props) {
  const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [address,setAddress]=useState(''),[matches,setMatches]=useState<PropertyMatch[]>([]),[status,setStatus]=useState('')
  const [mapStart,setMapStart]=useState<MapStart|null>(null)
  const [searching,setSearching]=useState(false),[searched,setSearched]=useState(false),[searchError,setSearchError]=useState('')
  const [enabled,setEnabled]=useState(false)
  const results=useRef<HTMLDivElement>(null)
  const query=address.trim()
  useEffect(()=>{
    setMatches([]);setSearched(false);setSearchError('')
    if(!enabled||query.length<3){setSearching(false);return}
    const controller=new AbortController()
    setSearching(true)
    const timer=window.setTimeout(async()=>{
      try{
        const found=await findProperties(query,AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]))
        if(!controller.signal.aborted){setMatches(found);setSearched(true)}
      }catch{
        if(!controller.signal.aborted)setSearchError('Address search is unavailable. You can still find your house on the map.')
      }finally{if(!controller.signal.aborted)setSearching(false)}
    },350)
    return ()=>{clearTimeout(timer);controller.abort()}
  },[query,enabled])
  function openMap(start:MapStart){
    setEnabled(false);setError('');setStatus('');setMapStart(start)
  }
  const job=useRef<AbortController|null>(null), latest=useRef(onChange)
  latest.current=onChange
  useEffect(()=>()=>job.current?.abort(),[])
  async function load(file?:File, point?:[number,number]) {
    if(job.current)return
    const controller=new AbortController()
    job.current=controller
    setBusy(true)
    setError('')
    setStatus('')
    setMatches([])
    try {
      let blob:Blob
      if(file) {
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20_000_000)throw new Error('Choose a PNG, JPEG or WebP image under 20 MB.')
        blob=file
      } else {
        if(!point)throw new Error('Pin your house on the map first.')
        const [lat,lon]=point
        blob=await propertyImagery(lat,lon,80,AbortSignal.any([controller.signal,AbortSignal.timeout(25000)]))
      }
      const bitmap=await createImageBitmap(blob)
      const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height))
      const canvas=document.createElement('canvas')
      canvas.width=Math.max(1,Math.round(bitmap.width*scale))
      canvas.height=Math.max(1,Math.round(bitmap.height*scale))
      canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height)
      bitmap.close()
      const image=canvas.toDataURL('image/jpeg',.76)
      const height=80*canvas.height/canvas.width
      if(image.length>700000||height>10000)throw new Error('Crop the image more closely around the property and try again.')
      if(!controller.signal.aborted){
        latest.current({image,width:80,height,x:0,z:0,source:file?'upload':'esri'},true)
        setMapStart(null);setEnabled(false);setStatus('Snapshot ready. Trace your house on the plan below.')
      }
    } catch(cause) {
      if(!controller.signal.aborted)setError(cause instanceof Error && !(cause instanceof TypeError) && !(cause instanceof DOMException)?cause.message:'Could not load the snapshot. Try again or choose another image.')
    } finally {
      job.current=null
      if(!controller.signal.aborted)setBusy(false)
    }
  }
  return <details className="site-map-control"><summary><MapPinned size={18}/>Site map <small>{site?'Snapshot attached':'Find your house'}</small></summary>
    <label className="field"><span>Street address</span><input autoComplete="off" maxLength={240} value={address} disabled={busy} onFocus={()=>setEnabled(true)} onChange={e=>{setAddress(e.target.value);setEnabled(true);setStatus('');setError('')}} onKeyDown={e=>{
      if(e.key==='Enter'||e.key==='ArrowDown'){e.preventDefault();results.current?.querySelector('button')?.focus()}
      if(e.key==='Escape'){e.stopPropagation();setEnabled(false)}
    }} placeholder="House number, street, city and country"/></label>
    {enabled&&<><p role="status">{searching?'Searching addresses…':searchError||(!searched?'':matches.length===0?'House not found. Try a nearby street or town, or pin your house on the map.':!matches.some(m=>m.house)?'House not found. Choose a nearby place, then pin your roof.':matches.length+' search results. Choose a location to inspect.')}</p>
    {matches.length>0&&<div className="property-matches" ref={results} role="group" aria-label="Address suggestions" onKeyDown={e=>{
      const buttons=Array.from(e.currentTarget.querySelectorAll('button'))
      const i=buttons.indexOf(document.activeElement as HTMLButtonElement)
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)))]?.focus()}
    }}>{matches.map(m=><button type="button" key={m.label+m.latitude+','+m.longitude} disabled={busy} onClick={()=>openMap(m)}>{m.label}<small>{m.house?'Address':'Area'}</small></button>)}</div>}</>}
    {!mapStart&&<div className="plan-toolbar"><button type="button" disabled={busy} onClick={()=>openMap({latitude:0,longitude:0,zoom:2,label:'Pin your house'})}>Browse satellite map</button></div>}
    {mapStart&&<PropertyPicker start={mapStart} busy={busy} onCapture={(lat,lon)=>load(undefined,[lat,lon])} onClose={()=>{setMapStart(null);setEnabled(true)}}/>}
    {status&&site&&<p role="status">{status}</p>}
    <small>Address search by Photon · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></small>
    <details className="site-alternatives"><summary>Use a map pin or upload an image</summary>
    <label className="field"><span>Google Maps link or coordinates</span><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Paste a full Maps link or latitude, longitude"/></label>
    <div className="plan-toolbar"><button type="button" disabled={busy||!input.trim()} onClick={()=>{try{const [latitude,longitude]=siteCoordinates(input);openMap({latitude,longitude,zoom:18,label:'Map pin'})}catch(cause){setError(cause instanceof Error?cause.message:'Invalid coordinates.')}}}>Locate on map</button>
    <label className="site-upload">Upload image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void load(file)}}/></label></div></details>
    {error&&<p role="alert">{error}</p>}
    {site&&<><p>{site.source==='upload'?'Set the full image width in metres before tracing.':'North-up imagery covers 80 metres across at import.'} Adjust the offsets to align an existing plan.</p>
    <div className="design-fields"><NumberField label="Image width" unit="m" value={site.width} min={1} max={Math.min(10000,10000*site.width/site.height)} onChange={width=>onChange({...site,width,height:width*site.height/site.width})}/>
    <NumberField label="Horizontal offset" unit="m right" value={site.x} min={-10000} max={10000} onChange={x=>onChange({...site,x})}/>
    <NumberField label="Vertical offset" unit="m down" value={site.z} min={-10000} max={10000} onChange={z=>onChange({...site,z})}/></div>
    <div className="plan-toolbar"><button onClick={()=>onChange(undefined)}>Remove snapshot</button></div></>}
  </details>
}

import {useEffect,useRef,useState} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {imageryCredit} from './site-snapshot'

export type MapStart={latitude:number;longitude:number;zoom:number;label:string}

export function PropertyPicker({start,busy,onCapture,onClose}:{start:MapStart;busy:boolean;onCapture:(lat:number,lon:number)=>void;onClose:()=>void}){
  const container=useRef<HTMLDivElement>(null), map=useRef<L.Map|null>(null)
  const [pin,setPin]=useState<L.LatLng|null>(null),[tileError,setTileError]=useState(false)
  useEffect(()=>{
    const element=container.current!
    const view=L.map(element,{maxZoom:21,minZoom:2,worldCopyJump:true,scrollWheelZoom:false,maxBounds:[[-85,-Infinity],[85,Infinity]],maxBoundsViscosity:1}).setView([start.latitude,start.longitude],start.zoom)
    map.current=view
    setPin(null)
    setTileError(false)
    const satellite=L.layerGroup().addTo(view)
    const tiles=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:19,maxZoom:21,attribution:imageryCredit}).addTo(satellite)
    const reference='https://server.arcgisonline.com/ArcGIS/rest/services/Reference'
    L.tileLayer(reference+'/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:19,maxZoom:21,zIndex:2,errorTileUrl:L.Util.emptyImageUrl}).addTo(satellite)
    L.tileLayer(reference+'/World_Transportation/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:19,maxZoom:21,zIndex:3,errorTileUrl:L.Util.emptyImageUrl}).addTo(satellite)
    const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxNativeZoom:19,maxZoom:21,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    })
    L.control.layers({'Satellite + labels':satellite,'Street map':streets},{},{collapsed:false}).addTo(view)
    let failures=false
    tiles.on('loading',()=>{failures=false})
    tiles.on('tileerror',()=>{failures=true;setTileError(true)})
    tiles.on('load',()=>setTileError(failures))
    view.on('click',(e:L.LeafletMouseEvent)=>setPin(e.latlng.wrap()))
    const observer=new ResizeObserver(()=>view.invalidateSize())
    observer.observe(element)
    return ()=>{observer.disconnect();view.remove();map.current=null}
  },[start])
  useEffect(()=>{
    if(!pin||!map.current)return
    const group=L.layerGroup().addTo(map.current)
    const latitudeSpan=40/6378137*180/Math.PI
    const longitudeSpan=latitudeSpan/Math.cos(pin.lat*Math.PI/180)
    L.rectangle([[pin.lat-latitudeSpan,pin.lng-longitudeSpan],[pin.lat+latitudeSpan,pin.lng+longitudeSpan]],{interactive:false,color:'#ffffff',weight:2,dashArray:'5 4',fillOpacity:.08}).addTo(group)
    L.circleMarker(pin,{interactive:false,radius:7,color:'white',weight:3,fillColor:'#e55228',fillOpacity:1}).addTo(group)
    return ()=>{group.remove()}
  },[pin,start])
  return <section className="property-picker" aria-label="Choose house on satellite map">
    <strong>{start.label}</strong>
    <p>Drag to move, zoom in, then click or tap your roof. The outline shows the 80 m snapshot.</p>
    <div ref={container} inert={busy} className="property-map" aria-label="Satellite map"/>
    {tileError&&<p role="status">Some imagery could not load. Pan or zoom to try another view.</p>}
    <div className="plan-toolbar"><button type="button" disabled={busy} onClick={()=>{const view=map.current;if(view)setPin(view.getCenter().wrap())}}>Pin map centre</button>
    <button type="button" className="property-search" disabled={!pin||busy} onClick={()=>{if(pin)onCapture(pin.lat,pin.lng)}}>{busy?'Capturing…':'Capture pinned house'}</button>
    <button type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
  </section>
}

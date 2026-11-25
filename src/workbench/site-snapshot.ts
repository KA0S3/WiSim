export type SiteSnapshot = {
  visible?: boolean
  image: string
  source: 'esri' | 'upload'
  width: number
  height: number
  x: number
  z: number
}

export const imageryCredit = 'Esri, Vantor, Earthstar Geographics, and the GIS User Community'

export type PropertyMatch = {label:string; latitude:number; longitude:number; house:boolean; zoom:number}
type AddressFeature = {
  geometry?: {coordinates?: number[]}
  properties?: {name?:string; type?:string; housenumber?:string; street?:string; district?:string; city?:string; state?:string; postcode?:string; country?:string}
}

export async function findProperties(address:string,signal:AbortSignal):Promise<PropertyMatch[]> {
  const params=new URLSearchParams({q:address.trim(),limit:'40',lang:'en'})
  const response=await fetch('https://photon.komoot.io/api/?'+params,{signal})
  if(!response.ok)throw new Error('Address search is unavailable. Try again in a moment.')
  const data=await response.json() as {features:AddressFeature[]}
  const matches:PropertyMatch[]=[]
  for(const feature of data.features){
    const [longitude,latitude]=feature.geometry?.coordinates??[]
    const p=feature.properties
    if(!p||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>85||Math.abs(longitude)>180)continue
    const house=!!(p.housenumber&&p.street)
    const street=[p.housenumber,p.street].filter(Boolean).join(' ')
    const label=[...new Set([street,p.name,p.district,p.city,p.state,p.postcode,p.country].filter(Boolean))].join(', ')
    const zoom=house?18:p.type==='country'?5:p.type==='state'?8:p.type==='city'?13:16
    if(label&&!matches.some(match=>match.label===label&&match.latitude===latitude&&match.longitude===longitude))matches.push({label,latitude,longitude,house,zoom})
  }
  return matches
}

export function siteCoordinates(input: string): [number, number] {
  let pair = input.trim()
  if (/^https?:/i.test(pair)) {
    const url = new URL(pair)
    if (!/^(?:(?:www|maps)\.)?google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/i.test(url.hostname)) {
      throw new Error('Open the shared link in Google Maps and copy the full address from your browser, or paste the coordinates.')
    }
    const path = decodeURIComponent(url.pathname)
    pair = path.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/)?.slice(1).join(',') ||
      url.searchParams.get('query') || url.searchParams.get('q') ||
      path.match(/@(-?[\d.]+,-?[\d.]+)/)?.[1] || url.searchParams.get('ll') || ''
  }
  const match = pair.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!match || Math.abs(+match[1]) > 85 || Math.abs(+match[2]) > 180) {
    throw new Error('Use latitude, longitude or a full Google Maps link containing coordinates.')
  }
  return [+match[1], +match[2]]
}

export function satelliteUrl(latitude: number, longitude: number, width: number) {
  const rad = Math.PI / 180
  const x = 6378137 * longitude * rad
  const y = 6378137 * Math.log(Math.tan(Math.PI / 4 + latitude * rad / 2))
  const half = width / (2 * Math.cos(latitude * rad))
  const params = new URLSearchParams({bbox:[x-half,y-half,x+half,y+half].join(','),bboxSR:'3857',imageSR:'3857',size:'960,960',format:'jpg',f:'image'})
  return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?' + params
}

export async function propertyImagery(latitude:number,longitude:number,width:number,signal:AbortSignal):Promise<Blob> {
  try {
    const response=await fetch(satelliteUrl(latitude,longitude,width),{signal})
    if(response.ok&&response.headers.get('content-type')?.startsWith('image/'))return await response.blob()
  } catch(error) {
    if(signal.aborted)throw error
  }
  // Crop cached Web Mercator tiles to the same ground extent as the export.
  const radians=latitude*Math.PI/180
  const circumference=2*Math.PI*6378137
  const level=Math.min(19,Math.floor(Math.log2(960*circumference*Math.cos(radians)/(width*256))))
  const tileCount=2**level,world=tileCount*256
  const pixels=width*world/(circumference*Math.cos(radians))
  const left=(longitude+180)/360*world-pixels/2
  const top=(1-Math.asinh(Math.tan(radians))/Math.PI)/2*world-pixels/2
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=Math.ceil(pixels)
  const ctx=canvas.getContext('2d')!
  ctx.scale(canvas.width/pixels,canvas.height/pixels)
  async function drawTile(x:number,y:number){
    const column=(x+tileCount)%tileCount
    const response=await fetch('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/'+[level,y,column].join('/'),{signal})
    if(!response.ok)throw new Error('Satellite imagery is unavailable for this property. Try again or upload a snapshot.')
    const bitmap=await createImageBitmap(await response.blob())
    ctx.drawImage(bitmap,x*256-left,y*256-top,256,256)
    bitmap.close()
  }
  const tiles:Promise<void>[]=[]
  for(let y=Math.floor(top/256);y<Math.ceil((top+pixels)/256);y++){
    for(let x=Math.floor(left/256);x<Math.ceil((left+pixels)/256);x++)tiles.push(drawTile(x,y))
  }
  await Promise.all(tiles)
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not create the site image.')),'image/png'))
}

export function validSiteSnapshot(site: SiteSnapshot) {
  return !!site && (site.visible===undefined || typeof site.visible==="boolean") && typeof site.image === 'string' && site.image.length <= 700000 &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(site.image) &&
    ['esri','upload'].includes(site.source) && [site.width,site.height].every(n=>Number.isFinite(n)&&n>0&&n<=10000) &&
    [site.x,site.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=10000)
}

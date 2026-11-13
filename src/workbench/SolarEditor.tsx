import type {Project,Triple} from './model'
import {Value} from './SpaceEditor'
import {defaultSolarSite,facing,setPanelFacing,setRoofFacing,siteSun,solarExposure} from './solar'
import {mountDevice} from './spatial'

export function SolarEditor({project,selected,onChange}:{project:Project;selected:string|null;onChange:(p:Project)=>void}){
 const panel=project.devices.find(d=>d.id===selected&&d.kind==='pv'),roof=project.structures?.find(s=>s.id===selected&&s.kind==='roof')
 const site=project.solarSite??defaultSolarSite,sun=siteSun(site),pose=facing(panel?(panel.rotation??[0,0,0]):(roof?.rotation??[-Math.PI/2,0,0]))
 const save=(patch:Partial<typeof site>)=>onChange({...project,solarSite:{...site,...patch}})
 const rotate=(tilt:number,azimuth:number)=>{if(panel)onChange(setPanelFacing(project,panel.id,tilt,azimuth));else if(roof)onChange(setRoofFacing(project,roof.id,tilt,azimuth))}
 const angle=pose.azimuth*Math.PI/180,sa=sun.azimuth*Math.PI/180
 const localTime=new Date(Date.parse(site.date)+site.utcOffsetMinutes*60000).toISOString().slice(0,16)
 return <details className="solar-editor" open={!!panel||!!roof}>
  <summary title="Set panel/roof angles and compare solar incidence at a chosen place and time.">{panel?'Panel angle & sun':roof?'Roof angle & sun':'Sun & compass'}</summary>
  {(panel||roof)&&<>
   {panel&&<label>Roof<select aria-label="Panel roof" value={project.structures?.some(s=>s.id===panel.mount?.structureId&&s.kind==='roof')?panel.mount?.structureId:''} onChange={e=>onChange(mountDevice(project,panel.id,e.target.value||null))}><option value="">Not roof-mounted</option>{project.structures?.filter(s=>s.kind==='roof').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
   <Value label={roof?'Roof pitch degrees':'Panel tilt degrees'} min={0} max={90} value={pose.tilt} onChange={tilt=>rotate(tilt,pose.azimuth)}/>
   <Value label="Facing azimuth degrees" min={0} max={360} value={pose.azimuth} onChange={azimuth=>rotate(pose.tilt,azimuth)}/>
   <p>Tilt: 0° is flat, 90° is upright. Facing: 0° north, 90° east, 180° south, 270° west.</p>
   {panel?.mount&&<button title="Align with the mounting surface; preserve your position on it." onClick={()=>onChange({...project,devices:project.devices.map(d=>d.id===panel.id?{...d,mount:{...d.mount!,rotation:[0,0,0] as Triple}}:d)})}>Match mounting angle</button>}
   {panel&&<button disabled={sun.altitude<=0} title="Set this panel perpendicular to the current sun direction. This is a one-time adjustment." onClick={()=>rotate(Math.max(0,90-sun.altitude),sun.azimuth)}>Aim at sun now</button>}
  </>}
  <div className="site-compass"><svg viewBox="0 0 120 120" role="img" aria-label="Site compass, north up"><circle cx="60" cy="60" r="40" fill="#f4f8f0" stroke="#b4c8b8"/>{[['N',60,13],['E',108,64],['S',60,113],['W',12,64]].map(([text,x,y])=><text key={text} x={x} y={y} textAnchor="middle" fontSize="11" fill="#476653">{text}</text>)}{(panel||roof)&&<line x1="60" y1="60" x2={60+32*Math.sin(angle)} y2={60-32*Math.cos(angle)} stroke="#24735c" strokeWidth="3"/>}<circle cx={60+40*Math.sin(sa)} cy={60-40*Math.cos(sa)} r="5" fill={sun.altitude>0?'#dcaa3b':'#81919b'}/></svg><div><strong>Site compass · north up</strong><p>Sun: {sun.azimuth.toFixed(1)}° azimuth<br/>{sun.altitude.toFixed(1)}° above horizon</p>{panel&&site.enabled&&<output aria-label="Panel solar exposure">{(solarExposure(project,panel)*100).toFixed(1)}% exposure factor</output>}</div></div>
  <label title="When enabled, panel tilt, direction, site and time affect the live PV current. Off preserves the sunlight slider behaviour."><input type="checkbox" checked={site.enabled} onChange={e=>save({enabled:e.target.checked})}/>Use site & panel angles in simulation</label>
  <details><summary>Site & time settings</summary>
   <small>Default example: Johannesburg, 12 November 2026. Enter your own location and time.</small>
   <Value label="Site latitude" min={-90} max={90} value={site.latitude} onChange={latitude=>save({latitude})}/>
   <Value label="Site longitude" min={-180} max={180} value={site.longitude} onChange={longitude=>save({longitude})}/>
   <Value label="UTC offset hours" min={-14} max={14} value={site.utcOffsetMinutes/60} onChange={hours=>save({utcOffsetMinutes:hours*60})}/>
   <label>Time at site<input aria-label="Time at site" type="datetime-local" value={localTime} onChange={e=>{const ms=Date.parse(e.target.value+'Z')-site.utcOffsetMinutes*60000;if(Number.isFinite(ms))save({date:new Date(ms).toISOString()})}}/></label>
   <button title="Advance the site clock by one hour; this does not run an annual-yield study." onClick={()=>save({date:new Date(Date.parse(site.date)+3600000).toISOString()})}>Advance 1 hour</button>
   <Value label="Diffuse sky fraction" min={0} max={1} value={site.diffuseFraction} onChange={diffuseFraction=>save({diffuseFraction})}/>
  </details>
  <small>Green: selected facing. Gold: sun. World north is −Z; east is +X. Exposure compares beam incidence plus assumed diffuse sky. Weather, roof shadows and annual yield are not included.</small>
 </details>
}

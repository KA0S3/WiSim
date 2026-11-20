import {VersionComparison} from './VersionComparison'
import {useEffect, useState} from 'react'
import {blankProject, uid, type Project} from './model'
import {exportLibraryArchive, restoreLibraryArchive, validateArchive, type LibraryArchive, deleteLibraryProject, moveLibraryProject, listLibraryProjects, listProjectVersions, loadLibraryProject, loadProjectVersion, saveLibraryProject, type SavedProject, type ProjectVersion} from './project-library'
import {download} from './exports'

const when = (time:number) => new Date(time).toLocaleString()
export function ProjectLibrary({current,revision,onOpen,onSave}:{current:Project;revision:number;onOpen:(p:Project)=>Promise<boolean>;onSave:()=>Promise<boolean>}) {
 const [projects,setProjects] = useState<Omit<SavedProject,'project'>[]>([])
 const [versions,setVersions] = useState<Omit<ProjectVersion,'project'>[]>([])
 const [versionProject,setVersionProject] = useState<string|null>(null)
 const [name,setName] = useState(current.name+' copy')
 const [archive,setArchive] = useState<LibraryArchive|null>(null)
 const [selectedProjects,setSelectedProjects] = useState<string[]>([])
 const [folder,setFolder] = useState('*')
 const [deleting,setDeleting] = useState<string|null>(null)
 const [error,setError] = useState(''), [busy,setBusy] = useState(false), [loading,setLoading] = useState(true)
 useEffect(()=>{
  let live=true
  listLibraryProjects().then(items=>{if(live){setProjects(items);setError('')}}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)})
  return()=>{live=false}
 },[revision])
 const run = async(fn:()=>Promise<unknown>)=>{
  setBusy(true);setError('')
  try{await fn();setProjects(await listLibraryProjects())}
  catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 const history = (id:string)=>run(async()=>{setVersions(await listProjectVersions(id));setVersionProject(id)})
 const remove = (id:string)=>run(async()=>{
  if(id===current.id&&!await onOpen(blankProject()))throw new Error('Could not switch away from the current project. Please retry.')
  await deleteLibraryProject(id)
  setDeleting(null)
  if(versionProject===id){setVersionProject(null);setVersions([])}
 })
 const folders = [...new Set(projects.map(p=>p.folder).filter((f):f is string=>!!f))].sort()
 return <section className="project-library" aria-label="Saved project library">
  <h3>Your saved projects</h3><p>Saved in this browser on this device. Use a JSON download for a portable backup. Save project or Ctrl+S keeps a version. The latest 20 versions per project are retained.</p>
  <div className="library-save-actions"><button className="secondary-button" disabled={busy} onClick={()=>void run(onSave)}>Save current version</button><label>Copy name<input aria-label="Copy project name" value={name} onChange={e=>setName(e.target.value)}/></label><button className="secondary-button" disabled={busy||!name.trim()} onClick={()=>void run(async()=>{const copy={...structuredClone(current),id:uid('project'),name:name.trim()};await saveLibraryProject(copy,'Created copy');await onOpen(copy)})}>Save a copy</button></div>
  <label className="field"><span>Project folder</span><select aria-label="Project folder" value={folder} onChange={e=>setFolder(e.target.value)}><option value="*">All projects</option><option value="">Unfiled</option>{folders.map(f=><option key={f} value={f}>{f}</option>)}</select></label>
  {error&&<p className="form-error" role="alert">{error}</p>}{loading&&<p>Loading saved projects…</p>}{!loading&&!projects.length&&!error&&<p>No saved projects yet. Save the current project to start.</p>}
  <details><summary>Portable project archive</summary>
    {projects.map(p=><label key={p.id}><input type="checkbox" checked={selectedProjects.includes(p.id)} onChange={e=>setSelectedProjects(ids=>e.target.checked?[...ids,p.id]:ids.filter(id=>id!==p.id))}/>{p.name}</label>)}
    <button disabled={busy||!selectedProjects.length} onClick={()=>void run(async()=>download('wisim-library.json',JSON.stringify(await exportLibraryArchive(selectedProjects))))}>Download selected projects and versions</button>
    <label>Import library archive<input type="file" accept=".json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';setArchive(null);if(file)void run(async()=>setArchive(validateArchive(JSON.parse(await file.text()))))}}/></label>
    {archive&&<section><h4>Restore preview</h4><ul>{archive.projects.map(p=><li key={p.id}>{p.project.name} · {archive.versions.filter(v=>v.projectId===p.id).length} versions · {projects.some(local=>local.id===p.id)?'Restore as a separate copy':'Add to library'}</li>)}</ul>
    <button disabled={busy} onClick={()=>void run(async()=>{await restoreLibraryArchive(archive);setArchive(null)})}>Restore archive</button><button disabled={busy} onClick={()=>setArchive(null)}>Cancel</button></section>}
  </details>
  <div className="saved-projects">{projects.filter(p=>folder==='*'||(p.folder??'')===folder).map(p=><article key={p.id} aria-label={`Saved project ${p.name}`}>
   <strong>{p.name}</strong>{p.training&&<span className="training-project-tag">Training project</span>}<small>{p.devices} devices / {p.wires} conductors / {when(p.updatedAt)}{p.id===current.id?' / Current project':''}</small>
   <label className="field"><span>Folder (use / for subfolders)</span><input key={p.folder??''} aria-label={`Folder for ${p.name}`} defaultValue={p.folder??''} placeholder="Unfiled" disabled={busy} onBlur={e=>{const next=e.target.value.trim();if(next!==(p.folder??''))void run(()=>moveLibraryProject(p.id,next))}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/></label>
   <div><button disabled={busy} onClick={()=>void run(async()=>onOpen(await loadLibraryProject(p.id)))} aria-label={`Open saved project ${p.name}`}>Open</button><button disabled={busy} onClick={()=>void history(p.id)} aria-label={`Previous versions of ${p.name}`}>Previous versions</button><button disabled={busy} onClick={()=>void run(async()=>download('wisim-project.json',JSON.stringify(await loadLibraryProject(p.id),null,2)))} aria-label={`Download saved project ${p.name}`}>Download JSON</button><button disabled={busy} onClick={()=>setDeleting(p.id)} aria-label={`Delete saved project ${p.name}`}>Delete</button></div>
   {deleting===p.id&&<div role="alert"><p>Delete {p.name} and all its saved versions?</p><button disabled={busy} onClick={()=>void remove(p.id)}>Confirm delete</button><button onClick={()=>setDeleting(null)}>Cancel</button></div>}
  </article>)}</div>
  {versionProject&&<section className="project-versions" aria-label="Previous project versions"><h4>Previous versions · {projects.find(p=>p.id===versionProject)?.name}</h4><p>Restoring first saves a checkpoint of your current work. Simulation restarts from the restored settings.</p>{!versions.length&&<p>No saved versions yet. Use Save project to create one.</p>}{versions.length>1&&<VersionComparison key={versions.map(v=>v.id).join()} versions={versions}/>} {versions.map((v,i)=><div key={v.id}><span>{v.label} / {when(v.savedAt)}</span><button disabled={busy} aria-label={`Restore saved version ${i+1}`} onClick={()=>void run(async()=>onOpen(await loadProjectVersion(v.id)))}>Restore</button></div>)}</section>}
 </section>
}

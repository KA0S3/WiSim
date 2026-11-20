import {validateProject,type Project} from './model'

export const WORKING_PROJECT_KEY='wisim-workbench-v4'
export const WORKING_PROJECT_TIME_KEY='wisim-workbench-v4-saved-at'
export type SavedProject={id:string;name:string;createdAt:number;updatedAt:number;devices:number;wires:number;folder?:string;training?:boolean;project:Project}
export type ProjectVersion={id:string;projectId:string;savedAt:number;label:string;project:Project}
let opening:Promise<IDBDatabase>|undefined
function database():Promise<IDBDatabase>{
 if(opening)return opening
 opening=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('wisim-project-library',1)
  request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('projects',{keyPath:'id'});const versions=db.createObjectStore('versions',{keyPath:'id'});versions.createIndex('projectId','projectId')}
  request.onerror=()=>reject(request.error??new Error('Could not open the project library.'))
  request.onblocked=()=>reject(new Error('Another WiSim tab is blocking the project library. Close it and retry.'))
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=undefined};resolve(db)}
 }).catch(error=>{opening=undefined;throw error})
 return opening
}
const valid=(project:unknown):Project=>{if(!validateProject(project))throw new Error('This saved project is invalid. Import a valid backup instead.');return project}
export async function saveLibraryProject(project:Project,label?:string):Promise<void>{
 const copy=structuredClone(valid(project)),db=await database(),now=Date.now()
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['projects','versions'],'readwrite'),projects=tx.objectStore('projects'),versions=tx.objectStore('versions')
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('Project save was interrupted.'));tx.onerror=()=>{}
  const previous=projects.get(copy.id)
  previous.onsuccess=()=>projects.put({id:copy.id,name:copy.name,createdAt:previous.result?.createdAt??now,folder:previous.result?.folder,updatedAt:now,devices:copy.devices.length,wires:copy.wires.length,project:copy} satisfies SavedProject)
  if(label){
   const id=crypto.randomUUID();versions.put({id,projectId:copy.id,savedAt:now,label,project:copy} satisfies ProjectVersion)
   const request=versions.index('projectId').getAll(copy.id)
   request.onsuccess=()=>{const sorted=(request.result as ProjectVersion[]).sort((a,b)=>b.savedAt-a.savedAt||(a.id===id?-1:b.id===id?1:a.id.localeCompare(b.id)));for(const old of sorted.slice(20))versions.delete(old.id)}
  }
 })
}
async function read<T>(store:string,key?:string,index?:string):Promise<T>{
 const db=await database()
 return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),source=index?tx.objectStore(store).index(index):tx.objectStore(store),request=key===undefined?source.getAll():index?source.getAll(key):source.get(key);let value:T;request.onsuccess=()=>{value=request.result};tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error??new Error('Could not read saved projects.'))})
}
export async function listLibraryProjects():Promise<Omit<SavedProject,'project'>[]>{
 const records=await read<SavedProject[]>('projects')
 return records.filter(r=>r&&validateProject(r.project)).map(({project,...summary})=>({...summary,training:!!project.learn})).sort((a,b)=>b.updatedAt-a.updatedAt)
}
export async function loadLibraryProject(id:string):Promise<Project>{const record=await read<SavedProject|undefined>('projects',id);if(!record)throw new Error('This project was not found.');return valid(record.project)}
export async function findLibraryProject(id:string):Promise<SavedProject|undefined>{const record=await read<SavedProject|undefined>('projects',id);if(record)valid(record.project);return record}
export async function listProjectVersions(projectId:string):Promise<Omit<ProjectVersion,'project'>[]>{return (await read<ProjectVersion[]>('versions',projectId,'projectId')).filter(v=>v&&validateProject(v.project)).sort((a,b)=>b.savedAt-a.savedAt).map(({project,...summary})=>summary)}
export async function loadProjectVersion(id:string):Promise<Project>{const record=await read<ProjectVersion|undefined>('versions',id);if(!record)throw new Error('This saved version was not found.');return valid(record.project)}

export async function moveLibraryProject(id:string,folder:string):Promise<void>{
 const db=await database()
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects'),request=store.get(id)
  request.onsuccess=()=>{if(request.result)store.put({...request.result,folder:folder.trim()||undefined})}
  tx.oncomplete=()=>resolve()
  tx.onabort=()=>reject(tx.error??new Error('Could not move the project.'))
 })
}

export async function deleteLibraryProject(id:string):Promise<void>{
 const db=await database()
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['projects','versions'],'readwrite')
  tx.objectStore('projects').delete(id)
  const versions=tx.objectStore('versions'),request=versions.index('projectId').getAllKeys(id)
  request.onsuccess=()=>{for(const key of request.result)versions.delete(key)}
  tx.oncomplete=()=>resolve()
  tx.onabort=()=>reject(tx.error??new Error('Could not delete the project.'))
 })
}

export type LibraryArchive = {
  format: 'wisim-library-v1'
  projects: SavedProject[]
  versions: ProjectVersion[]
}

export function validateArchive(value: unknown): LibraryArchive {
  const archive = value as LibraryArchive
  if (archive?.format !== 'wisim-library-v1' || !Array.isArray(archive.projects) || !archive.projects.length || !Array.isArray(archive.versions)) throw Error('Choose a WiSim library archive.')
  const ids = new Set<string>()
  for (const item of archive.projects) {
    if (!item || !validateProject(item.project) || item.id !== item.project.id || ids.has(item.id) ||
        !Number.isFinite(item.createdAt) || !Number.isFinite(item.updatedAt) || (item.folder != null && typeof item.folder !== 'string')) throw Error('Invalid project in archive.')
    ids.add(item.id)
  }
  const versionIds = new Set<string>()
  const counts = new Map<string, number>()
  for (const v of archive.versions) {
    if (!v || typeof v.id !== 'string' || versionIds.has(v.id) || !ids.has(v.projectId) || !validateProject(v.project) || v.project.id !== v.projectId ||
        !Number.isFinite(v.savedAt) || typeof v.label !== 'string') throw Error('Invalid version in archive.')
    versionIds.add(v.id)
    counts.set(v.projectId, (counts.get(v.projectId) ?? 0) + 1)
    if (counts.get(v.projectId)! > 20) throw Error('A project exceeds the retained version limit.')
  }
  return archive
}

export async function exportLibraryArchive(selected: string[]): Promise<LibraryArchive> {
  const db = await database()
  const wanted = new Set(selected)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects', 'versions'], 'readonly')
    const projects = tx.objectStore('projects').getAll()
    const versions = tx.objectStore('versions').getAll()
    tx.oncomplete = () => {
      const records = (projects.result as SavedProject[]).filter(p => wanted.has(p.id))
      if (records.length !== wanted.size) { reject(Error('A selected project was removed. Refresh the library.')); return }
      resolve({format: 'wisim-library-v1', projects: records, versions: (versions.result as ProjectVersion[]).filter(v => wanted.has(v.projectId))})
    }
    tx.onabort = () => reject(tx.error ?? Error('Archive export interrupted.'))
  })
}

export async function restoreLibraryArchive(input: LibraryArchive): Promise<void> {
  const archive = validateArchive(input)
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects', 'versions'], 'readwrite')
    const store = tx.objectStore('projects')
    for (const item of archive.projects) {
      const lookup = store.getKey(item.id)
      lookup.onsuccess = () => {
        const conflict = lookup.result !== undefined
        const id = conflict ? crypto.randomUUID() : item.id
        const project = {...item.project, id, name: item.project.name + (conflict ? ' (restored copy)' : '')}
        store.add({...item, id, project, name: project.name, devices: project.devices.length, wires: project.wires.length})
        for (const version of archive.versions.filter(v => v.projectId === item.id)) {
          tx.objectStore('versions').add({...version, id: crypto.randomUUID(), projectId: id, project: {...version.project, id}})
        }
      }
    }
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? Error('Archive restore interrupted.'))
  })
}

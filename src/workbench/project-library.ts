import {validateProject,type Project} from './model'

export const WORKING_PROJECT_KEY='wisim-workbench-v4'
export const WORKING_PROJECT_TIME_KEY='wisim-workbench-v4-saved-at'
export type SavedProject={id:string;name:string;createdAt:number;updatedAt:number;devices:number;wires:number;project:Project}
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
  previous.onsuccess=()=>projects.put({id:copy.id,name:copy.name,createdAt:previous.result?.createdAt??now,updatedAt:now,devices:copy.devices.length,wires:copy.wires.length,project:copy} satisfies SavedProject)
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
 return records.filter(r=>r&&validateProject(r.project)).map(({project,...summary})=>summary).sort((a,b)=>b.updatedAt-a.updatedAt)
}
export async function loadLibraryProject(id:string):Promise<Project>{const record=await read<SavedProject|undefined>('projects',id);if(!record)throw new Error('This project was not found.');return valid(record.project)}
export async function findLibraryProject(id:string):Promise<SavedProject|undefined>{const record=await read<SavedProject|undefined>('projects',id);if(record)valid(record.project);return record}
export async function listProjectVersions(projectId:string):Promise<Omit<ProjectVersion,'project'>[]>{return (await read<ProjectVersion[]>('versions',projectId,'projectId')).filter(v=>v&&validateProject(v.project)).sort((a,b)=>b.savedAt-a.savedAt).map(({project,...summary})=>summary)}
export async function loadProjectVersion(id:string):Promise<Project>{const record=await read<ProjectVersion|undefined>('versions',id);if(!record)throw new Error('This saved version was not found.');return valid(record.project)}

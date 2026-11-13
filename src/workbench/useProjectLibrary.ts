import {useCallback,useEffect,useRef,useState} from 'react'
import type {Project} from './model'
import {findLibraryProject,saveLibraryProject,WORKING_PROJECT_KEY,WORKING_PROJECT_TIME_KEY} from './project-library'

export function useProjectLibrary(project:Project,notice:(s:string)=>void,onRecover:(p:Project)=>void){
 const [saved,setSaved]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),latest=useRef(project)
 const [ready,setReady]=useState(false)
 latest.current=project
 useEffect(()=>{
  let live=true;const initial=latest.current
  findLibraryProject(initial.id).then(async record=>{
   if(!live||!record)return
   let time=0;try{time=Number(localStorage.getItem(WORKING_PROJECT_TIME_KEY))||0}catch{}
   if(record.updatedAt>time&&JSON.stringify(record.project)!==JSON.stringify(initial)){
    if(latest.current===initial)onRecover(record.project)
    else await saveLibraryProject(record.project,'Before startup recovery')
   }
  }).catch(e=>{if(live)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(live)setReady(true)})
  return()=>{live=false}
 },[onRecover])
 const persist=useCallback(async(p:Project,label?:string)=>{
  let cacheError=false
  try{localStorage.setItem(WORKING_PROJECT_KEY,JSON.stringify(p));localStorage.setItem(WORKING_PROJECT_TIME_KEY,String(Date.now()))}catch{cacheError=true}
  try{await saveLibraryProject(p,label)}catch(e){throw new Error(`${e instanceof Error?e.message:'Project library unavailable.'} ${cacheError?'Download a JSON backup now.':'Only the last working copy was saved; download a JSON backup before closing.'}`)}
  return cacheError?'The project library saved your work, but the startup cache is full. Reopen it from Projects after reload and download a backup.':''
 },[])
 useEffect(()=>{
  if(!ready)return
  let current=true;setSaved(false)
  const timer=setTimeout(()=>{persist(project).then(message=>{if(current){setSaved(true);setError(message);setRevision(v=>v+1)}}).catch(e=>{if(current)setError(e.message)})},400)
  return()=>{current=false;clearTimeout(timer)}
 },[project,persist,ready])
 const saveNow=useCallback(async()=>{
  const p=latest.current;setSaved(false)
  try{const message=await persist(p,'Saved version');setError(message);setRevision(v=>v+1);if(latest.current===p)setSaved(true);notice('Project and saved version stored in this browser.');return true}catch(e){setError(e instanceof Error?e.message:String(e));return false}
 },[persist,notice])
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void saveNow()}}
  const cache=()=>{try{localStorage.setItem(WORKING_PROJECT_KEY,JSON.stringify(latest.current));localStorage.setItem(WORKING_PROJECT_TIME_KEY,String(Date.now()))}catch{}}
  window.addEventListener('keydown',key);window.addEventListener('pagehide',cache)
  return()=>{window.removeEventListener('keydown',key);window.removeEventListener('pagehide',cache)}
 },[saveNow])
 return {saved,error,revision,saveNow}
}

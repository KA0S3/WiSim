import {useEffect,useRef,useState} from 'react'
import type {Project} from './model'
import {SimulationRunner,type RunnerView} from './simulation-runner'

export function useSimulation(project:Project,revision:number){
 const [running,setRunning]=useState(true),[view,setView]=useState<RunnerView>({frame:null,error:'',status:'Starting calculation engine',recovering:false,slow:false,time:0,running:true,stepSeconds:.1}),runner=useRef<SimulationRunner|null>(null),latest=useRef({project,revision,running})
 latest.current={project,revision,running}
 useEffect(()=>{
  const current=latest.current,r=new SimulationRunner(current.project,current.revision,current.running,()=>new Worker(new URL('./simulation.worker.ts',import.meta.url),{type:'module'}),state=>{setView(state);setRunning(state.running)})
  runner.current=r;const timer=setInterval(()=>r.tick(),180)
  return()=>{clearInterval(timer);r.dispose();if(runner.current===r)runner.current=null}
 },[])
 useEffect(()=>{runner.current?.update(project,revision,running)},[project,revision,running])
 const visibleFrame=project.devices.length&&view.frame?.revision===revision?view.frame:null
 return {frame:visibleFrame,running,setRunning,error:view.error,ready:!!visibleFrame,status:view.status,recovering:view.recovering,slow:view.slow,time:project.devices.length?view.time:0,stepSeconds:view.stepSeconds,reset:()=>runner.current?.reset(),retry:()=>runner.current?.retry(),cancel:()=>runner.current?.cancel(),step:()=>runner.current?.step()}
}

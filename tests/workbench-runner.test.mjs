import test from 'node:test'
import assert from 'node:assert/strict'
import {SimulationRunner} from '../src/workbench/simulation-runner.ts'
import {blankProject,makeDevice,emptyState} from '../src/workbench/model.ts'

function setup(){
 const p=blankProject();p.devices=[makeDevice('battery',0,0)];const workers=[],views=[];let now=0,id=0;const timers=new Map()
 const clock={set:(fn,ms)=>{const key=++id;timers.set(key,{fn,at:now+ms});return key},clear:key=>timers.delete(key)}
 const advance=ms=>{now+=ms;for(const [key,t]of [...timers])if(t.at<=now){timers.delete(key);t.fn()}}
 const factory=()=>{const w={onmessage:null,onerror:null,dead:false,posts:[],postMessage(data){this.posts.push(data)},terminate(){this.dead=true}};workers.push(w);return w}
 const r=new SimulationRunner(p,0,true,factory,v=>views.push(v),{clock})
 const send=(w,data)=>w.onmessage({data:{requestId:w.posts.at(-1).requestId,...data}})
 const success=(w,time=.1,revision=0)=>{const state={...emptyState(),time,soc:{battery:71},capacitors:{test:5}};send(w,{type:'frame',frame:{time,revision},state});return state}
 return {p,r,workers,views,advance,send,success,last:()=>views.at(-1)}
}
test('slow startup and long calculations do not terminate at 12 seconds or any notice threshold',()=>{
 const s=setup();s.r.tick();s.advance(12001);assert.equal(s.workers[0].dead,false)
 assert.equal(s.last().slow,true);assert.equal(s.last().error,'')
 s.send(s.workers[0],{type:'phase',phase:'solving'});s.advance(120001);assert.equal(s.workers[0].dead,false);assert.equal(s.last().error,'')
 s.success(s.workers[0],.1);assert.equal(s.last().slow,false);assert.equal(s.last().frame.time,.1);s.r.dispose()
})
test('a failed solve, rather than elapsed wall time, triggers bounded automatic recovery',()=>{
 const s=setup();s.r.tick();s.send(s.workers[0],{type:'error',revision:0,error:'No convergence'})
 assert.equal(s.workers[0].dead,true);assert.equal(s.last().recovering,true);assert.equal(s.last().error,'');assert.equal(s.last().stepSeconds,.04)
 s.r.tick();assert.equal(s.workers.length,2);assert.equal(s.workers[1].posts[0].seconds,.04)
 s.success(s.workers[1],.04);assert.equal(s.last().recovering,false);s.r.dispose()
})
test('worker failure recovery restores the last committed time, charge and reactive state',()=>{
 const s=setup();s.r.tick();const checkpoint=s.success(s.workers[0],12.3);s.r.tick();s.workers[0].onerror({message:'Worker crashed'});s.r.tick()
 assert.deepEqual(s.workers[1].posts[0].checkpoint,checkpoint);assert.equal(s.last().time,12.3);assert.equal(s.last().frame,null)
 s.success(s.workers[1],12.34);assert.equal(s.last().time,12.34);s.r.dispose()
})
test('editing a busy or failed circuit replaces dead workers without requiring a manual reset',()=>{
 const s=setup();s.r.tick();const old=s.workers[0];s.r.update(s.p,1,true);assert.equal(old.dead,true);s.r.tick();assert.equal(s.workers[1].posts[0].revision,1)
 s.send(old,{type:'frame',frame:{revision:0,time:999}});assert.notEqual(s.last()?.frame?.time,999)
 for(let i=0;i<3;i++){const w=s.workers.at(-1);s.send(w,{type:'error',revision:1,error:'No convergence'});s.r.tick()}
 assert.ok(s.last().error);const count=s.workers.length;s.r.tick();assert.equal(s.workers.length,count)
 s.r.update(s.p,2,false);s.r.tick();assert.equal(s.workers.length,count+1);assert.equal(s.workers.at(-1).posts[0].revision,2);s.success(s.workers.at(-1),.1,2);assert.equal(s.last().error,'');s.r.dispose()
})
test('only an explicit reset discards stored state; retry and edits retain it',()=>{
 const s=setup();s.r.tick();s.success(s.workers[0],4);s.r.retry();s.r.tick();assert.equal(s.workers[1].posts[0].checkpoint.time,4)
 s.success(s.workers[1],4.1);s.r.reset();s.r.tick();assert.equal(s.workers[2].posts[0].checkpoint,undefined);assert.equal(s.last().time,0);s.r.dispose()
})
test('changing project or initial charge prevents restoring another run’s checkpoint',()=>{
 const s=setup();s.r.tick();s.success(s.workers[0],4);s.r.update({...s.p,initialSoc:35},1,true);s.r.tick();assert.equal(s.workers[1].posts[0].checkpoint,undefined)
 s.success(s.workers[1],.1,1);s.r.update({...s.p,id:'another-project'},2,true);s.r.tick();assert.equal(s.workers[2].posts[0].checkpoint,undefined);s.r.dispose()
})
test('adaptive windows never shorten an ordinary AC reading below one full source cycle',()=>{
 const s=setup();const g=makeDevice('grid',300,0);g.spec.frequency=20;s.p.devices.push(g);s.r.tick()
 s.send(s.workers[0],{type:'error',revision:0,error:'retry'});s.r.tick();assert.equal(s.workers[1].posts[0].seconds,.05)
 s.send(s.workers[1],{type:'error',revision:0,error:'retry'});s.r.tick();assert.equal(s.workers[2].posts[0].seconds,.05);s.r.dispose()
})

test('clearing trip latches preserves time, charge and reactive storage in the next worker',()=>{
 const s=setup();s.r.tick();const checkpoint=s.success(s.workers[0],12.3)
 checkpoint.trips=['protection'];checkpoint.tripCauses={protection:'Overload'};checkpoint.overloadSeconds={protection:3}
 s.r.clearTrips();s.r.tick()
 const restored=s.workers.at(-1).posts[0].checkpoint
 assert.equal(restored.time,12.3);assert.deepEqual(restored.soc,checkpoint.soc);assert.deepEqual(restored.capacitors,checkpoint.capacitors)
 assert.deepEqual(restored.trips,[]);assert.deepEqual(restored.overloadSeconds,{});assert.deepEqual(restored.tripCauses,{})
 s.r.dispose()
})

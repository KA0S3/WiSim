import type {Project} from './model'

/** Assign once and keep counters in the project so deleting an item doesn't renumber survivors. */
export function ensureReferences(project:Project):Project {
 const next={device:1,wire:1,structure:1,...project.nextReferences}
 const assign=<T extends {reference?:string}>(items:T[],kind:keyof typeof next,prefix:string):T[]=>{
  const used=new Set(items.flatMap(item=>item.reference?[item.reference]:[]))
  for(const ref of used){const n=Number(ref.slice(1));if(Number.isSafeInteger(n))next[kind]=Math.max(next[kind],n+1)}
  return items.map(item=>{if(item.reference)return item;while(used.has(prefix+next[kind]))next[kind]++;const reference=prefix+next[kind]++;used.add(reference);return {...item,reference}})
 }
 const devices=assign(project.devices,'device','D'),wires=assign(project.wires,'wire','W'),structures=project.structures?assign(project.structures,'structure','S'):undefined
 return {...project,devices,wires,...(structures?{structures}:{}),nextReferences:next}
}

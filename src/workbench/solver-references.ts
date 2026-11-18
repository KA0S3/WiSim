/** Fix common-mode voltage once per stamped electrical island. Control inputs
 * in behavioral expressions do not make a galvanic connection. */
export function solverReferences(lines:string[],preferredNodes:string[],previous:Record<string,number>){
  const parent=new Map<string,string>()
  const root=(node:string):string=>{
    const current=parent.get(node)
    if(current===undefined){parent.set(node,node);return node}
    if(current===node)return node
    const result=root(current);parent.set(node,result);return result
  }
  for(const line of lines){
    // Terminal bleeders must not join otherwise isolated circuits through ground.
    if(!/^[RVBICLD]/i.test(line)||line.startsWith('Rref_'))continue
    const [,from,to]=line.trim().split(/\s+/,3)
    if(from===undefined||to===undefined)continue
    const a=root(from),b=root(to)
    if(a!==b)parent.set(a,b)
  }
  const islands=new Map<string,string[]>()
  for(const node of parent.keys()){
    const island=root(node)
    let nodes=islands.get(island)
    if(!nodes){nodes=[];islands.set(island,nodes)}
    nodes.push(node)
  }
  const choices=new Map<string,string>()
  for(const node of preferredNodes)if(parent.has(node)){
    const island=root(node)
    if(!choices.has(island))choices.set(island,node)
  }
  const references:string[]=[],offsets=new Map<string,number>()
  for(const [island,nodes] of islands){
    const grounded=nodes.includes('0'),reference=grounded?'0':choices.get(island)??nodes[0]
    const offset=grounded?0:previous[reference]??0
    if(!grounded)references.push(`Vreference_${references.length} ${reference} 0 0`)
    for(const node of nodes)offsets.set(node,offset)
  }
  return {references,offsets}
}

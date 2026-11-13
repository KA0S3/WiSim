import test from 'node:test'
import assert from 'node:assert/strict'
import { diagramRoutes } from '../src/workbench/drawing.ts'
import { defaultRequirements,designSystem,solarProject,threePhaseProject } from '../src/workbench/templates.ts'
import { findCollinearOverlaps } from '../src/routing.ts'

test('default drawings route around equipment and separate unrelated conductor lanes',()=>{
  for(const p of [designSystem(defaultRequirements),designSystem({...defaultRequirements,dailyKwh:40}),solarProject(),threePhaseProject()]){
    const routes=diagramRoutes(p)
    assert.ok(routes.every(r=>!r.blocked))
    for(let i=0;i<routes.length;i++)for(let j=0;j<i;j++){
      const a=routes[i],b=routes[j],ends=w=>[`${w.from}:${w.fromPort}`,`${w.to}:${w.toPort}`]
      if(ends(a.wire).some(t=>ends(b.wire).includes(t)))continue
      assert.equal(findCollinearOverlaps(a.segments,b.segments).length,0,`${p.name}: overlapping ${i}/${j}`)
    }
  }
})

// Narrow, reproducible patch for the pinned EEcircuit 1.9.0 ESM bridge.
// The upstream catch logs raw-output errors but never settles runSim().
import {readFile,writeFile} from 'node:fs/promises'
const root=new URL('../node_modules/eecircuit-engine/',import.meta.url)
const metadata=JSON.parse(await readFile(new URL('package.json',root),'utf8'))
if(metadata.version!=='1.9.0')throw Error('Review the WiSim solver bridge patch before changing EEcircuit version.')
const target=new URL('dist/eecircuit-engine.mjs',root),marker='// WiSim: settle failed solver promises v1'
let source=await readFile(target,'utf8')
if(!source.includes(marker)){
 const replacements=[
  ['this.log_debug(e);\n\t\t\t\t\t}',`this.runPromiseReject?.(new Error(["The solver produced no readable output.", ...this.getError().slice(-8), String(e)].join("\\n")));
                        this.runPromiseResolve = null; this.runPromiseReject = null;
                        this.log_debug(e);
                    }`],
  ['this.startPromise = new Promise((e) => {\n\t\tthis.initPromiseResolve = e;\n\t}), this.startInternal())',`this.startPromise = new Promise((e, reject) => {
        this.initPromiseResolve = e; this.initPromiseReject = reject;
    }), this.startInternal().catch(error => { this.initPromiseReject?.(error); this.initPromiseReject = null; }))`],
  ['let e = new Promise((e) => {\n\t\t\tthis.runPromiseResolve = e;\n\t\t});',`let e = new Promise((e, reject) => {
            this.runPromiseResolve = e; this.runPromiseReject = reject;
        });
        // Failed writes must not reuse the previous circuit's waveform file.
        try { this.spiceModule?.FS?.unlink("/out.raw"); } catch { /* no previous output */ }`],
 ]
 for(const [from,to]of replacements){
  if(source.split(from).length!==2)throw Error('Pinned solver bridge changed; patch refused instead of guessing.')
  source=source.replace(from,to)
 }
 await writeFile(target,source+'\n'+marker+'\n')
 console.log('Patched EEcircuit: failed startup/output now reject; stale output is removed before each solve.')
}

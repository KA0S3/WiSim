import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { zipSync } from 'fflate'

for(const [directory,archive]of[['eecircuit-engine','eecircuit-engine-source.zip'],['ngspice','ngspice-45.2-source.zip']]){
  const files={}
  async function visit(relative=''){
    for(const entry of await readdir(path.join('vendor',directory,relative),{withFileTypes:true})){
      if(entry.name==='.git')continue
      const name=path.posix.join(relative,entry.name)
      if(entry.isDirectory())await visit(name)
      else if(entry.isFile())files[`${directory}/${name}`]=new Uint8Array(await readFile(path.join('vendor',directory,name)))
    }
  }
  await visit();const zip=zipSync(files,{level:6});await writeFile(path.join('vendor',archive),zip);console.log(`${archive}: ${Object.keys(files).length} files, ${(zip.length/1024/1024).toFixed(1)} MB`)
}

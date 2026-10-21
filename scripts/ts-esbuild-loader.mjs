import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { transform } from 'esbuild'

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:') && !path.extname(specifier)) {
    const candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`)
    try {
      await access(candidate)
      return { url: pathToFileURL(candidate).href, shortCircuit: true }
    } catch {
      // Leave non-TypeScript and missing imports to Node's normal resolver.
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && /\.tsx?$/.test(new URL(url).pathname)) {
    const source = await readFile(fileURLToPath(url), 'utf8')
    const loader = url.endsWith('.tsx') ? 'tsx' : 'ts'
    const result = await transform(source, { loader, format: 'esm', target: 'node21', jsx: 'automatic' })
    return { format: 'module', shortCircuit: true, source: result.code }
  }
  return nextLoad(url, context)
}

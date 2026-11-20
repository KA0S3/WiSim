import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Keep the solver bytes intact and let browsers fetch and compile WASM separately. */
function separateSolverWasm(): Plugin {
  return {
    name: 'wisim-solver-wasm-assets',
    apply: 'build',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/eecircuit-engine/dist/eecircuit-engine.mjs')) return
      const urls = [...code.matchAll(/"data:application\/wasm;base64,([^"]+)"/g)]
      if (urls.length !== 2) throw Error('Expected two embedded WASM assets in the pinned solver.')
      for (const [index, [url, encoded]] of urls.entries()) {
        const source = Buffer.from(encoded, 'base64')
        if (source.subarray(0, 4).toString('hex') !== '0061736d') throw Error('Invalid embedded solver WASM.')
        const asset = this.emitFile({type: 'asset', name: index === 0 ? 'spice-browser.wasm' : 'spice-node.wasm', source})
        code = code.replace(url, `import.meta.ROLLUP_FILE_URL_${asset}`)
      }
      return {code, map: null}
    }
  }
}

export default defineConfig({
  plugins: [react()],
  // Keep the patched solver bridge out of Vite's persistent dependency cache.
  // Otherwise a running development preview can retain an older worker bridge.
  optimizeDeps: { exclude: ['eecircuit-engine'] },
  server: { host: '127.0.0.1', watch: { ignored: ['**/.cache/**', '**/vendor/**', '**/artifacts/**'] } },
  worker: { format: 'es', plugins: () => [separateSolverWasm()] },
})

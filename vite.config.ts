import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Keep the patched solver bridge out of Vite's persistent dependency cache.
  // Otherwise a running development preview can retain an older worker bridge.
  optimizeDeps: { exclude: ['eecircuit-engine'] },
  server: { host: '127.0.0.1', watch: { ignored: ['**/.cache/**', '**/vendor/**', '**/artifacts/**'] } },
  worker: { format: 'es' },
})

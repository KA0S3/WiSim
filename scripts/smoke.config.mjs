import { defineConfig } from '@playwright/test'

const baseURL = process.env.WISIM_URL ?? 'http://127.0.0.1:4199'

export default defineConfig({
  testDir: './smoke',
  workers: 1,
  timeout: 90000,
  outputDir: '../artifacts/smoke',
  use: {actionTimeout:12000,baseURL, viewport: {width:1600,height:1000}},
  projects: [
    {name:'Chromium',use:{browserName:'chromium',channel:process.platform==='win32'?'msedge':undefined}},
    {name:'Firefox',use:{browserName:'firefox'}}
  ],
  webServer: process.env.WISIM_URL ? undefined : {
    command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4199 --strictPort',
    cwd: process.cwd(),
    url:'http://127.0.0.1:4199',
    reuseExistingServer:false
  }
})

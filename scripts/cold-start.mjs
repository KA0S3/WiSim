import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

const url = 'http://127.0.0.1:4196/'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4196', '--strictPort'], { windowsHide: true, stdio: 'ignore' })
let browser
try {
  let ready = false
  for (let i = 0; i < 60 && !ready; i++) {
    if (server.exitCode !== null) throw Error('Startup benchmark preview exited.')
    ready = await fetch(url).then(r => r.ok).catch(() => false)
    if (!ready) await new Promise(resolve => setTimeout(resolve, 200))
  }
  if (!ready) throw Error('Startup benchmark preview timed out.')
  browser = await chromium.launch({ channel: 'msedge' })
  const page = await browser.newPage()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 100, downloadThroughput: 5_000_000 / 8, uploadThroughput: 1_000_000 / 8
  })
  await page.goto(url, { waitUntil: 'commit' })
  await page.waitForFunction(() => /\d+(?:[.,]\d+)?\s*k?W\b/.test(document.querySelector('.power-metrics')?.textContent ?? ''), null, { timeout: 180000 })
  const timing = await page.evaluate(() => {
    const firstReadingMs = performance.now()
    const navigation = performance.getEntriesByType('navigation')[0]
    const resource = ({name, initiatorType, startTime, responseEnd, transferSize, encodedBodySize, decodedBodySize}) =>
      ({path: new URL(name).pathname, initiatorType, startTime, responseEnd, transferSize, encodedBodySize, decodedBodySize})
    return {
      firstReadingMs,
      navigation: navigation && resource(navigation),
      resources: performance.getEntriesByType('resource')
        .filter(entry => entry.responseEnd > 0 && new URL(entry.name).origin === location.origin).map(resource)
    }
  })
  const result = { browser: browser.version(), downloadMbps: 5, uploadMbps: 1, latencyMs: 100, ...timing }
  await mkdir('artifacts', { recursive: true })
  await writeFile('artifacts/cold-start.json', JSON.stringify(result, null, 2))
  console.log(result)
} finally {
  await browser?.close()
  server.kill()
}

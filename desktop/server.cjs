// Runs in an Electron utility process. No development tools or system Node needed.
const http = require('node:http')
const { createRequire } = require('node:module')
const path = require('node:path')
const fs = require('node:fs')
const { PORT, ORIGIN, authorizedRequest, isOAuthCallback } = require('./security.cjs')
const parent = process.ppid
setInterval(() => { if (process.ppid !== parent) process.exit(0) }, 1000).unref()

async function start() {
  const dir = process.env.FLOWCAST_SERVER_DIR
  process.chdir(dir)
  const config = JSON.parse(fs.readFileSync(path.join(dir, '.next/required-server-files.json'), 'utf8')).config
  // No runtime writes into the signed bundle. Next's incremental cache stays in memory.
  config.experimental.isrFlushToDisk = false
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config)
  const localRequire = createRequire(path.join(dir, 'server.js'))
  const next = localRequire('next')({ dev: false, dir, conf: config, hostname: '127.0.0.1', port: PORT })
  await next.prepare()
  const handle = next.getRequestHandler()
  const server = http.createServer(async (req, res) => {
    const callback = isOAuthCallback(req)
    if (!authorizedRequest(req, process.env.FLOWCAST_SESSION_TOKEN) && !callback) {
      res.writeHead(403).end('This service is private to FlowCast.')
      return
    }
    // Never cache authorization callbacks or allow framing of the local UI.
    res.setHeader('X-Frame-Options', 'DENY')
    if (callback) {
      res.setHeader('Cache-Control', 'no-store')
      res.on('finish', () => process.parentPort?.postMessage({ type: 'account-changed' }))
    }
    try { await handle(req, res) } catch (error) {
      console.error(error)
      if (!res.headersSent) res.writeHead(500)
      res.end('FlowCast could not complete this request.')
    }
  })
  server.on('error', (error) => { console.error(error.message); process.exit(1) })
  server.listen(PORT, '127.0.0.1', () => process.parentPort?.postMessage({ type: 'ready', origin: ORIGIN }))
}

start().catch((error) => { console.error(error); process.exit(1) })

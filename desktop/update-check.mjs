// End-to-end updater check without a window: serves a packaged DMG from a local release feed,
// updates a throwaway stand-in for the installed app, and confirms the swapped bundle is the
// new, intact release. Usage: node desktop/update-check.mjs dist/FlowCast-<version>-arm64.dmg
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

// The updater swaps the bundle once its own process has exited, so it runs in a child.
if (process.argv[2] === '--updater') {
  const [root] = process.argv.slice(3)
  const { createUpdater } = createRequire(import.meta.url)('./updater.cjs')
  const updater = createUpdater({ app: { isPackaged: true, getVersion: () => '0.0.1' },
    userData: path.join(root, 'data'), appPath: path.join(root, 'Applications/FlowCast.app') })
  try { console.log(JSON.stringify(await updater.check())); updater.installOnQuit({ relaunch: false }) }
  catch (error) { console.log(error.message); process.exitCode = 2 }
} else {
  const dmg = path.resolve(process.argv[2] ?? '')
  const version = /FlowCast-(\d+\.\d+\.\d+)-arm64\.dmg$/.exec(dmg)?.[1]
  assert.ok(version && existsSync(dmg), 'Pass the path of a packaged FlowCast-<version>-arm64.dmg')
  const root = await mkdtemp(path.join(os.tmpdir(), 'flowcast-update-check-'))
  const installed = path.join(root, 'Applications/FlowCast.app')
  await mkdir(installed, { recursive: true })
  await writeFile(path.join(installed, 'old-release'), '')
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(dmg)) hash.update(chunk)
  const sha256 = hash.digest('hex')
  const server = http.createServer((request, response) => {
    if (request.url === '/update.dmg') return createReadStream(dmg).pipe(response)
    response.end(JSON.stringify([{ tag_name: `desktop-v${version}`, draft: false, assets: [{
      name: path.basename(dmg), digest: `sha256:${request.url === '/tampered' ? '0'.repeat(64) : sha256}`,
      browser_download_url: `http://127.0.0.1:${server.address().port}/update.dmg` }] }]))
  }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const update = (feed) => new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--updater', root], { stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, FLOWCAST_UPDATE_FEED: `http://127.0.0.1:${server.address().port}${feed}` } })
    let output = ''
    child.stdout.on('data', (data) => { output += data })
    child.on('exit', (code) => resolve({ code, output: output.trim() }))
  })
  try {
    const tampered = await update('/tampered')
    assert.equal(tampered.code, 2)
    assert.match(tampered.output, /checksum/)
    assert.equal(existsSync(path.join(installed, 'old-release')), true)
    assert.deepEqual(await update('/releases'), { code: 0, output: JSON.stringify({ version }) })
    const plist = path.join(installed, 'Contents/Info.plist')
    for (let attempt = 0; attempt < 50 && !existsSync(plist); attempt++) await delay(200)
    assert.equal(execFileSync('/usr/bin/plutil', ['-extract', 'CFBundleShortVersionString', 'raw', plist]).toString().trim(), version)
    assert.equal(existsSync(path.join(installed, 'old-release')), false)
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', installed])
    await delay(500)
    assert.equal(existsSync(path.join(root, 'data/update')), false)
    console.log(`Update check passed: rejected a bad checksum, then replaced the installed app with an intact ${version}.`)
  } finally { server.close(); await rm(root, { recursive: true, force: true }) }
}

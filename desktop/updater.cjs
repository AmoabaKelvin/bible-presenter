// Self-update from the repository's GitHub releases. Squirrel (Electron's autoUpdater) rejects
// ad-hoc signatures, so this downloads the release DMG, verifies it, and swaps the app on quit.
// It never restarts on its own: a service may be live.
const { spawn, execFile } = require('node:child_process')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { Readable } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const { promisify } = require('node:util')
const run = promisify(execFile)

const FEED = process.env.FLOWCAST_UPDATE_FEED || 'https://api.github.com/repos/AmoabaKelvin/bible-presenter/releases?per_page=20'
const BUNDLE_ID = 'com.kelvinamoaba.flowcast'

function newer(a, b) {
  const [x, y] = [a, b].map((version) => version.split('.').map(Number))
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0)
  return false
}

// The newest published desktop release above `current` that ships a checksummed Apple Silicon DMG.
function pickRelease(releases, current) {
  let best = null
  for (const release of Array.isArray(releases) ? releases : []) {
    const version = /^desktop-v(\d+\.\d+\.\d+)$/.exec(release.tag_name || '')?.[1]
    if (!version || release.draft || !newer(version, best?.version ?? current)) continue
    const asset = release.assets?.find((item) => item.name === `FlowCast-${version}-arm64.dmg`)
    const sha256 = /^sha256:([a-f0-9]{64})$/.exec(asset?.digest || '')?.[1]
    if (sha256) best = { version, url: asset.browser_download_url, sha256 }
  }
  return best
}

function createUpdater({ app, userData, onState, appPath = path.resolve(process.execPath, '../../..') }) {
  const work = path.join(userData, 'update')
  const stagedApp = path.join(work, 'FlowCast.app')
  const readyFile = path.join(work, 'ready.json')
  let staged = null
  let busy = null

  // Running from the disk image or a translocated copy: there is nothing durable to replace.
  function unsupported() {
    if (!app.isPackaged || !appPath.endsWith('.app')) return 'Updates apply to the installed application only.'
    if (appPath.startsWith('/Volumes/') || appPath.includes('/AppTranslocation/')) return 'Move FlowCast to the Applications folder to receive updates.'
    try { fs.accessSync(path.dirname(appPath), fs.constants.W_OK) } catch { return 'FlowCast cannot write to the folder it is installed in.' }
    return null
  }

  async function download(release) {
    await fs.promises.rm(work, { recursive: true, force: true })
    await fs.promises.mkdir(work, { recursive: true })
    const image = path.join(work, 'update.dmg')
    const response = await fetch(release.url)
    if (!response.ok) throw new Error(`Download failed (${response.status}).`)
    const hash = createHash('sha256')
    await pipeline(Readable.fromWeb(response.body), async function* (chunks) {
      for await (const chunk of chunks) { hash.update(chunk); yield chunk }
    }, fs.createWriteStream(image))
    if (hash.digest('hex') !== release.sha256) throw new Error('The download did not match its published checksum.')
    const mount = path.join(work, 'mount')
    await run('/usr/bin/hdiutil', ['attach', '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mount, image])
    try { await run('/usr/bin/ditto', [path.join(mount, 'FlowCast.app'), stagedApp]) }
    finally { await run('/usr/bin/hdiutil', ['detach', mount, '-force']).catch(() => {}) }
    await fs.promises.rm(image, { force: true })
    await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', stagedApp])
    const plist = path.join(stagedApp, 'Contents/Info.plist')
    const read = async (key) => (await run('/usr/bin/plutil', ['-extract', key, 'raw', plist])).stdout.trim()
    if (await read('CFBundleIdentifier') !== BUNDLE_ID || await read('CFBundleShortVersionString') !== release.version) {
      throw new Error('The downloaded application is not the expected FlowCast release.')
    }
    await fs.promises.writeFile(readyFile, JSON.stringify({ version: release.version }))
  }

  // Resolves to { version } once an update is staged, null when up to date; rejects with the reason otherwise.
  function check() {
    busy ??= (async () => {
      const reason = unsupported()
      if (reason) throw new Error(reason)
      if (staged) return staged
      const response = await fetch(FEED, { headers: { Accept: 'application/vnd.github+json' } })
      if (!response.ok) throw new Error(`Could not reach the release list (${response.status}).`)
      const release = pickRelease(await response.json(), app.getVersion())
      if (!release) return null
      await download(release)
      staged = { version: release.version }
      onState?.(staged)
      return staged
    })().finally(() => { busy = null })
    return busy
  }

  function start() {
    try {
      const ready = JSON.parse(fs.readFileSync(readyFile, 'utf8'))
      if (newer(ready.version, app.getVersion()) && fs.existsSync(stagedApp)) { staged = ready; onState?.(staged) }
    } catch { /* nothing staged */ }
    // Anything else in the folder is left over from an update that has already been applied.
    if (!staged) fs.rmSync(work, { recursive: true, force: true })
    if (unsupported()) return
    const quiet = () => check().catch((error) => console.error('Update check:', error.message))
    setTimeout(quiet, 15000)
    setInterval(quiet, 6 * 60 * 60 * 1000).unref()
  }

  // Call while quitting. A detached shell waits for this process to exit, then swaps the bundle,
  // restoring the old one if the move fails.
  function installOnQuit({ relaunch }) {
    if (!staged || unsupported()) return
    const script = `
      while kill -0 "$1" 2>/dev/null; do sleep 0.2; done
      old="$4/previous.app"; rm -rf "$old"
      if mv "$2" "$old"; then
        if mv "$3" "$2"; then rm -rf "$4"; else mv "$old" "$2"; fi
      fi
      [ "$5" = 1 ] && open "$2"`
    spawn('/bin/sh', ['-c', script, 'sh', String(process.pid), appPath, stagedApp, work, relaunch ? '1' : '0'],
      { detached: true, stdio: 'ignore' }).unref()
    staged = null
  }

  return { start, check, installOnQuit, staged: () => staged }
}

module.exports = { createUpdater, pickRelease, newer }

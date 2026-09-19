const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { once } = require('node:events')
const { setTimeout: delay } = require('node:timers/promises')
const { app, screen } = require('electron')
const { ORIGIN } = require('./security.cjs')

async function waitFor(contents, expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await contents.executeJavaScript(expression)) return
    await delay(100)
  }
  console.error('Renderer state:', await contents.executeJavaScript('JSON.stringify({ url: location.href, text: document.body.innerText.slice(0,1500), slide: localStorage.getItem("bibleVerseData") })'))
  throw new Error(`Timed out: ${expression}`)
}

module.exports = async function smoke({ windows, token }) {
  assert.equal((await fetch(ORIGIN)).status, 403)
  assert.equal((await fetch(`${ORIGIN}/api/spotify/callback?state=${'a'.repeat(48)}&code=invalid`)).status, 400)
  const status = await fetch(`${ORIGIN}/api/spotify/status`, { headers: { 'X-FlowCast-Session': token } })
  assert.equal(status.status, 200)
  assert.equal((await status.json()).connected, false)
  // With desktop client IDs staged, login must hand the browser to the provider.
  const clients = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'oauth-clients.json'), 'utf8').catch(() => '{}'))
  for (const [provider, id, host] of [['spotify', clients.spotifyClientId, 'accounts.spotify.com'], ['youtube', clients.googleClientId, 'accounts.google.com']]) {
    if (!id) continue
    const login = await fetch(`${ORIGIN}/api/${provider}/login`, { headers: { 'X-FlowCast-Session': token }, redirect: 'manual' })
    const target = login.headers.get('location')
    assert.ok(target, `${provider} login gave ${login.status} without a redirect: ${(await login.text()).slice(0, 300)}`)
    assert.equal(new URL(target).hostname, host)
  }
  const operator = windows.operator().webContents
  operator.on('console-message', (event) => { if (event.level === 'error') console.error('Operator:', event.message) })
  await waitFor(operator, '!!window.flowcastDesktop && document.querySelectorAll("button").length > 5')
  assert.equal(await operator.executeJavaScript('typeof require'), 'undefined')
  assert.equal(await operator.executeJavaScript('typeof window.showOpenFilePicker'), 'function')
  if (process.argv.includes('--check-persistence')) assert.equal(await operator.executeJavaScript('localStorage.getItem("desktop-smoke-persistence")'), 'saved')
  await operator.executeJavaScript(`localStorage.setItem('desktop-smoke-persistence', 'saved'); localStorage.setItem('bibleVerseData', JSON.stringify({ verses: [{ kind: 'scripture', id: 'test-1', book: 'John', chapter: 3, verse: 16, text: 'Desktop presentation smoke test', reference: 'John 3:16' }], fontSize: 'extra-large', darkMode: true, version: 'KJV' }))`)
  await windows.openOutput(screen.getPrimaryDisplay().id)
  const output = windows.output().webContents
  output.on('console-message', (event) => { if (event.level === 'error') console.error('Output:', event.message) })
  await waitFor(output, 'document.body.innerText.includes("Desktop presentation smoke test")')
  await operator.executeJavaScript(`localStorage.setItem('bibleVerseData', JSON.stringify({ verses: [{ kind: 'scripture', id: 'test-2', book: 'Psalms', chapter: 23, verse: 1, text: 'Live update reached the audience', reference: 'Psalm 23:1' }], fontSize: 'extra-large', darkMode: true, version: 'KJV' }))`)
  await waitFor(output, 'document.body.innerText.includes("Live update reached the audience")')
  assert.equal(await output.executeJavaScript('window.flowcastDesktop.setFullscreen(true)'), true)
  assert.equal(await output.executeJavaScript('window.flowcastDesktop.getFullscreen()'), true)
  await output.executeJavaScript('window.flowcastDesktop.setFullscreen(false)')
  // Videos and uploaded folders are read through file handles. Dropping them yields the same
  // handles as the pickers, without a native dialog.
  const artifacts = path.join(app.getPath('temp'), 'flowcast-desktop-smoke')
  // Not under the profile folder: Chromium hides that from web content.
  const mediaDir = await fs.mkdtemp(path.join(app.getPath('temp'), 'flowcast-smoke-media-'))
  await fs.writeFile(path.join(mediaDir, 'clip.mp4'), 'video')
  await operator.executeJavaScript(`window.smokeDrop = new Promise((resolve) => {
    addEventListener('dragover', (event) => event.preventDefault(), true)
    addEventListener('drop', async (event) => {
      event.preventDefault(); event.stopPropagation()
      try {
        const [file, folder] = await Promise.all([...event.dataTransfer.items].map((item) => item.getAsFileSystemHandle()))
        const names = []
        for await (const entry of folder.values()) names.push(entry.name)
        resolve([(await file.getFile()).size, names.join()])
      } catch (error) { resolve(String(error)) }
    }, true)
  }); true`)
  operator.debugger.attach()
  const data = { items: [], files: [path.join(mediaDir, 'clip.mp4'), mediaDir], dragOperationsMask: 1 }
  for (const type of ['dragEnter', 'dragOver', 'drop']) await operator.debugger.sendCommand('Input.dispatchDragEvent', { type, x: 300, y: 300, data })
  operator.debugger.detach()
  assert.deepEqual(await operator.executeJavaScript('window.smokeDrop'), [5, 'clip.mp4'])
  // Exercise the real bundled Swift listener without triggering a model download.
  const endpoint = await operator.executeJavaScript('window.flowcastDesktop.connectVoice()')
  const socketResult = await operator.executeJavaScript(`new Promise((resolve, reject) => {
    const socket = new WebSocket(${JSON.stringify(endpoint.url)}, ['flowcast', ${JSON.stringify(endpoint.token)}]);
    const timer = setTimeout(() => { socket.close(); reject(new Error('Helper handshake timed out')) }, 10000);
    socket.onmessage = event => { clearTimeout(timer); socket.close(); resolve(JSON.parse(event.data).type) };
    socket.onerror = () => { clearTimeout(timer); reject(new Error('Helper handshake rejected')) };
  })`)
  assert.equal(socketResult, 'status')
  const rejected = await operator.executeJavaScript(`new Promise(resolve => {
    const socket = new WebSocket(${JSON.stringify(endpoint.url)}, ['flowcast', 'invalid-token']);
    socket.onerror = () => resolve(true); socket.onopen = () => { socket.close(); resolve(false) };
    setTimeout(() => { socket.close(); resolve(false) }, 5000);
  })`)
  assert.equal(rejected, true)
  // A spoken quote must find its verse here too: embedding model, WASM runtime, and all three indexes.
  const quote = await operator.executeJavaScript(`Promise.race([
    window.flowcastMatchQuote('The Bible says for God so loved the world that he gave his only begotten son'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Quote matching timed out')), 60000)),
  ])`)
  assert.equal(quote?.reference, 'John 3:16')
  // A few words out of a verse are found by their wording, not their meaning.
  const fragment = await operator.executeJavaScript(`window.flowcastMatchQuote('he gave gifts unto men')`)
  assert.equal(fragment?.reference, 'Ephesians 4:8')
  await fs.writeFile(path.join(artifacts, 'operator.png'), (await operator.capturePage()).toPNG())
  await fs.writeFile(path.join(artifacts, 'output.png'), (await output.capturePage()).toPNG())
  const closed = once(windows.output(), 'closed')
  windows.output().close()
  await closed
  assert.equal(windows.output(), null)
  const reloaded = once(operator, 'did-finish-load')
  operator.reload()
  await reloaded
  await waitFor(operator, '!!window.flowcastDesktop && document.querySelectorAll("button").length > 5')
  assert.equal(await operator.executeJavaScript('localStorage.getItem("desktop-smoke-persistence")'), 'saved')
  assert.equal(await operator.executeJavaScript('navigator.serviceWorker.getRegistrations().then(items => items.length)'), 0)
  console.log(`Desktop smoke passed: private server, OAuth callback rejection, renderer isolation, live projection, media file handles, fullscreen, Swift authentication, reload persistence. Screenshots: ${artifacts}`)
}

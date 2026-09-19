const { app, BrowserWindow, ipcMain, session, utilityProcess, dialog, systemPreferences, Menu, shell, safeStorage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { randomBytes } = require('node:crypto')
const { PORT, ORIGIN, sameOrigin } = require('./security.cjs')
const { createWindows } = require('./windows.cjs')
const { createVoice } = require('./voice.cjs')

app.setName('FlowCast')
const smoke = process.argv.includes('--smoke-test')
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'flowcast-desktop-smoke'))
let server
let voice
let windows
let quitting = false

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { void windows?.openOperator() })
  app.whenReady().then(start).catch((error) => {
    console.error(error)
    if (!smoke) dialog.showErrorBox('FlowCast could not start', error.message)
    app.exit(1)
  })
}

function keyForSessions(userData) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('macOS Keychain is unavailable. Unlock your login keychain and reopen FlowCast.')
  const file = path.join(userData, 'session-key')
  if (fs.existsSync(file)) return safeStorage.decryptString(fs.readFileSync(file))
  const key = randomBytes(32).toString('hex')
  fs.writeFileSync(file, safeStorage.encryptString(key), { mode: 0o600 })
  return key
}

async function start() {
  const userData = app.getPath('userData')
  fs.mkdirSync(userData, { recursive: true })
  const resources = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..')
  const serverDir = path.join(resources, 'server')
  if (!fs.existsSync(path.join(serverDir, 'server.js'))) throw new Error('Desktop files are missing. Run bun run desktop:build first.')
  const token = randomBytes(32).toString('hex')
  const desktopSession = session.fromPartition('persist:flowcast')
  // Remove only web caches, preserving IndexedDB and localStorage across releases.
  await desktopSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] })
  desktopSession.webRequest.onBeforeSendHeaders({ urls: [`${ORIGIN}/*`] }, (details, done) => {
    // Never grant a third-party frame access to the private local server.
    const owner = BrowserWindow.getAllWindows().find((win) => win.webContents.id === details.webContentsId)
    const trustedFrame = details.resourceType === 'mainFrame' || !details.frame?.url || sameOrigin(details.frame.url) || details.frame.url === 'about:blank'
    if (!owner || !trustedFrame) return done({ cancel: true })
    done({ requestHeaders: { ...details.requestHeaders, 'X-FlowCast-Session': token } })
  })
  desktopSession.setPermissionCheckHandler((contents, permission, origin, details) => {
    if (!contents || !sameOrigin(origin)) return false
    if (permission === 'fileSystem') return details.fileAccessType === 'readable' && !details.isDirectory
    if (permission === 'media') return details.mediaType !== 'video'
    return ['clipboard-sanitized-write', 'fullscreen', 'screen-wake-lock', 'persistent-storage', 'loopback-network', 'local-network-access', 'mediaKeySystem'].includes(permission)
  })
  desktopSession.setPermissionRequestHandler((contents, permission, done, details) => {
    const trusted = sameOrigin(contents.getURL()) && sameOrigin(details.requestingUrl)
    if (!trusted) return done(false)
    if (permission === 'media') {
      if (details.mediaTypes?.some((type) => type !== 'audio')) return done(false)
      void systemPreferences.askForMediaAccess('microphone').then(done).catch(() => done(false))
    } else if (permission === 'fileSystem') done(details.fileAccessType === 'readable' && !details.isDirectory)
    else done(['fullscreen', 'clipboard-sanitized-write', 'screen-wake-lock', 'persistent-storage', 'loopback-network', 'local-network-access', 'mediaKeySystem'].includes(permission))
  })
  let clients = {}
  const clientFile = path.join(resources, 'oauth-clients.json')
  if (fs.existsSync(clientFile)) clients = JSON.parse(fs.readFileSync(clientFile, 'utf8'))
  const env = {
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: process.env.HOME,
    NODE_ENV: 'production', FLOWCAST_DESKTOP_BUILD: '1', FLOWCAST_DESKTOP_RUNTIME: '1',
    FLOWCAST_SERVER_DIR: serverDir, FLOWCAST_PORT: String(PORT), FLOWCAST_SESSION_TOKEN: token,
    FLOWCAST_DESKTOP_DATA: userData, FLOWCAST_DESKTOP_KEY: keyForSessions(userData),
    FLOWCAST_SPOTIFY_CLIENT_ID: clients.spotifyClientId || '',
    FLOWCAST_GOOGLE_CLIENT_ID: clients.googleClientId || '',
    FLOWCAST_GOOGLE_CLIENT_SECRET: clients.googleDesktopClientSecret || '',
  }
  server = utilityProcess.fork(path.join(__dirname, 'server.cjs'), [], { env, stdio: 'pipe', serviceName: 'FlowCast server' })
  server.stdout.on('data', (data) => console.log(String(data).trim()))
  let errorLog = ''
  server.stderr.on('data', (data) => { errorLog = (errorLog + String(data)).slice(-2500); console.error(String(data).trim()) })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The local application server did not start within 30 seconds.')), 30000)
    server.once('exit', () => { clearTimeout(timer); reject(new Error(`The local application server stopped. ${errorLog}`)) })
    server.on('message', (message) => {
      if (message.type === 'ready') { clearTimeout(timer); resolve() }
      if (message.type === 'account-changed') windows?.broadcast('account:changed')
    })
  })
  server.on('exit', () => {
    if (!quitting && !smoke) { dialog.showErrorBox('FlowCast server stopped', 'Quit and reopen FlowCast to restart the application.'); app.quit() }
  })
  windows = createWindows({ userData, session: desktopSession, onLogin: async (provider) => {
    try {
      const response = await fetch(`${ORIGIN}/api/${provider}/login`, {
        headers: { 'X-FlowCast-Session': token }, redirect: 'manual',
      })
      const location = response.headers.get('location')
      const allowed = provider === 'spotify' ? 'accounts.spotify.com' : 'accounts.google.com'
      if (!location || new URL(location).hostname !== allowed) throw new Error('This build needs desktop OAuth credentials. See docs/desktop.md for setup.')
      await shell.openExternal(location)
    } catch (error) { await dialog.showMessageBox(windows.operator(), { type: 'error', message: 'Unable to connect account', detail: error.message }) }
  } })
  voice = createVoice({ binary: path.join(resources, 'voice/FlowCastVoice'), userData,
    onStatus: (message) => windows.broadcast('voice:status', message) })
  const trustedWindow = (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || ![windows.operator(), windows.output()].includes(win) || event.senderFrame !== event.sender.mainFrame || !sameOrigin(event.senderFrame.url)) {
      throw new Error('Untrusted desktop request.')
    }
    return win
  }
  ipcMain.handle('output:open', (event) => {
    if (trustedWindow(event) !== windows.operator()) throw new Error('Only the operator can open output.')
    return windows.openOutput()
  })
  ipcMain.handle('window:fullscreen', (event) => trustedWindow(event).isSimpleFullScreen())
  ipcMain.handle('window:set-fullscreen', (event, value) => {
    if (typeof value !== 'boolean') throw new Error('Invalid fullscreen value.')
    return windows.setFullscreen(trustedWindow(event), value)
  })
  ipcMain.handle('voice:connect', (event) => {
    if (trustedWindow(event) !== windows.operator()) throw new Error('Only the operator can use voice.')
    return voice.connect()
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' }, { role: 'editMenu' },
    { label: 'Presentation', submenu: [
      { label: 'Open output…', accelerator: 'CmdOrCtrl+Shift+P', click: () => void windows.openOutput() },
      { label: 'Close output', click: () => windows.output()?.close() },
    ] },
    { role: 'windowMenu' },
  ]))
  await windows.openOperator()
  if (smoke) {
    try { await require('./smoke.cjs')({ windows, token, session: desktopSession }); app.quit() }
    catch (error) { console.error(error); app.exit(1) }
  }
}

app.on('activate', () => { if (windows) void windows.openOperator() })
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => { quitting = true; voice?.stop(); server?.kill() })
app.on('will-quit', () => { voice?.stop(); server?.kill() })

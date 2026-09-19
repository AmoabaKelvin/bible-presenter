const { BrowserWindow, dialog, screen, powerSaveBlocker, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { ORIGIN, sameOrigin } = require('./security.cjs')

function createWindows({ userData, session, onLogin }) {
  let operator = null
  let output = null
  let outputDisplay = null
  let sleepBlock = null
  const preferenceFile = path.join(userData, 'display.json')
  let preferredDisplay
  try { preferredDisplay = JSON.parse(fs.readFileSync(preferenceFile, 'utf8')).id } catch { /* first launch */ }

  function configure(win) {
    const external = (url) => {
      if (/^https?:\/\//.test(url) && !sameOrigin(url)) void shell.openExternal(url)
    }
    const navigate = (event, url) => {
      if (sameOrigin(url)) {
        const provider = new URL(url).pathname.match(/^\/api\/(spotify|youtube)\/login$/)?.[1]
        if (provider) { event.preventDefault(); void onLogin(provider) }
        return
      }
      event.preventDefault()
      external(url)
    }
    win.webContents.on('will-navigate', navigate)
    win.webContents.on('will-redirect', navigate)
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (sameOrigin(url) && new URL(url).pathname === '/slideshow') void openOutput()
      else if (sameOrigin(url) && /\/api\/(spotify|youtube)\/login$/.test(new URL(url).pathname)) {
        void onLogin(new URL(url).pathname.split('/')[2])
      } else external(url)
      return { action: 'deny' }
    })
    win.webContents.on('will-attach-webview', (event) => event.preventDefault())
  }

  function makeWindow(options) {
    const win = new BrowserWindow({
      backgroundColor: '#0a0a0a', show: false, ...options,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'), session,
        nodeIntegration: false, contextIsolation: true, sandbox: true,
        backgroundThrottling: false,
      },
    })
    configure(win)
    return win
  }

  async function openOperator() {
    if (operator && !operator.isDestroyed()) { operator.show(); operator.focus(); return operator }
    operator = makeWindow({ width: 1440, height: 900, minWidth: 1000, minHeight: 650, title: 'FlowCast' })
    operator.on('closed', () => { operator = null; output?.close() })
    await operator.loadURL(ORIGIN)
    operator.show()
    return operator
  }

  async function openOutput(displayId) {
    if (output && !output.isDestroyed()) { output.showInactive(); operator?.focus(); return }
    const displays = screen.getAllDisplays()
    let display = displays.find((item) => item.id === displayId)
    if (!display && displays.length > 1) {
      const fallback = displays.find((item) => item.id === preferredDisplay)
        ?? displays.find((item) => item.id !== screen.getPrimaryDisplay().id)
      const { response } = await dialog.showMessageBox(operator, {
        type: 'question', title: 'Presentation display', message: 'Where should the audience view appear?',
        buttons: [...displays.map((item) => `${item.label || 'Display'} (${item.size.width} × ${item.size.height})`), 'Cancel'],
        defaultId: Math.max(0, displays.indexOf(fallback)), cancelId: displays.length,
      })
      display = displays[response]
      if (!display) return
    }
    display ??= displays[0]
    if (output && !output.isDestroyed()) return
    const external = displays.length > 1
    const bounds = external ? display.bounds : {
      x: display.workArea.x + 40, y: display.workArea.y + 40,
      width: Math.min(1280, display.workArea.width - 80), height: Math.min(720, display.workArea.height - 80),
    }
    outputDisplay = display.id
    preferredDisplay = display.id
    fs.writeFileSync(preferenceFile, JSON.stringify({ id: display.id }))
    const win = makeWindow({ ...bounds, frame: !external, title: 'FlowCast presentation' })
    output = win
    sleepBlock = powerSaveBlocker.start('prevent-display-sleep')
    win.on('closed', () => {
      if (output !== win) return
      output = null
      outputDisplay = null
      if (sleepBlock !== null) powerSaveBlocker.stop(sleepBlock)
      sleepBlock = null
    })
    await win.loadURL(`${ORIGIN}/slideshow`)
    if (win.isDestroyed()) return
    win.showInactive()
    if (external) setFullscreen(win, true)
    operator?.focus()
  }

  function setFullscreen(win, value) {
    win.setSimpleFullScreen(value)
    win.webContents.send('window:fullscreen-changed', value)
    return value
  }

  screen.on('display-removed', (_event, display) => {
    if (display.id !== outputDisplay) return
    output?.close()
    if (operator) void dialog.showMessageBox(operator, {
      message: 'The presentation display was disconnected.', detail: 'Reconnect it, then choose Open output to resume.',
    })
  })
  screen.on('display-metrics-changed', (_event, display) => {
    if (display.id === outputDisplay && output?.isSimpleFullScreen()) output.setBounds(display.bounds)
  })

  return {
    openOperator, openOutput, setFullscreen,
    operator: () => operator, output: () => output,
    broadcast: (channel, value) => {
      for (const win of [operator, output]) if (win && !win.isDestroyed()) win.webContents.send(channel, value)
    },
  }
}

module.exports = { createWindows }

const { spawn } = require('node:child_process')
const { randomBytes } = require('node:crypto')
const readline = require('node:readline')
const { ORIGIN } = require('./security.cjs')

function createVoice({ binary, userData, onStatus }) {
  let child = null
  let pending = null
  let endpoint = null
  let status = 'Voice is ready to set up.'
  let closing = false
  const report = (message) => { status = message; onStatus(message) }

  function connect() {
    onStatus(status)
    if (endpoint) return Promise.resolve(endpoint)
    if (pending) return pending
    const token = randomBytes(32).toString('hex')
    pending = new Promise((resolve, reject) => {
      child = spawn(binary, ['--managed'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: process.env.HOME,
          FLOWCAST_VOICE_TOKEN: token, FLOWCAST_VOICE_ORIGIN: ORIGIN,
          FLOWCAST_VOICE_MODELS: `${userData}/speech-models`,
        },
      })
      const startup = setTimeout(() => {
        reject(new Error('Voice helper did not start. Turn voice off and on to retry.'))
        child?.kill()
      }, 15000)
      readline.createInterface({ input: child.stdout }).on('line', (line) => {
        // FluidAudio also writes logs; only our prefixed records are control messages.
        if (!line.startsWith('FLOWCAST:')) return
        try {
          const message = JSON.parse(line.slice(9))
          if (message.type === 'listening') {
            clearTimeout(startup)
            endpoint = { url: `ws://127.0.0.1:${message.port}`, token }
            resolve(endpoint)
          } else if (message.type === 'status' || message.type === 'error') report(message.message)
        } catch { /* Ignore unrelated library output. */ }
      })
      child.stderr.on('data', (data) => console.error('[voice]', String(data).trim()))
      child.on('error', (error) => { clearTimeout(startup); reject(error) })
      child.on('exit', () => {
        clearTimeout(startup)
        child = null; endpoint = null; pending = null
        if (!closing) report('Voice helper stopped. Turn voice off and on to retry.')
        reject(new Error('Voice helper stopped before it was ready.'))
      })
    })
    return pending
  }

  return { connect, stop: () => { closing = true; child?.kill() } }
}

module.exports = { createVoice }

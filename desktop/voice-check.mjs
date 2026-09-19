// Integration check using real speech and the compiled Swift helper. May download models.
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const WebSocket = require('next/dist/compiled/ws')
const temporary = await mkdtemp(path.join(os.tmpdir(), 'flowcast-voice-check-'))
const token = randomBytes(32).toString('hex')
const origin = 'http://127.0.0.1:47820'
const modelsArg = process.argv.indexOf('--models')
const models = modelsArg >= 0 ? process.argv[modelsArg + 1] : path.join(os.homedir(), 'Library/Application Support/FlowCast/speech-models')
// Send what the app sends: a toy vocabulary makes the booster swap real words for book names.
const terms = JSON.parse(spawnSync('bun', ['-e', 'import { voiceVocabulary } from "./lib/voice-vocabulary"; console.log(JSON.stringify(voiceVocabulary))'], { encoding: 'utf8' }).stdout)
assert.ok(terms.length > 10)
let child
let socket
try {
  for (const [command, args] of [
    ['/usr/bin/say', ['-o', `${temporary}/speech.aiff`, 'John chapter three verse sixteen']],
    ['/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEF32@16000', '-c', '1', `${temporary}/speech.aiff`, `${temporary}/speech.wav`]],
  ]) {
    const result = spawnSync(command, args, { stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`${command} failed`)
  }
  const wav = await readFile(`${temporary}/speech.wav`)
  let samples
  for (let offset = 12; offset + 8 <= wav.length;) {
    const size = wav.readUInt32LE(offset + 4)
    if (wav.toString('ascii', offset, offset + 4) === 'data') { samples = wav.subarray(offset + 8, offset + 8 + size); break }
    offset += 8 + size + (size % 2)
  }
  assert.ok(samples?.length)
  child = spawn('desktop/stage/voice/FlowCastVoice', ['--managed'], {
    env: { PATH: '/usr/bin:/bin', HOME: os.homedir(), FLOWCAST_VOICE_TOKEN: token, FLOWCAST_VOICE_ORIGIN: origin, FLOWCAST_VOICE_MODELS: models },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stderr.on('data', (data) => process.stderr.write(data))
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Voice test exceeded 10 minutes.')), 600000)
    const fail = (error) => { clearTimeout(timer); reject(error) }
    child.on('error', fail)
    child.on('exit', (code) => fail(new Error(`Helper exited: ${code}`)))
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      if (!line.startsWith('FLOWCAST:')) return
      const record = JSON.parse(line.slice(9))
      if (record.type === 'status') console.log(record.message)
      if (record.type !== 'listening') return
      socket = new WebSocket(`ws://127.0.0.1:${record.port}`, ['flowcast', token], { origin })
      socket.on('error', fail)
      socket.on('open', () => socket.send(JSON.stringify({ type: 'vocabulary', terms })))
      socket.on('message', (data) => {
        const message = JSON.parse(String(data))
        if (message.type === 'error') fail(new Error(message.message))
        if (message.type === 'ready') {
          const packet = Buffer.alloc(4 + samples.length)
          packet.writeUInt32LE(1); samples.copy(packet, 4); socket.send(packet)
        }
        if (message.type === 'result') {
          try {
            assert.match(message.text, /john/i)
            assert.match(message.text, /sixteen|16/i)
            console.log(`Transcription passed in ${message.ms} ms: ${message.text}`)
            clearTimeout(timer); resolve()
          } catch (error) { fail(error) }
        }
      })
    })
  })
} finally {
  socket?.close()
  child?.kill()
  await rm(temporary, { recursive: true, force: true })
}

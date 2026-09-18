// Say a phrase, run it through the real speech helper, and show what the
// recognizer wrote next to what the parser made of it. This is the loop that
// turns a guess about voice commands into a measurement — every parser rule in
// lib/voice-parse.ts came out of a run of this.
//
// Usage: bun scripts/stt-eval/probe.ts [phrases.json]
//   phrases.json: [["what to say", "what it should mean"], ...]
//   "what it should mean" matches the summary printed below: "John 3:16",
//   "verse 12", "step +1", "version MSG", "back", or "nothing".
//
// The FlowCast Voice helper must be running (voice-helper/build-app.sh).
// Vary the voices: accents are where this breaks. Rishi is the one that turned
// "verse twelve" into "Vos twelve" when the US and UK voices were all fine.

import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseVoiceTranscript } from "@/lib/voice-parse"

const VOICES = ["Daniel", "Samantha", "Karen", "Moira", "Rishi"]

const DEFAULT_PHRASES: [string, string][] = [
  ["John three sixteen", "John 3:16"],
  ["Psalm one twenty one verse four", "Psalms 121:4"],
  ["Isaiah one nineteen", "Isaiah 1:19"],
  ["First Corinthians thirteen verse four", "1 Corinthians 13:4"],
  ["Luke four eighteen", "Luke 4:18"],
  ["Job one twenty one", "Job 1:21"],
  ["Verse twelve", "verse 12"],
  ["Next verse", "step +1"],
  ["Previous verse", "step -1"],
  ["Take me back", "back"],
  ["Switch to the Message", "version MSG"],
  ["Change to the King James", "version KJV"],
  ["In the message today God is speaking to somebody", "nothing"],
  ["In the next verse Paul explains what he means", "nothing"],
]

const phrases: [string, string][] = process.argv[2]
  ? JSON.parse(readFileSync(process.argv[2], "utf8"))
  : DEFAULT_PHRASES

function summarize(transcript: string): string {
  const intent = parseVoiceTranscript(transcript)
  if (!intent) return "nothing"
  if (intent.type === "reference") {
    return `${intent.book.name} ${intent.chapter}${intent.verse ? `:${intent.verse}` : ""}`
  }
  if (intent.type === "verse") return `verse ${intent.verse}`
  if (intent.type === "back") return "back"
  if (intent.type === "version") return `version ${intent.code}`
  return `${intent.type} ${intent.delta > 0 ? "+1" : "-1"}`
}

// macOS speech -> 16 kHz mono, the only format the helper accepts.
const dir = mkdtempSync(join(tmpdir(), "flowcast-probe-"))
const clips = phrases.map(([text, expected], index) => {
  const voice = VOICES[index % VOICES.length]
  const aiff = join(dir, `${index}.aiff`)
  const wav = join(dir, `${index}.wav`)
  execFileSync("say", ["-v", voice, "-o", aiff, text])
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff, "-ar", "16000", "-ac", "1", wav])
  const bytes = readFileSync(wav)
  const pcm = bytes.subarray(bytes.indexOf("data") + 8)
  const audio = new Float32Array(pcm.length / 2)
  for (let i = 0; i < audio.length; i++) audio[i] = pcm.readInt16LE(i * 2) / 32768
  return { text, expected, voice, audio }
})

// @ts-expect-error Bun's WebSocket takes headers; the helper rejects unknown origins.
const socket = new WebSocket("ws://127.0.0.1:47821", { headers: { Origin: "http://localhost:3000" } })
socket.binaryType = "arraybuffer"
const waiting = new Map<number, (text: string) => void>()
await new Promise<void>((resolve, reject) => {
  socket.onerror = () => reject(new Error("no helper on ws://127.0.0.1:47821 — is FlowCastVoice running?"))
  socket.onmessage = (event: MessageEvent) => {
    const message = JSON.parse(String(event.data))
    if (message.type === "ready") resolve()
    else waiting.get(message.id)?.(message.text ?? "")
  }
})

console.log("SAID".padEnd(42), "| HEARD".padEnd(44), "| PARSED".padEnd(20), "| WANTED")
let wrong = 0
for (const [index, clip] of clips.entries()) {
  const frame = new Uint8Array(4 + clip.audio.byteLength)
  new DataView(frame.buffer).setUint32(0, index, true)
  frame.set(new Uint8Array(clip.audio.buffer), 4)
  const heard = await new Promise<string>((resolve) => {
    waiting.set(index, resolve)
    socket.send(frame)
  })
  const parsed = summarize(heard)
  const ok = parsed === clip.expected
  if (!ok) wrong++
  console.log(
    `${ok ? "  " : "✗ "}${clip.text} [${clip.voice}]`.padEnd(42),
    `| ${heard}`.padEnd(44),
    `| ${parsed}`.padEnd(20),
    `| ${clip.expected}`,
  )
}
socket.close()
rmSync(dir, { recursive: true, force: true })
console.log(`\n${clips.length - wrong}/${clips.length} correct`)
process.exit(wrong ? 1 : 0)

// Sends the benchmark clips to the running FlowCast Voice helper over its real
// WebSocket, exactly as the browser does, and writes results for score.ts.
//
// Usage: bun scripts/stt-eval/run-helper.ts <out.json> [--vocab]   (helper must be running)
//   --vocab  send the custom dictionary first, as the browser does

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { voiceVocabulary } from "@/lib/voice-vocabulary"

const clips = join(dirname(fileURLToPath(import.meta.url)), "clips")
const manifest: { id: string; file: string }[] = JSON.parse(readFileSync(join(clips, "manifest.json"), "utf8"))

const readSamples = (file: string) => {
  const bytes = readFileSync(file)
  const pcm = bytes.subarray(bytes.indexOf("data") + 8)
  const audio = new Float32Array(pcm.length / 2)
  for (let i = 0; i < audio.length; i++) audio[i] = pcm.readInt16LE(i * 2) / 32768
  return audio
}

// @ts-expect-error Bun's WebSocket takes headers; the helper rejects unknown origins.
const socket = new WebSocket("ws://127.0.0.1:47821", { headers: { Origin: "http://localhost:3000" } })
socket.binaryType = "arraybuffer"
const waiting = new Map<number, (message: { text: string; ms: number }) => void>()
const ready = new Promise<void>((resolve, reject) => {
  socket.onerror = () => reject(new Error("can't reach the helper on ws://127.0.0.1:47821"))
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data))
    if (message.type === "ready" && process.argv.includes("--vocab")) {
      socket.send(JSON.stringify({ type: "vocabulary", terms: voiceVocabulary }))
    } else if (message.type === "ready" || message.type === "vocabulary") resolve()
    else waiting.get(message.id)?.(message.type === "error" ? { text: "", ms: 0 } : message)
  }
})
await ready

const results: Record<string, string> = {}
const times: number[] = []
for (const [index, clip] of manifest.entries()) {
  const samples = readSamples(join(clips, clip.file))
  const frame = new Uint8Array(4 + samples.byteLength)
  new DataView(frame.buffer).setUint32(0, index, true)
  frame.set(new Uint8Array(samples.buffer), 4)
  const startedAt = performance.now()
  const reply = await new Promise<{ text: string; ms: number }>((resolve) => {
    waiting.set(index, resolve)
    socket.send(frame)
  })
  times.push(performance.now() - startedAt)
  results[clip.id] = reply.text.trim()
}
socket.close()
writeFileSync(process.argv[2], JSON.stringify(results, null, 2))
times.sort((a, b) => a - b)
console.log(`round trip per clip: median ${Math.round(times[times.length >> 1])} ms, p95 ${Math.round(times[Math.floor(times.length * 0.95)])} ms`)

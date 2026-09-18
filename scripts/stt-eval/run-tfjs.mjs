// Transcribes the benchmark clips with a transformers.js speech model (the
// same library the browser engine uses) and writes results for score.ts.
// Runs on CPU in Node, so accuracy carries over to the browser; speed doesn't.
//
// Usage: node scripts/stt-eval/run-tfjs.mjs <hf-model-id> <dtype> <out.json>
//   e.g. node scripts/stt-eval/run-tfjs.mjs onnx-community/whisper-small.en q8 /tmp/small.json

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { pipeline } from "@huggingface/transformers"

const [model, dtype, outFile] = process.argv.slice(2)
const clips = join(dirname(fileURLToPath(import.meta.url)), "clips")
const manifest = JSON.parse(readFileSync(join(clips, "manifest.json"), "utf8"))

// Benchmark WAVs are 16-bit mono 16 kHz; skip whatever chunks precede "data".
const readWav = (file) => {
  const bytes = readFileSync(file)
  const pcm = bytes.subarray(bytes.indexOf("data") + 8)
  const audio = new Float32Array(pcm.length / 2)
  for (let i = 0; i < audio.length; i++) audio[i] = pcm.readInt16LE(i * 2) / 32768
  return audio
}

const transcriber = await pipeline("automatic-speech-recognition", model, { dtype })
const results = {}
let ms = 0
for (const clip of manifest) {
  const audio = readWav(join(clips, clip.file))
  const startedAt = performance.now()
  const { text } = await transcriber(audio, { max_new_tokens: Math.ceil((audio.length / 16000) * 6.5) + 8 })
  ms += performance.now() - startedAt
  results[clip.id] = text.trim()
}
writeFileSync(outFile, JSON.stringify(results, null, 2))
console.log(`${model} ${dtype}: ${Math.round(ms / manifest.length)} ms/clip (CPU) -> ${outFile}`)

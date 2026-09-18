// Self-check for lib/voice-segmenter.ts. Usage: bun scripts/test-voice-segmenter.ts

import assert from "node:assert/strict"
import { createSegmenter, TARGET_RATE } from "@/lib/voice-segmenter"

const RATE = 48000
const seconds = (n: number) => Math.round(n * RATE)

// Constant hiss, with three 1.5 s "utterances" (loud tone) separated by 1 s gaps.
const signal = new Float32Array(seconds(9))
for (let i = 0; i < signal.length; i++) signal[i] = (Math.random() - 0.5) * 0.004
for (const start of [1, 3.5, 6]) {
  for (let i = seconds(start); i < seconds(start + 1.5); i++) signal[i] += 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE)
}

const finals: Float32Array[] = []
let partials = 0
const segmenter = createSegmenter({
  sampleRate: RATE,
  partialMs: 700,
  onPartial: () => partials++,
  onFinal: (audio) => finals.push(audio),
})
// Feed in AudioWorklet-sized chunks.
for (let i = 0; i < signal.length; i += 128) segmenter.push(signal.subarray(i, i + 128))

assert.equal(finals.length, 3, "one final per utterance")
assert.ok(partials >= 3, "partials while speaking")
for (const audio of finals) {
  const duration = audio.length / TARGET_RATE
  // 1.5 s of speech + preroll + the trailing silence that closed it.
  assert.ok(duration > 1.7 && duration < 2.8, `utterance length ${duration.toFixed(2)}s`)
}
console.log(`ok — ${finals.length} finals, ${partials} partials`)

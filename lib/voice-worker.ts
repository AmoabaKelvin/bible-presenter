/// <reference lib="webworker" />

import type { ParakeetModel } from "parakeet.js"

// Runs the speech model off the main thread. WebGPU when the browser has it
// (Chrome, Edge, Dia, Arc, Safari 26+, recent Firefox), WASM otherwise — same
// code path, much slower.

export type VoiceWorkerRequest =
  | { type: "load" }
  | { type: "transcribe"; id: number; audio: Float32Array }

export type VoiceWorkerResponse =
  | { type: "progress"; percent: number; note?: string }
  | { type: "ready"; device: "webgpu" | "wasm" }
  | { type: "result"; id: number; text: string; ms: number }
  | { type: "error"; message: string }

// NVIDIA Parakeet TDT 0.6B v2: the English model FluidVoice runs, here through
// parakeet.js (encoder on WebGPU, small decoder on WASM).
// ponytail: weights come from the Hugging Face hub on first use (~2.4 GB fp32,
// kept in IndexedDB afterwards) and the ONNX runtime from jsDelivr. Self-host
// both before promising a fully offline first run.
const MODEL = "parakeet-tdt-0.6b-v2"

let model: ParakeetModel | null = null

// WebGPU compiles shaders per input shape, and an unseen audio length costs
// seconds. So every clip is zero-padded up to a whole number of seconds
// (trailing silence is harmless) and each of those few shapes is compiled
// once at load instead of mid-sermon. 9 s covers the segmenter's longest clip.
const BUCKET = 16000
const MAX_BUCKETS = 9
function padToBucket(audio: Float32Array): Float32Array {
  const length = Math.max(2, Math.ceil(audio.length / BUCKET)) * BUCKET
  if (length === audio.length) return audio
  const padded = new Float32Array(length)
  padded.set(audio)
  return padded
}

const post = (message: VoiceWorkerResponse) => self.postMessage(message)

async function load() {
  const { fromHub } = await import("parakeet.js")
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
  const device = gpu && (await gpu.requestAdapter().catch(() => null)) ? "webgpu" : "wasm"

  const files = new Map<string, { loaded: number; total: number }>()
  model = await fromHub(MODEL, {
    backend: device,
    // WebGPU can't run the int8 encoder, and the single-file fp16 one
    // (1.2 GB) dies with std::bad_alloc while ONNX Runtime copies it into the
    // 32-bit WASM heap. fp32 ships its weights as external data, which stream
    // to the GPU without that copy. int8 for the CPU fallback.
    encoderQuant: device === "webgpu" ? "fp32" : "int8",
    decoderQuant: "int8",
    progress: ({ file, loaded, total }) => {
      if (!total) return
      files.set(file, { loaded, total })
      let sumLoaded = 0
      let sumTotal = 0
      for (const entry of files.values()) {
        sumLoaded += entry.loaded
        sumTotal += entry.total
      }
      post({ type: "progress", percent: Math.round((100 * sumLoaded) / sumTotal) })
    },
  })
  for (let seconds = 2; seconds <= MAX_BUCKETS; seconds++) {
    post({ type: "progress", percent: 100, note: `Warming up… ${seconds - 1}/${MAX_BUCKETS - 1}` })
    await model.transcribe(new Float32Array(seconds * BUCKET), 16000)
  }
  post({ type: "ready", device })
}

self.onmessage = async (event: MessageEvent<VoiceWorkerRequest>) => {
  const message = event.data
  try {
    if (message.type === "load") {
      await load()
    } else if (model) {
      const startedAt = performance.now()
      const { utterance_text } = await model.transcribe(padToBucket(message.audio), 16000)
      post({ type: "result", id: message.id, text: utterance_text.trim(), ms: Math.round(performance.now() - startedAt) })
    }
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) })
  }
}

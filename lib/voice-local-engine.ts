import { createSegmenter } from "@/lib/voice-segmenter"
import { voiceVocabulary } from "@/lib/voice-vocabulary"
import type { VoiceWorkerRequest, VoiceWorkerResponse } from "@/lib/voice-worker"

// Microphone -> utterances -> on-device speech model -> transcripts.
// Nothing leaves the machine and any input device can be chosen (the PA
// feed). The model runs in the native helper when it's there, else in-browser.

// Served from our own origin rather than a GitHub release: the download has to
// work for someone who is not signed in to GitHub, on a church Mac, possibly
// on a private repo. Refreshed by voice-helper/build-app.sh.
export const HELPER_DOWNLOAD_URL = "/downloads/FlowCastVoice.zip"

type EngineOptions = {
  deviceId?: string
  // The in-browser model is a ~2.4 GB download, so it is never started
  // behind the operator's back: without the helper we ask first.
  allowInBrowser: boolean
  onNeedsHelper: () => void
  onTranscript: (text: string, isFinal: boolean) => void
  onStatus: (status: string | null) => void
  // Which recognizer ended up being used: "helper", "webgpu" or "wasm".
  onBackend: (label: string) => void
  onError: (message: string) => void
}

// Batches samples so the audio thread posts ~12 messages a second, not 375.
const CAPTURE_WORKLET = `
registerProcessor("voice-capture", class extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = new Float32Array(4096); this.fill = 0 }
  process(inputs) {
    const channel = inputs[0][0]
    if (!channel) return true
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.fill++] = channel[i]
      if (this.fill === this.buffer.length) { this.port.postMessage(this.buffer.slice()); this.fill = 0 }
    }
    return true
  }
})`

// Something that turns a 16 kHz clip into text. Results come back by id.
type BackendResult = { id: number; text: string; ms: number; error?: string }
type Backend = {
  label: string
  partialMs: number
  transcribe: (id: number, audio: Float32Array) => void
  subscribe: (listener: (result: BackendResult) => void) => () => void
}

// 1) FlowCast Voice, the native macOS helper (voice-helper/): Parakeet on the
// Neural Engine, ~100 ms a clip. Wire format is documented in its main.swift.
const HELPER_URL = "ws://127.0.0.1:47821"
let helper: Backend | null = null

// A running helper answers in milliseconds. The exception is the very first
// connection from the deployed site: Chrome asks permission to reach the local
// network, and until that is answered the socket just sits there (~34 s before
// it gives up on its own), so the wait depends on whether it has been granted.
const HELPER_CONNECT_MS = 4000
const HELPER_PERMISSION_MS = 60000

async function permissionState(name: string): Promise<PermissionState | null> {
  try {
    return (await navigator.permissions.query({ name: name as PermissionName })).state
  } catch {
    // Not every browser knows every permission; treat it as unknown.
    return null
  }
}

async function connectHelper(onStatus: (status: string) => void): Promise<Backend | null> {
  if (helper) return helper
  // Chrome-only, and only on a secure origin that isn't itself local.
  const permission = await permissionState("local-network-access")
  if (permission === "denied") return null
  if (permission === "prompt") onStatus("Allow local network access to use the voice helper…")
  const timeout = permission === "prompt" ? HELPER_PERMISSION_MS : HELPER_CONNECT_MS
  return new Promise((resolve) => {
    let settled = false
    const give = (backend: Backend | null) => {
      if (settled) return
      settled = true
      resolve(backend)
    }
    setTimeout(() => give(null), timeout)
    const listeners = new Set<(result: BackendResult) => void>()
    const socket = new WebSocket(HELPER_URL)
    socket.binaryType = "arraybuffer"
    // No timeout: a helper that isn't running refuses the connection within
    // milliseconds, while from the public site Chrome may be showing its
    // one-time "allow local network access" prompt, which must not be cut off.
    socket.onopen = () => onStatus("Voice helper is loading its model…")
    socket.onclose = () => {
      const wasLive = helper !== null
      helper = null
      if (wasLive) listeners.forEach((listener) => listener({ id: -1, text: "", ms: 0, error: "Voice helper disconnected." }))
      else give(null)
    }
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data))
      if (message.type === "vocabulary") return
      if (message.type === "ready") {
        socket.send(JSON.stringify({ type: "vocabulary", terms: voiceVocabulary }))
        helper = {
          label: "helper",
          partialMs: 300,
          transcribe: (id, audio) => {
            const frame = new Uint8Array(4 + audio.byteLength)
            new DataView(frame.buffer).setUint32(0, id, true)
            frame.set(new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength), 4)
            socket.send(frame)
          },
          subscribe: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
          },
        }
        give(helper)
      } else {
        const result: BackendResult = { id: message.id, text: message.text ?? "", ms: message.ms ?? 0, error: message.message }
        listeners.forEach((listener) => listener(result))
      }
    }
  })
}

// 2) The same model inside the browser (WebGPU/WASM worker): no install, any
// OS, but seconds per clip and gigabytes of memory. It takes a while to load,
// so it outlives mic on/off toggles.
let inBrowser: Promise<Backend> | null = null

function loadInBrowser(onStatus: (status: string) => void): Promise<Backend> {
  inBrowser ??= new Promise<Backend>((resolve, reject) => {
    const worker = new Worker(new URL("./voice-worker.ts", import.meta.url), { type: "module" })
    const listeners = new Set<(result: BackendResult) => void>()
    let ready = false
    worker.addEventListener("message", (event: MessageEvent<VoiceWorkerResponse>) => {
      const message = event.data
      if (message.type === "progress") onStatus(message.note ?? `Downloading speech model… ${message.percent}%`)
      if (message.type === "result") listeners.forEach((listener) => listener(message))
      if (message.type === "error") {
        if (ready) return listeners.forEach((listener) => listener({ id: -1, text: "", ms: 0, error: message.message }))
        inBrowser = null
        worker.terminate()
        reject(new Error(message.message))
      }
      if (message.type === "ready") {
        ready = true
        resolve({
          label: message.device,
          partialMs: 700,
          transcribe: (id, audio) =>
            worker.postMessage({ type: "transcribe", id, audio } satisfies VoiceWorkerRequest, [audio.buffer]),
          subscribe: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
          },
        })
      }
    })
    worker.postMessage({ type: "load" } satisfies VoiceWorkerRequest)
  })
  return inBrowser
}

export function startLocalEngine({
  deviceId,
  allowInBrowser,
  onNeedsHelper,
  onTranscript,
  onStatus,
  onBackend,
  onError,
}: EngineOptions): () => void {
  let stopped = false
  let cleanup = () => {}

  ;(async () => {
    onStatus("Looking for the voice helper…")
    const helperBackend = await connectHelper(onStatus)
    if (stopped) return
    if (!helperBackend && !allowInBrowser) {
      onNeedsHelper()
      return
    }
    // Ask for the mic while the model loads. Say so, or the last status
    // ("helper is loading its model") sits there looking stuck while the
    // browser waits for the operator to allow the microphone.
    if ((await permissionState("microphone")) === "prompt") onStatus("Allow microphone access…")
    const [stream, backend] = await Promise.all([
      navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          channelCount: 1,
          // Browser "enhancements" are tuned for calls and smear speech for
          // recognition, more so on an already-processed PA feed.
          echoCancellation: false,
          noiseSuppression: false,
        },
      }),
      helperBackend ?? loadInBrowser(onStatus),
    ])
    if (stopped) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    onBackend(backend.label)

    // One transcription at a time. Finals always run; a partial is dropped
    // if the model is busy, since a fresher one is never far behind.
    let nextId = 0
    let busy = false
    const finals: Float32Array[] = []
    const isFinalById = new Map<number, boolean>()
    const transcribe = (audio: Float32Array, isFinal: boolean) => {
      busy = true
      const id = nextId++
      isFinalById.set(id, isFinal)
      backend.transcribe(id, audio)
    }
    const unsubscribe = backend.subscribe((result) => {
      if (result.error) onError(result.error)
      else {
        const isFinal = isFinalById.get(result.id) ?? false
        console.debug(`[voice] ${backend.label} ${isFinal ? "final" : "partial"} ${result.ms}ms: ${result.text}`)
        if (result.text) onTranscript(result.text, isFinal)
      }
      isFinalById.delete(result.id)
      busy = false
      const queued = finals.shift()
      if (queued) transcribe(queued, true)
    })

    const context = new AudioContext()
    // A context created outside a click starts suspended, and a suspended
    // graph delivers no audio at all — the mic would look live and hear
    // nothing. Harmless when it is already running.
    void context.resume()
    const segmenter = createSegmenter({
      sampleRate: context.sampleRate,
      partialMs: backend.partialMs,
      onPartial: (audio) => {
        if (!busy && finals.length === 0) transcribe(audio, false)
      },
      onFinal: (audio) => {
        if (busy) finals.push(audio)
        else transcribe(audio, true)
      },
    })
    const moduleUrl = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: "application/javascript" }))
    await context.audioWorklet.addModule(moduleUrl)
    URL.revokeObjectURL(moduleUrl)
    const capture = new AudioWorkletNode(context, "voice-capture")
    capture.port.onmessage = (event: MessageEvent<Float32Array>) => segmenter.push(event.data)
    // Routed to a muted output so the graph is pulled but nothing is heard.
    const mute = context.createGain()
    mute.gain.value = 0
    context.createMediaStreamSource(stream).connect(capture).connect(mute).connect(context.destination)

    cleanup = () => {
      unsubscribe()
      stream.getTracks().forEach((track) => track.stop())
      void context.close()
    }
    if (stopped) cleanup()
    else onStatus(null)
  })().catch((error: unknown) => {
    const name = error instanceof DOMException ? error.name : ""
    onError(
      name === "NotAllowedError"
        ? "Microphone access was blocked."
        : name === "NotFoundError" || name === "OverconstrainedError"
          ? "That microphone isn't available."
          : `Voice commands failed to start: ${error instanceof Error ? error.message : String(error)}`,
    )
  })

  return () => {
    stopped = true
    cleanup()
  }
}

// Cuts a live microphone stream into utterances for a speech model that
// transcribes whole clips (Moonshine, Parakeet, Whisper) rather than streams.
//
// While someone is talking it hands out the utterance-so-far every
// `partialMs` ("partial"), and once they pause, the whole utterance ("final").
// Audio comes out resampled to 16 kHz mono, which is what the models expect.
// Check: bun scripts/test-voice-segmenter.ts

export const TARGET_RATE = 16000

// ponytail: energy gate with an adaptive noise floor, not a neural VAD. Fine
// for a direct mixer/PA feed; if room noise or music keeps it open, swap in
// silero-vad behind this same interface.
const FRAME_MS = 30
const START_MS = 90 // this much continuous speech opens an utterance
const END_MS = 600 // this much silence closes it
const PREROLL_MS = 300 // kept from before the opening, so first words aren't clipped
const MAX_UTTERANCE_MS = 8000 // a preacher who never pauses still gets cut
// Encoder cost grows with clip length and a spoken reference lasts 3-4 s, so
// partials only re-hear the recent tail.
const PARTIAL_WINDOW_MS = 5000
const MIN_RMS = 0.006
const FLOOR_RATIO = 3

type SegmenterOptions = {
  sampleRate: number
  // How often to hand out the utterance-so-far. Match it to how fast the
  // recognizer answers; asking faster than that only drops partials.
  partialMs: number
  onPartial: (audio: Float32Array) => void
  onFinal: (audio: Float32Array) => void
}

export function resample(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === TARGET_RATE) return input
  const ratio = fromRate / TARGET_RATE
  const out = new Float32Array(Math.floor(input.length / ratio))
  // Box filter: average the input span each output sample covers. Crude
  // anti-aliasing, plenty for speech recognition.
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = sum / (end - start)
  }
  return out
}

export function createSegmenter({ sampleRate, partialMs, onPartial, onFinal }: SegmenterOptions) {
  const samples = (ms: number) => Math.round((sampleRate * ms) / 1000)
  const frameSize = samples(FRAME_MS)
  let frame = new Float32Array(frameSize)
  let frameFill = 0

  let noiseFloor = MIN_RMS
  let speaking = false
  let speechRun = 0 // ms of consecutive speech while idle
  let silenceRun = 0 // ms of consecutive silence while speaking
  let sincePartial = 0
  let preroll: Float32Array[] = []
  let utterance: Float32Array[] = []
  let utteranceLength = 0

  const joined = (chunks: Float32Array[], length: number, tail?: number) => {
    const all = new Float32Array(length)
    let offset = 0
    for (const chunk of chunks) {
      all.set(chunk, offset)
      offset += chunk.length
    }
    return resample(tail && tail < length ? all.subarray(length - tail) : all, sampleRate)
  }

  const close = () => {
    onFinal(joined(utterance, utteranceLength))
    speaking = false
    utterance = []
    utteranceLength = 0
    silenceRun = 0
    speechRun = 0
  }

  const onFrame = (data: Float32Array) => {
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
    const rms = Math.sqrt(sum / data.length)
    const isSpeech = rms > Math.max(MIN_RMS, noiseFloor * FLOOR_RATIO)
    // Floor follows quiet quickly and creeps up slowly, so steady hiss or
    // hum gets absorbed but speech doesn't drag it up.
    if (!isSpeech) noiseFloor = rms < noiseFloor ? rms : noiseFloor * 0.995 + rms * 0.005

    if (!speaking) {
      preroll.push(data)
      if (preroll.length * FRAME_MS > PREROLL_MS + START_MS) preroll.shift()
      speechRun = isSpeech ? speechRun + FRAME_MS : 0
      if (speechRun >= START_MS) {
        speaking = true
        utterance = preroll
        utteranceLength = preroll.reduce((n, c) => n + c.length, 0)
        preroll = []
        sincePartial = 0
      }
      return
    }

    utterance.push(data)
    utteranceLength += data.length
    silenceRun = isSpeech ? 0 : silenceRun + FRAME_MS
    sincePartial += FRAME_MS
    if (silenceRun >= END_MS || utteranceLength >= samples(MAX_UTTERANCE_MS)) {
      close()
    } else if (sincePartial >= partialMs) {
      sincePartial = 0
      onPartial(joined(utterance, utteranceLength, samples(PARTIAL_WINDOW_MS)))
    }
  }

  return {
    // Accepts audio in whatever chunk size the capture node delivers.
    push(chunk: Float32Array) {
      let offset = 0
      while (offset < chunk.length) {
        const take = Math.min(frameSize - frameFill, chunk.length - offset)
        frame.set(chunk.subarray(offset, offset + take), frameFill)
        frameFill += take
        offset += take
        if (frameFill === frameSize) {
          onFrame(frame)
          frame = new Float32Array(frameSize)
          frameFill = 0
        }
      }
    },
  }
}

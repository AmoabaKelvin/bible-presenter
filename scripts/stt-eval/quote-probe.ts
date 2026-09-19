// say -> bundled helper (managed mode, real vocabulary) -> parser -> quote matcher.
// Shows where a spoken quote gets lost. Usage: bun scripts/stt-eval/quote-probe.ts [--models dir] [--voice Name]
import { spawn, spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import readline from "node:readline"
import { pipeline } from "@huggingface/transformers"
import { voiceVocabulary } from "@/lib/voice-vocabulary"
import { parseVoiceTranscript } from "@/lib/voice-parse"
import { pickQuote, stripLeadIn, type VerseIndex } from "@/lib/voice-quote"

const arg = (name: string) => { const at = process.argv.indexOf(name); return at >= 0 ? process.argv[at + 1] : undefined }
const models = arg("--models") ?? path.join(os.homedir(), "Library/Application Support/FlowCast/speech-models")
const voices = (arg("--voices") ?? "Daniel,Samantha,Rishi").split(",")
// --vocab a,b,c tries another custom dictionary against the same phrases.
const vocabulary = arg("--vocab")?.split(",") ?? voiceVocabulary
const phrases: [string, string][] = [
  ["For God so loved the world that he gave his only begotten son", "John 3:16"],
  ["The Lord is my shepherd, I shall not want", "Psalms 23:1"],
  ["The Bible says, I can do all things through Christ who strengthens me", "Philippians 4:13"],
  ["Trust in the Lord with all your heart and lean not on your own understanding", "Proverbs 3:5"],
  ["Now faith is the substance of things hoped for, the evidence of things not seen", "Hebrews 11:1"],
  ["Be still and know that I am God", "Psalms 46:10"],
  ["In the beginning was the Word, and the Word was with God, and the Word was God", "John 1:1"],
  ["And we know that all things work together for good to them that love God", "Romans 8:28"],
  ["The wages of sin is death but the gift of God is eternal life", "Romans 6:23"],
  ["Let the redeemed of the Lord say so", "Psalms 107:2"],
  ["Habakkuk chapter two verse four", "Habakkuk 2:4"],
  ["Nahum one seven", "Nahum 1:7"],
  ["Zephaniah three seventeen", "Zephaniah 3:17"],
  ["Philemon verse six", "Philemon 1:6"],
  ["Haggai two nine", "Haggai 2:9"],
  ["Second Kings five fourteen", "2 Kings 5:14"],
  ["James one five", "James 1:5"],
  ["Judges six twelve", "Judges 6:12"],
  ["Numbers six twenty four", "Numbers 6:24"],
  ["First Peter five seven", "1 Peter 5:7"],
  ["Ecclesiastes three one", "Ecclesiastes 3:1"],
  ["Colossians three twenty three", "Colossians 3:23"],
  ["Hosea four six", "Hosea 4:6"],
  ["Hosea chapter six verse one", "Hosea 6:1"],
]

const only = arg("--only")
if (only) phrases.splice(0, phrases.length, ...phrases.filter(([phrase]) => phrase.includes(only)))
const dir = "public/bibles/embeddings"
const parts = async (file: string) => {
  try { return await readFile(file) } catch {
    const found: Buffer[] = []
    for (let part = 0; ; part++) { try { found.push(await readFile(`${file}.part${part}`)) } catch { break } }
    return Buffer.concat(found)
  }
}
const indexes: VerseIndex[] = []
for (const version of ["bsb", "kjv", "niv"]) {
  const index: VerseIndex = { vectors: new Int8Array((await readFile(`${dir}/${version}.bin`)).buffer), refs: JSON.parse(await readFile(`${dir}/${version}.refs.json`, "utf8")) }
  const phraseVectors = await parts(`${dir}/${version}.phrases.bin`)
  if (phraseVectors.length) index.phrases = { vectors: new Int8Array(phraseVectors.buffer, phraseVectors.byteOffset, phraseVectors.length), offsets: new Uint32Array((await readFile(`${dir}/${version}.phrases.idx`)).buffer) }
  indexes.push(index)
}
const meta = JSON.parse(await readFile(`${dir}/meta.json`, "utf8"))
const extractor = await pipeline("feature-extraction", meta.model, { dtype: "q8" })
const embed = async (text: string) => (await extractor(meta.queryPrefix + text, { pooling: "mean", normalize: true })).data as Float32Array

const temporary = await mkdtemp(path.join(os.tmpdir(), "flowcast-quote-probe-"))
const token = randomBytes(32).toString("hex")
const origin = "http://127.0.0.1:47820"
const child = spawn("desktop/stage/voice/FlowCastVoice", ["--managed"], {
  env: { PATH: "/usr/bin:/bin", HOME: os.homedir(), FLOWCAST_VOICE_TOKEN: token, FLOWCAST_VOICE_ORIGIN: origin, FLOWCAST_VOICE_MODELS: models } as unknown as NodeJS.ProcessEnv,
  stdio: ["ignore", "pipe", "ignore"],
})
try {
  const port: number = await new Promise((resolve) => readline.createInterface({ input: child.stdout }).on("line", (line) => {
    if (line.startsWith("FLOWCAST:")) { const record = JSON.parse(line.slice(9)); if (record.type === "listening") resolve(record.port) }
  }))
  const socket = new WebSocket(`ws://127.0.0.1:${port}`, { protocols: ["flowcast", token], headers: { origin } } as never)
  socket.binaryType = "arraybuffer"
  const waiting = new Map<number, (text: string) => void>()
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => socket.send(JSON.stringify({ type: "vocabulary", terms: vocabulary }))
    socket.onerror = () => reject(new Error("socket error"))
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data))
      if (message.type === "ready") resolve()
      if (message.type === "result") waiting.get(message.id)?.(message.text)
    }
  })
  let hits = 0
  let id = 0
  for (const voice of voices) for (const [phrase, expected] of phrases) {
    id++
    spawnSync("/usr/bin/say", ["-v", voice, "-o", `${temporary}/s.aiff`, phrase])
    spawnSync("/usr/bin/afconvert", ["-f", "WAVE", "-d", "LEF32@16000", "-c", "1", `${temporary}/s.aiff`, `${temporary}/s.wav`])
    const wav = await readFile(`${temporary}/s.wav`)
    let samples = Buffer.alloc(0)
    for (let offset = 12; offset + 8 <= wav.length;) {
      const size = wav.readUInt32LE(offset + 4)
      if (wav.toString("ascii", offset, offset + 4) === "data") { samples = wav.subarray(offset + 8, offset + 8 + size); break }
      offset += 8 + size + (size % 2)
    }
    const packet = Buffer.alloc(4 + samples.length)
    packet.writeUInt32LE(id); samples.copy(packet, 4)
    const heard = await new Promise<string>((resolve) => { waiting.set(id, resolve); socket.send(packet) })
    const intent = parseVoiceTranscript(heard)
    const { quote, hadLeadIn } = stripLeadIn(heard)
    const match = intent ? null : pickQuote(await embed(quote), indexes, hadLeadIn, quote.split(/\s+/).length)
    const spoken = intent?.type === "reference" ? `${intent.book.name} ${intent.chapter}:${intent.verse ?? 1}` : match?.reference
    const ok = spoken === expected
    if (ok) hits++
    console.log(`${ok ? "OK  " : "MISS"} [${voice}] want ${expected}\n     heard: ${heard}\n     ${intent ? `parser took it as: ${JSON.stringify(intent).slice(0, 120)}` : match ? `matched ${match.reference} score ${match.score.toFixed(2)} margin ${match.margin.toFixed(2)}` : "no match"}`)
  }
  console.log(`${hits}/${phrases.length * voices.length}`)
  socket.close()
} finally {
  child.kill()
  await rm(temporary, { recursive: true, force: true })
}

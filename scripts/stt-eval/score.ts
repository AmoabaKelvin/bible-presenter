// Scores a speech engine on the only thing that matters here: after our
// parser reads its transcript, did the right scripture action come out?
//
// Usage: bun scripts/stt-eval/score.ts results.json
//   results.json = { "<clip id>": "<transcript>", ... }  (ids from clips/manifest.json)

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseVoiceTranscript } from "@/lib/voice-parse"

type Clip = { id: string; text: string; expected: string | null; voice: string; condition: string }

function show(text: string): string | null {
  const intent = parseVoiceTranscript(text)
  if (!intent) return null
  if (intent.type === "reference") return `${intent.book.name} ${intent.chapter}${intent.verse ? `:${intent.verse}` : ""}`
  if (intent.type === "verse") return `verse ${intent.verse}`
  if (intent.type === "back") return "back"
  return `${intent.type} ${intent.delta > 0 ? "+1" : "-1"}`
}

const manifest: Clip[] = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "clips", "manifest.json"), "utf8"))
const results: Record<string, string> = JSON.parse(readFileSync(process.argv[2], "utf8"))

const tally: Record<string, { hit: number; total: number }> = {}
const bump = (key: string, hit: boolean) => {
  tally[key] ??= { hit: 0, total: 0 }
  tally[key].total++
  if (hit) tally[key].hit++
}
const misses: string[] = []
let wrongAction = 0
for (const clip of manifest) {
  const transcript = results[clip.id]
  if (transcript === undefined) continue
  const actual = show(transcript)
  const hit = actual === clip.expected
  bump("all", hit)
  bump(clip.condition, hit)
  bump(`voice:${clip.voice}`, hit)
  if (!hit) {
    // Doing the wrong thing on screen is worse than doing nothing.
    if (actual !== null) wrongAction++
    misses.push(`  ${clip.id}\n    said:     ${clip.text}\n    heard:    ${transcript}\n    expected: ${clip.expected}   got: ${actual}`)
  }
}
for (const [key, { hit, total }] of Object.entries(tally)) {
  console.log(`${key.padEnd(16)} ${hit}/${total}  ${((100 * hit) / total).toFixed(0)}%`)
}
console.log(`wrong action (not just a miss): ${wrongAction}`)
if (misses.length) console.log(`\nmisses:\n${misses.join("\n")}`)

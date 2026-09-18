// Builds the speech-to-text benchmark: spoken scripture references as 16 kHz
// mono WAVs plus a manifest of what each clip should resolve to.
//
// Synthetic (macOS `say`) in two conditions: clean, and "pa" — reverb + hiss +
// band-limiting, a rough stand-in for a preacher's mic through a PA feed.
// ponytail: TTS voices are kinder than a real room. Drop real recordings into
// clips/ and add them to manifest.json by hand; score.ts doesn't care.
//
// Usage: bun scripts/stt-eval/make-clips.ts   (needs macOS + ffmpeg)

import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const OUT = join(dirname(fileURLToPath(import.meta.url)), "clips")
const VOICES = ["Samantha", "Daniel", "Karen", "Moira", "Rishi"]

// [what is said, what the parser should produce (null = must do nothing)]
const UTTERANCES: [string, string | null][] = [
  ["Psalm one twenty one verse four", "Psalms 121:4"],
  ["John chapter three verse sixteen", "John 3:16"],
  ["John one one", "John 1:1"],
  ["Let's turn to the book of Romans, chapter eight, verse twenty eight", "Romans 8:28"],
  ["Open your Bibles with me to First Corinthians thirteen verse four", "1 Corinthians 13:4"],
  ["Second Timothy chapter three verse sixteen", "2 Timothy 3:16"],
  ["First John four eight", "1 John 4:8"],
  ["Third John verse four", "3 John 1:4"],
  ["Habakkuk chapter two verse four", "Habakkuk 2:4"],
  ["Ecclesiastes three verse one", "Ecclesiastes 3:1"],
  ["Deuteronomy chapter six verse five", "Deuteronomy 6:5"],
  ["Zephaniah three seventeen", "Zephaniah 3:17"],
  ["First Thessalonians five verse seventeen", "1 Thessalonians 5:17"],
  ["Philemon verse six", "Philemon 1:6"],
  ["Nahum chapter one verse seven", "Nahum 1:7"],
  ["Psalm one hundred and nineteen verse one hundred and five", "Psalms 119:105"],
  ["Isaiah forty verse thirty one", "Isaiah 40:31"],
  ["Revelation chapter twenty one verse four", "Revelation 21:4"],
  ["Song of Solomon chapter two verse one", "Song of Solomon 2:1"],
  ["The Bible says in Philippians four thirteen, I can do all things", "Philippians 4:13"],
  ["Hebrews eleven one, now faith is the substance of things hoped for", "Hebrews 11:1"],
  ["Genesis chapter one verse one", "Genesis 1:1"],
  ["Matthew chapter five verse thirteen", "Matthew 5:13"],
  ["Job chapter nineteen verse twenty five", "Job 19:25"],
  ["Look at verse seventeen", "verse 17"],
  ["Next verse", "step +1"],
  ["Previous verse", "step -1"],
  ["Next verse please", "step +1"],
  ["Next chapter", "chapter +1"],
  ["In the next verse Paul explains what he means by grace", null],
  ["John said to Mark that the numbers were wrong", null],
  ["Praise the Lord, somebody shout hallelujah", null],
]

const PA_FILTER =
  "[0:a]highpass=f=120,lowpass=f=6000,aecho=0.8:0.75:45|110:0.45|0.3[v];" +
  "anoisesrc=color=pink:amplitude=0.02:sample_rate=16000[n];" +
  "[v][n]amix=inputs=2:duration=first:normalize=0[out]"

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const manifest: { id: string; file: string; text: string; expected: string | null; voice: string; condition: string }[] = []
UTTERANCES.forEach(([text, expected], index) => {
  // Two voices per utterance, rotating, so every voice meets every kind of phrase.
  for (const voice of [VOICES[index % VOICES.length], VOICES[(index + 2) % VOICES.length]]) {
    const base = `${String(index + 1).padStart(2, "0")}-${voice.toLowerCase()}`
    const aiff = join(OUT, `${base}.aiff`)
    execFileSync("say", ["-v", voice, "-o", aiff, text])
    const clean = `${base}-clean.wav`
    const pa = `${base}-pa.wav`
    // Half a second of lead-in/out so VAD-gated engines see a real utterance boundary.
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff, "-af", "adelay=500:all=1,apad=pad_dur=0.8", "-ar", "16000", "-ac", "1", join(OUT, clean)])
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(OUT, clean), "-filter_complex", PA_FILTER, "-map", "[out]", "-ar", "16000", "-ac", "1", join(OUT, pa)])
    rmSync(aiff)
    manifest.push({ id: `${base}-clean`, file: clean, text, expected, voice, condition: "clean" })
    manifest.push({ id: `${base}-pa`, file: pa, text, expected, voice, condition: "pa" })
  }
})
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2))
console.log(`${manifest.length} clips -> ${OUT}`)

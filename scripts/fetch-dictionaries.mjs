// Standalone Node ESM script that downloads two public-domain dictionaries and
// writes them to public/dictionaries/ so the app can ship baked-in, offline
// word lookups. No app imports.
//
//   • Webster's 1913 (general English — period-correct senses of archaic KJV
//     vocabulary like "charity", "suffer", "quick"). Source is already a flat
//     { word: definition } map with lowercase keys (~22 MB, ~102k entries).
//   • Easton's 1897 Bible Dictionary (biblical proper nouns, places, people,
//     theology — "Melchizedek", "propitiation"). Source is a list of
//     { word, def, xref } entries (~1.2 MB, ~4k entries).
//
// Output shapes (kept deliberately different to avoid bloating the 22 MB
// Webster file with redundant display-word copies):
//   public/dictionaries/websters.json → { [lowerWord]: definition }
//   public/dictionaries/eastons.json  → { [lowerWord]: { w: DisplayWord, d: definition } }
//
// Usage: node scripts/fetch-dictionaries.mjs

import { writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const WEBSTERS_URL =
  "https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/master/dictionary_compact.json"
// Easton's is published as one file per starting letter; each is an object of
// { [Name]: { name, slug, definitions: [{ source, text }] } }.
const EASTONS_BASE =
  "https://raw.githubusercontent.com/neuu-org/bible-dictionary-dataset/main/data/02_sources/easton"
const EASTONS_LETTERS = "abcdefghijklmnopqrstuvwxyz".split("")

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

// Lowercased, trimmed, punctuation-stripped lookup key. Mirrors the
// normalization in lib/dictionary.ts so the keys we write here are exactly
// what the app looks words up by.
function normalize(word) {
  return String(word)
    .toLowerCase()
    .trim()
    .replace(/^[^a-z]+|[^a-z]+$/g, "")
}

async function buildWebsters() {
  const raw = await fetchJson(WEBSTERS_URL)
  const out = {}
  let kept = 0
  for (const [word, def] of Object.entries(raw)) {
    const key = normalize(word)
    if (!key || !def) continue
    // Keep the first definition on collision (the source has none, but be safe).
    if (!(key in out)) {
      out[key] = String(def).trim()
      kept += 1
    }
  }
  return { out, kept }
}

async function buildEastons() {
  const out = {}
  let kept = 0
  for (const letter of EASTONS_LETTERS) {
    let byName
    try {
      byName = await fetchJson(`${EASTONS_BASE}/${letter}.json`)
    } catch {
      continue // some letters (e.g. x) legitimately have no file
    }
    for (const entry of Object.values(byName)) {
      const word = entry?.name
      const def = (entry?.definitions ?? [])
        .map((d) => String(d?.text ?? "").trim())
        .filter(Boolean)
        .join("\n\n")
      const key = normalize(word)
      if (!key || !def) continue
      if (key in out) {
        out[key].d += `\n\n${def}` // homograph — keep both senses
      } else {
        out[key] = { w: String(word).trim(), d: def }
        kept += 1
      }
    }
  }
  return { out, kept }
}

async function run() {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const outDir = join(__dirname, "..", "public", "dictionaries")
  await mkdir(outDir, { recursive: true })

  console.log("Downloading Webster's 1913…")
  const webster = await buildWebsters()
  const websterPath = join(outDir, "websters.json")
  await writeFile(websterPath, JSON.stringify(webster.out))
  console.log(`wrote ${websterPath} (${webster.kept} entries)`)

  console.log("Downloading Easton's 1897 Bible Dictionary…")
  const easton = await buildEastons()
  const eastonPath = join(outDir, "eastons.json")
  await writeFile(eastonPath, JSON.stringify(easton.out))
  console.log(`wrote ${eastonPath} (${easton.kept} entries)`)

  // Fail loudly if either source came back suspiciously small, so a silent
  // upstream change doesn't ship an empty dictionary.
  if (webster.kept < 50000) throw new Error(`Webster's looks too small: ${webster.kept} entries`)
  if (easton.kept < 3000) throw new Error(`Easton's looks too small: ${easton.kept} entries`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

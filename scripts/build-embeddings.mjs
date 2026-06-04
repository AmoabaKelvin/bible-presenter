// Builds the semantic search index for the bundled BSB text.
//
// Reads public/bibles/bsb.json, embeds every verse with a small sentence
// model (bge-small-en-v1.5), then writes an int8-quantized vector blob plus
// an aligned reference list to public/bibles/embeddings/. The runtime
// (lib/semantic-search.ts) loads these to answer "find by meaning" queries
// fully client-side.
//
// Why BSB: modern English matches how people phrase fuzzy queries far better
// than archaic KJV, and it is public domain so it is safe to bundle.
//
// Usage: node scripts/build-embeddings.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { pipeline } from "@huggingface/transformers"

// Bump to "Xenova/bge-base-en-v1.5" (768-dim) if small isn't sharp enough.
const MODEL = "Xenova/bge-small-en-v1.5"
// bge models want passages embedded as-is; only the *query* gets an
// instruction prefix (applied at runtime, recorded in meta).
const QUERY_PREFIX =
  "Represent this sentence for searching relevant passages: "
const BATCH_SIZE = 64

// Canonical 66-book order so the embedding rows line up with a stable,
// reproducible verse sequence regardless of object key iteration order.
const BOOK_ORDER = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
  "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
  "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
  "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah",
  "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
  "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
]

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

// Flatten { "Book:Chapter": [{number, text}] } into canonical-order verses.
function flattenVerses(chapters) {
  const verses = []
  for (const book of BOOK_ORDER) {
    const chapterNums = Object.keys(chapters)
      .filter((k) => k.slice(0, k.lastIndexOf(":")) === book)
      .map((k) => Number(k.slice(k.lastIndexOf(":") + 1)))
      .sort((a, b) => a - b)
    for (const ch of chapterNums) {
      const list = [...chapters[`${book}:${ch}`]].sort((a, b) => a.number - b.number)
      for (const v of list) {
        const text = (v.text ?? "").trim()
        if (text) verses.push({ reference: `${book} ${ch}:${v.number}`, text })
      }
    }
  }
  return verses
}

async function run() {
  const bsbPath = join(root, "public", "bibles", "bsb.json")
  const { chapters } = JSON.parse(await readFile(bsbPath, "utf8"))
  const verses = flattenVerses(chapters)
  const count = verses.length
  console.log(`embedding ${count} verses with ${MODEL}`)

  const extractor = await pipeline("feature-extraction", MODEL)

  let dim = 0
  let quantized = null // Int8Array, allocated once we know dim
  let done = 0

  for (let start = 0; start < count; start += BATCH_SIZE) {
    const batch = verses.slice(start, start + BATCH_SIZE)
    const output = await extractor(
      batch.map((v) => v.text),
      { pooling: "mean", normalize: true },
    )
    const rows = output.tolist() // [batchN][dim], already unit-normalized

    if (!quantized) {
      dim = rows[0].length
      quantized = new Int8Array(count * dim)
    }

    for (let i = 0; i < rows.length; i++) {
      const base = (start + i) * dim
      const row = rows[i]
      for (let d = 0; d < dim; d++) {
        // Components of a unit vector are in [-1, 1]; map to int8 and clamp.
        let q = Math.round(row[d] * 127)
        if (q > 127) q = 127
        else if (q < -127) q = -127
        quantized[base + d] = q
      }
    }

    done += rows.length
    process.stdout.write(`\rembedded ${done}/${count}`)
  }
  process.stdout.write("\n")

  const outDir = join(root, "public", "bibles", "embeddings")
  await mkdir(outDir, { recursive: true })

  await writeFile(join(outDir, "bsb.bin"), Buffer.from(quantized.buffer))
  await writeFile(
    join(outDir, "bsb.refs.json"),
    JSON.stringify(verses.map((v) => v.reference)),
  )
  await writeFile(
    join(outDir, "meta.json"),
    JSON.stringify({
      version: "BSB",
      model: MODEL,
      dim,
      count,
      quant: "int8/127",
      queryPrefix: QUERY_PREFIX,
    }),
  )

  const mb = (quantized.byteLength / 1e6).toFixed(1)
  console.log(`wrote ${outDir} — ${count} vectors x ${dim} dims (${mb} MB int8)`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

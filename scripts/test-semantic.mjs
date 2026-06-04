// Quick correctness/quality check for the semantic index, independent of the
// browser. Loads the int8 blob + model and prints the top matches for a set
// of deliberately fuzzy queries (paraphrases, cross-translation wording).
//
// Usage: node scripts/test-semantic.mjs ["your own query"]

import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { pipeline } from "@huggingface/transformers"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dir = join(root, "public", "bibles", "embeddings")

const meta = JSON.parse(await readFile(join(dir, "meta.json"), "utf8"))
const refs = JSON.parse(await readFile(join(dir, "bsb.refs.json"), "utf8"))
const vectors = new Int8Array((await readFile(join(dir, "bsb.bin"))).buffer)
const bsb = JSON.parse(await readFile(join(root, "public", "bibles", "bsb.json"), "utf8"))

// ref -> text for display
const textByRef = new Map()
for (const [key, verses] of Object.entries(bsb.chapters)) {
  const sep = key.lastIndexOf(":")
  const book = key.slice(0, sep)
  const ch = key.slice(sep + 1)
  for (const v of verses) textByRef.set(`${book} ${ch}:${v.number}`, v.text)
}

console.log(
  `index: ${meta.count} verses x ${meta.dim} dims, model ${meta.model}`,
)
if (vectors.length !== meta.count * meta.dim || refs.length !== meta.count) {
  console.error("FATAL: index/meta size mismatch")
  process.exit(1)
}

const extractor = await pipeline("feature-extraction", meta.model)
const { dim } = meta

async function search(query, k = 5) {
  const out = await extractor(meta.queryPrefix + query, {
    pooling: "mean",
    normalize: true,
  })
  const q = out.data
  const scored = new Array(meta.count)
  for (let i = 0; i < meta.count; i++) {
    let dot = 0
    const base = i * dim
    for (let d = 0; d < dim; d++) dot += q[d] * vectors[base + d]
    scored[i] = { i, score: dot }
  }
  scored.sort((a, b) => b.score - a.score)
  console.log(`\n=== "${query}" ===`)
  for (const { i, score } of scored.slice(0, k)) {
    const ref = refs[i]
    const text = (textByRef.get(ref) ?? "").slice(0, 90)
    console.log(`  ${(score / 16129).toFixed(3)}  ${ref}  —  ${text}`)
  }
}

const custom = process.argv[2]
const queries = custom
  ? [custom]
  : [
      "love is patient love is kind",
      "a city on a hill cannot be hidden",
      "do not worry about tomorrow",
      "faith is being sure of what you hope for",
      "I can do all things through Christ who strengthens me",
      "the fruit of the spirit",
      "in the beginning God created the heavens and the earth",
      "the verse about the tongue being a small part that boasts great things",
    ]

for (const q of queries) await search(q)

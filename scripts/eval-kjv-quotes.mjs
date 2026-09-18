// How well does the semantic index find verses quoted in KJV wording, the way
// a preacher says them? Prints the rank of the expected verse per quote.
// Baseline 2026-09-18, BSB-only index: top1 19/24, top5 20/24 — misses are
// KJV-only vocabulary ("charity", "careful for nothing", "effectual fervent").
//
// Usage: node scripts/eval-kjv-quotes.mjs

import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { pipeline } from "@huggingface/transformers"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dir = join(root, "public", "bibles", "embeddings")
const meta = JSON.parse(await readFile(join(dir, "meta.json"), "utf8"))
const refs = JSON.parse(await readFile(join(dir, "bsb.refs.json"), "utf8"))
const vectors = new Int8Array((await readFile(join(dir, "bsb.bin"))).buffer)
const extractor = await pipeline("feature-extraction", meta.model)
const cases = [
  ["the lord is my shepherd i shall not want", ["Psalms 23:1"]],
  ["for god so loved the world that he gave his only begotten son", ["John 3:16"]],
  ["thy word is a lamp unto my feet and a light unto my path", ["Psalms 119:105"]],
  ["charity suffereth long and is kind charity envieth not", ["1 Corinthians 13:4"]],
  ["now faith is the substance of things hoped for the evidence of things not seen", ["Hebrews 11:1"]],
  ["trust in the lord with all thine heart and lean not unto thine own understanding", ["Proverbs 3:5"]],
  ["i will lift up mine eyes unto the hills from whence cometh my help", ["Psalms 121:1"]],
  ["be careful for nothing but in every thing by prayer and supplication", ["Philippians 4:6"]],
  ["wherefore seeing we also are compassed about with so great a cloud of witnesses", ["Hebrews 12:1"]],
  ["he that dwelleth in the secret place of the most high shall abide under the shadow of the almighty", ["Psalms 91:1"]],
  ["study to shew thyself approved unto god a workman that needeth not to be ashamed", ["2 Timothy 2:15"]],
  ["suffer the little children to come unto me and forbid them not", ["Mark 10:14", "Matthew 19:14", "Luke 18:16"]],
  ["the effectual fervent prayer of a righteous man availeth much", ["James 5:16"]],
  ["let not your heart be troubled ye believe in god believe also in me", ["John 14:1"]],
  ["but they that wait upon the lord shall renew their strength", ["Isaiah 40:31"]],
  ["quench not the spirit", ["1 Thessalonians 5:19"]],
  ["where there is no vision the people perish", ["Proverbs 29:18"]],
  ["it is more blessed to give than to receive", ["Acts 20:35"]],
  ["greater love hath no man than this that a man lay down his life for his friends", ["John 15:13"]],
  ["the wages of sin is death but the gift of god is eternal life", ["Romans 6:23"]],
  ["whatsoever things are true whatsoever things are honest whatsoever things are just", ["Philippians 4:8"]],
  ["he maketh me to lie down in green pastures he leadeth me beside the still waters", ["Psalms 23:2"]],
  ["neither give place to the devil", ["Ephesians 4:27"]],
  ["ye are the salt of the earth but if the salt have lost his savour", ["Matthew 5:13"]],
]
let top1 = 0, top5 = 0
for (const [query, expected] of cases) {
  const q = (await extractor(meta.queryPrefix + query, { pooling: "mean", normalize: true })).data
  const scores = new Float32Array(meta.count)
  for (let i = 0; i < meta.count; i++) { let dot = 0; const b = i * meta.dim; for (let d = 0; d < meta.dim; d++) dot += q[d] * vectors[b + d]; scores[i] = dot }
  const order = [...scores.keys()].sort((a, b) => scores[b] - scores[a])
  const rank = order.findIndex((i) => expected.includes(refs[i])) + 1
  if (rank === 1) top1++
  if (rank <= 5) top5++
  console.log(String(rank).padStart(5), (scores[order[0]] / 16129).toFixed(3), expected[0].padEnd(22), rank === 1 ? "" : `top: ${refs[order[0]]}`)
}
console.log(`top1 ${top1}/${cases.length}  top5 ${top5}/${cases.length}`)

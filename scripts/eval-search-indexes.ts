// Ranks typed search queries (descriptive, KJV and NIV wording) against the
// embedding indexes and reports where the right verse lands: BSB only, all
// three translations, and with KJV clause windows (what semanticSearch does).
//
// Usage: bun scripts/eval-search-indexes.ts
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { pipeline } from "@huggingface/transformers"

const dir = join(process.cwd(), "public", "bibles", "embeddings")
const meta = JSON.parse(await readFile(join(dir, "meta.json"), "utf8"))
async function readVectors(path: string): Promise<Buffer> {
  try { return await readFile(path) } catch {
    const parts: Buffer[] = []
    for (let p = 0; ; p++) { try { parts.push(await readFile(`${path}.part${p}`)) } catch { break } }
    return Buffer.concat(parts)
  }
}
type Index = { name: string; vectors: Int8Array; refs: string[]; phrases?: { vectors: Int8Array; offsets: Uint32Array } }
const indexes: Index[] = []
for (const name of ["bsb", "kjv", "niv"]) {
  const idx: Index = { name, vectors: new Int8Array((await readFile(join(dir, `${name}.bin`))).buffer), refs: JSON.parse(await readFile(join(dir, `${name}.refs.json`), "utf8")) }
  try {
    idx.phrases = { vectors: new Int8Array((await readVectors(join(dir, `${name}.phrases.bin`))).buffer), offsets: new Uint32Array((await readFile(join(dir, `${name}.phrases.idx`))).buffer) }
  } catch {}
  indexes.push(idx)
}
const extractor = await pipeline("feature-extraction", meta.model)
const dim = meta.dim
const dot = (q: Float32Array, v: Int8Array, row: number) => { let s = 0; for (let d = 0, b = row * dim; d < dim; d++) s += q[d] * v[b + d]; return s / 127 }

function rank(q: Float32Array, use: string[], phrases: boolean, phrasePenalty = 0): string[] {
  const best = new Map<string, number>()
  for (const idx of indexes.filter((i) => use.includes(i.name))) {
    const scored: [number, number][] = []
    for (let r = 0; r < idx.refs.length; r++) scored.push([r, dot(q, idx.vectors, r)])
    scored.sort((a, b) => b[1] - a[1])
    for (const [r, s0] of scored.slice(0, 100)) {
      let s = s0
      if (phrases && idx.phrases) for (let p = idx.phrases.offsets[r]; p < idx.phrases.offsets[r + 1]; p++) s = Math.max(s, dot(q, idx.phrases.vectors, p) - phrasePenalty)
      const ref = idx.refs[r]
      if ((best.get(ref) ?? -1) < s) best.set(ref, s)
    }
  }
  return [...best.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r)
}

const cases: [string, string[], string][] = [
  // descriptive / modern wording (what people type)
  ["love is patient love is kind", ["1 Corinthians 13:4"], "desc"],
  ["a city on a hill cannot be hidden", ["Matthew 5:14"], "desc"],
  ["do not worry about tomorrow", ["Matthew 6:34"], "desc"],
  ["faith is being sure of what you hope for", ["Hebrews 11:1"], "desc"],
  ["the fruit of the spirit", ["Galatians 5:22"], "desc"],
  ["in the beginning God created the heavens and the earth", ["Genesis 1:1"], "desc"],
  ["the verse about the tongue being a small part that boasts great things", ["James 3:5"], "desc"],
  ["the fourth man in the fire", ["Daniel 3:25"], "desc"],
  ["armor of god", ["Ephesians 6:11", "Ephesians 6:13"], "desc"],
  ["wages of sin", ["Romans 6:23"], "desc"],
  ["jesus wept", ["John 11:35"], "desc"],
  ["i am the good shepherd", ["John 10:11", "John 10:14"], "desc"],
  ["cast all your anxiety on him", ["1 Peter 5:7"], "desc"],
  ["the joy of the lord is my strength", ["Nehemiah 8:10"], "desc"],
  ["he gave gifts unto men", ["Ephesians 4:8"], "kjv"],
  // KJV quotes
  ["eyes have not seen ears have not heard", ["1 Corinthians 2:9", "Isaiah 64:4"], "kjv"],
  ["the lord is my shepherd i shall not want", ["Psalms 23:1"], "kjv"],
  ["thy word is a lamp unto my feet", ["Psalms 119:105"], "kjv"],
  ["now faith is the substance of things hoped for", ["Hebrews 11:1"], "kjv"],
  ["trust in the lord with all thine heart", ["Proverbs 3:5"], "kjv"],
  ["i will lift up mine eyes unto the hills", ["Psalms 121:1"], "kjv"],
  ["he that dwelleth in the secret place of the most high", ["Psalms 91:1"], "kjv"],
  ["where there is no vision the people perish", ["Proverbs 29:18"], "kjv"],
  ["charity suffereth long and is kind", ["1 Corinthians 13:4"], "kjv"],
  ["the effectual fervent prayer of a righteous man availeth much", ["James 5:16"], "kjv"],
  ["he was wounded for our transgressions", ["Isaiah 53:5"], "kjv"],
  ["the peace of god which passeth all understanding", ["Philippians 4:7"], "kjv"],
  ["weeping may endure for a night but joy cometh in the morning", ["Psalms 30:5"], "kjv"],
  ["my grace is sufficient for thee", ["2 Corinthians 12:9"], "kjv"],
  ["being confident of this very thing", ["Philippians 1:6"], "kjv"],
  ["no weapon that is formed against thee shall prosper", ["Isaiah 54:17"], "kjv"],
  // NIV wording
  ["plans to prosper you and not to harm you", ["Jeremiah 29:11"], "niv"],
  ["those who hope in the lord will renew their strength", ["Isaiah 40:31"], "niv"],
  ["no condemnation for those who are in christ jesus", ["Romans 8:1"], "niv"],
  ["do not be anxious about anything", ["Philippians 4:6"], "niv"],
  ["against the spiritual forces of evil in the heavenly realms", ["Ephesians 6:12"], "niv"],
  ["even though i walk through the darkest valley", ["Psalms 23:4"], "niv"],
  ["do not conform to the pattern of this world", ["Romans 12:2"], "niv"],
]

const strategies: [string, (q: Float32Array) => string[]][] = [
  ["A bsb", (q) => rank(q, ["bsb"], false)],
  ["B bsb+kjv+niv", (q) => rank(q, ["bsb", "kjv", "niv"], false)],
  ["C +phrases", (q) => rank(q, ["bsb", "kjv", "niv"], true)],
  ["D +phrases-0.03", (q) => rank(q, ["bsb", "kjv", "niv"], true, 0.03)],
]
const tally = strategies.map(() => ({ top1: 0, top5: 0, miss: [] as string[], byKind: {} as Record<string, number> }))
const lines: string[] = []
for (const [text, want, kind] of cases) {
  const out = await extractor(meta.queryPrefix + text, { pooling: "mean", normalize: true })
  const q = out.data as Float32Array
  const ranks = strategies.map(([, f]) => { const list = f(q); const i = list.findIndex((r) => want.includes(r)); return i < 0 ? 999 : i + 1 })
  ranks.forEach((r, s) => { if (r === 1) { tally[s].top1++; tally[s].byKind[kind] = (tally[s].byKind[kind] ?? 0) + 1 } if (r <= 5) tally[s].top5++; else tally[s].miss.push(text) })
  lines.push(`${ranks.map((r) => String(r === 999 ? "-" : r).padStart(4)).join("")}  [${kind}] ${text}`)
}
console.log(`   A   B   C   D`)
console.log(lines.join("\n"))
strategies.forEach(([name], s) => console.log(`${name.padEnd(18)} top1 ${tally[s].top1}/${cases.length}  top5 ${tally[s].top5}/${cases.length}  top1 by kind ${JSON.stringify(tally[s].byKind)}`))
// timing of whole-verse scan over 3 indexes
const t = performance.now(); const probe = (await extractor(meta.queryPrefix + "test", { pooling: "mean", normalize: true })).data as Float32Array
const t1 = performance.now(); rank(probe, ["bsb", "kjv", "niv"], true); console.log(`rank C: ${(performance.now() - t1).toFixed(0)} ms (embed ${(t1 - t).toFixed(0)} ms)`)

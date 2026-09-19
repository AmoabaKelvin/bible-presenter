// Why did (or didn't) a spoken quote match? Shows the top verses with both
// kinds of score next to the thresholds. Usage: bun scripts/quote-why.ts "he gave gifts unto men"
import { readFile } from "node:fs/promises"
import { pipeline } from "@huggingface/transformers"
import { pickQuote, stripLeadIn, type VerseIndex } from "@/lib/voice-quote"

const dir = "public/bibles/embeddings"
const read = async (file: string) => {
  try { return await readFile(file) } catch {
    const parts: Buffer[] = []
    for (let part = 0; ; part++) { try { parts.push(await readFile(`${file}.part${part}`)) } catch { break } }
    return Buffer.concat(parts)
  }
}
const indexes: (VerseIndex & { version: string })[] = []
for (const version of ["bsb", "kjv", "niv"]) {
  const vectors = await readFile(`${dir}/${version}.bin`)
  const index: VerseIndex & { version: string } = { version, vectors: new Int8Array(vectors.buffer, vectors.byteOffset, vectors.length), refs: JSON.parse(await readFile(`${dir}/${version}.refs.json`, "utf8")) }
  const phrases = await read(`${dir}/${version}.phrases.bin`)
  if (phrases.length) {
    const offsets = await readFile(`${dir}/${version}.phrases.idx`)
    index.phrases = { vectors: new Int8Array(phrases.buffer, phrases.byteOffset, phrases.length), offsets: new Uint32Array(offsets.buffer, offsets.byteOffset, offsets.length / 4) }
  }
  indexes.push(index)
}
const meta = JSON.parse(await readFile(`${dir}/meta.json`, "utf8"))
const extractor = await pipeline("feature-extraction", meta.model, { dtype: "q8" })

for (const text of process.argv.slice(2)) {
  const { quote, hadLeadIn } = stripLeadIn(text)
  const query = (await extractor(meta.queryPrefix + quote, { pooling: "mean", normalize: true })).data as Float32Array
  const dot = (vectors: Int8Array, row: number) => { let sum = 0; for (let d = 0; d < query.length; d++) sum += query[d] * vectors[row * query.length + d]; return sum / 127 }
  const rows: { ref: string; version: string; whole: number; phrase: number }[] = []
  for (const index of indexes) for (let row = 0; row < index.refs.length; row++) {
    let phrase = 0
    const whole = dot(index.vectors, row)
    if (index.phrases && whole > 0.5) for (let p = index.phrases.offsets[row]; p < index.phrases.offsets[row + 1]; p++) phrase = Math.max(phrase, dot(index.phrases.vectors, p))
    rows.push({ ref: index.refs[row], version: index.version, whole, phrase })
  }
  const match = pickQuote(query, indexes, hadLeadIn)
  console.log(`\n"${text}" (${quote.split(/\s+/).length} words${hadLeadIn ? ", lead-in" : ""}) -> ${match ? `${match.reference} score ${match.score.toFixed(2)} margin ${match.margin.toFixed(2)}${match.viaPhrase ? " via clause" : ""}` : "NO MATCH"}`)
  console.log("  by whole verse (needs 0.76, lead 0.06):  " + [...rows].sort((a, b) => b.whole - a.whole).slice(0, 5).map((r) => `${r.ref}[${r.version}] ${r.whole.toFixed(2)}`).join("  "))
  console.log("  by clause      (needs 0.82, lead 0.06):  " + [...rows].sort((a, b) => b.phrase - a.phrase).slice(0, 5).map((r) => `${r.ref}[${r.version}] ${r.phrase.toFixed(2)}`).join("  "))
}

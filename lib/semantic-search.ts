// Client-side semantic ("find by meaning") scripture search.
//
// Loads a small sentence-embedding model (transformers.js) plus the int8
// vector blobs built by scripts/build-embeddings.mjs, embeds the query in the
// browser, and ranks verses by cosine similarity across the BSB, KJV and NIV
// indexes — the same ones voice quote detection uses. Returns the same
// { reference, text, highlight } shape as the lexical path so the existing
// search UI is unchanged.
//
// Meaning matters more than exact words here: "city on a hill", "love is
// patient", or "do not worry about tomorrow" land on the right verse even
// when the user isn't quoting it.

import type { ScriptureSearchResponse } from "@/lib/scripture-search"

type Meta = {
  version: string
  model: string
  dim: number
  count: number
  quant: string
  queryPrefix: string
}

export type PhraseIndex = { vectors: Int8Array; offsets: Uint32Array }
export type VerseIndex = {
  vectors: Int8Array
  refs: string[]
  // Clause windows of this translation's long verses, grouped by verse:
  // rows offsets[i] until offsets[i + 1] belong to verse i.
  phrases?: PhraseIndex
}

// Loaded once, reused across queries. The engine is itself the BSB index.
type Engine = VerseIndex & {
  embed: (text: string) => Promise<Float32Array>
  textByRef: Map<string, string>
  meta: Meta
}

const MAX_RANKED = 300
// Verses taken from each translation before clause scoring and merging.
const PER_INDEX_CANDIDATES = 100

let enginePromise: Promise<Engine | null> | null = null

// Pull the embedding model + index + BSB text, wiring them into one engine.
// Returns null if the build artifacts aren't present (assets not generated).
async function buildEngine(): Promise<Engine | null> {
  try {
    const [metaRes, refsRes, binRes, bsbRes] = await Promise.all([
      fetch("/bibles/embeddings/meta.json"),
      fetch("/bibles/embeddings/bsb.refs.json"),
      fetch("/bibles/embeddings/bsb.bin"),
      fetch("/bibles/bsb.json"),
    ])
    if (!metaRes.ok || !refsRes.ok || !binRes.ok || !bsbRes.ok) return null

    const meta: Meta = await metaRes.json()
    const refs: string[] = await refsRes.json()
    const vectors = new Int8Array(await binRes.arrayBuffer())
    const bsb: { chapters: Record<string, { number: number; text: string }[]> } =
      await bsbRes.json()

    if (vectors.length !== meta.count * meta.dim || refs.length !== meta.count) {
      console.warn("[semantic] index/meta mismatch — skipping semantic search")
      return null
    }

    // Map each reference to its BSB text, aligned to the vector rows.
    const textByRef = new Map<string, string>()
    for (const [key, verses] of Object.entries(bsb.chapters)) {
      const sep = key.lastIndexOf(":")
      const book = key.slice(0, sep)
      const chapter = key.slice(sep + 1)
      for (const v of verses) {
        textByRef.set(`${book} ${chapter}:${v.number}`, v.text)
      }
    }

    // transformers.js is heavy and browser-only — load it lazily.
    // "#transformers" maps to the real package in the browser and to a stub
    // on the server (package.json "imports") so onnxruntime-node never lands
    // in the server bundle.
    const { pipeline, env } = await import("#transformers")
    // Serve the model + ONNX-runtime WASM from our own origin (see
    // scripts/fetch-model.mjs) so meaning-search works fully offline — no
    // HuggingFace/CDN at runtime. Single-threaded because the app isn't
    // cross-origin isolated (no SharedArrayBuffer).
    env.allowRemoteModels = false
    env.allowLocalModels = true
    env.localModelPath = "/models/"
    const wasm = env.backends?.onnx?.wasm
    if (wasm) {
      wasm.wasmPaths = "/ort/"
      wasm.numThreads = 1
    }
    // Cloudflare Workers static assets cap files at 25 MiB, so the .onnx
    // model ships as split .partN files; reassemble them through the
    // transformers.js custom-cache hook. The service worker caches the parts
    // (they live under /models/), keeping offline behavior intact.
    env.useCustomCache = true
    env.customCache = {
      match: async (key: string) => {
        if (!key.startsWith("/models/") || !key.endsWith(".onnx")) return undefined
        const parts: Blob[] = []
        for (let i = 0; ; i++) {
          const res = await fetch(`${key}.part${i}`)
          if (!res.ok) {
            if (i === 0) return undefined
            break
          }
          parts.push(await res.blob())
        }
        const blob = new Blob(parts)
        return new Response(blob, {
          headers: { "content-length": String(blob.size) },
        })
      },
      put: async () => {},
    }
    const extractor = await pipeline("feature-extraction", meta.model, {
      dtype: "q8",
    })

    const embed = async (text: string): Promise<Float32Array> => {
      const out = await extractor(meta.queryPrefix + text, {
        pooling: "mean",
        normalize: true,
      })
      return out.data as Float32Array
    }

    return { embed, vectors, refs, textByRef, meta }
  } catch (err) {
    console.warn("[semantic] failed to initialize", err)
    return null
  }
}

export function loadSemanticEngine(): Promise<Engine | null> {
  if (!enginePromise) enginePromise = buildEngine()
  return enginePromise
}

// Whether the semantic index is available without forcing a model download.
export async function hasSemanticIndex(): Promise<boolean> {
  try {
    const res = await fetch("/bibles/embeddings/meta.json", { method: "HEAD" })
    return res.ok
  } catch {
    return false
  }
}

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Highlight any query words that happen to appear — a bonus on top of the
// meaning match, since semantic hits often don't share the query's wording.
function highlight(text: string, query: string): string {
  const terms = query.trim().split(/\s+/).filter((t) => t.length > 2)
  if (terms.length === 0) return text
  const re = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi")
  return text.replace(re, "<em>$1</em>")
}

// Translations preachers quote from, beyond BSB. Only KJV ships clause
// windows; see scripts/build-embeddings.mjs for why.
const EXTRA_VERSIONS = ["kjv", "niv"]
let extraIndexes: Promise<VerseIndex[]> | null = null
let loadedExtraIndexes: VerseIndex[] = []

// Offline, a missing file rejects instead of returning 404, and an
// unhandled rejection here used to drop a whole translation silently.
const file = async (name: string) => {
  try {
    const res = await fetch(`/bibles/embeddings/${name}`)
    return res.ok ? res : null
  } catch {
    return null
  }
}

// A blob over Cloudflare's 25 MiB asset cap ships as .part0, .part1 …
// (scripts/build-embeddings.mjs). Whole file first, parts if it isn't there.
async function fetchVectors(name: string): Promise<Int8Array | null> {
  const whole = await file(name)
  if (whole) return new Int8Array(await whole.arrayBuffer())
  const parts: ArrayBuffer[] = []
  for (let part = 0; ; part++) {
    const res = await file(`${name}.part${part}`)
    if (!res) break
    parts.push(await res.arrayBuffer())
  }
  if (parts.length === 0) return null
  const vectors = new Int8Array(parts.reduce((total, part) => total + part.byteLength, 0))
  let at = 0
  for (const part of parts) {
    vectors.set(new Int8Array(part), at)
    at += part.byteLength
  }
  return vectors
}

async function fetchIndex(version: string): Promise<VerseIndex | null> {
  const [vectors, refs] = await Promise.all([fetchVectors(`${version}.bin`), file(`${version}.refs.json`)])
  if (!vectors || !refs) return null
  const index: VerseIndex = { vectors, refs: await refs.json() }
  const [phraseVectors, phraseIdx] = await Promise.all([
    fetchVectors(`${version}.phrases.bin`),
    file(`${version}.phrases.idx`),
  ])
  if (phraseVectors && phraseIdx) {
    index.phrases = { vectors: phraseVectors, offsets: new Uint32Array(await phraseIdx.arrayBuffer()) }
  }
  return index
}

// The KJV and NIV indexes (~70 MB with KJV clause windows), fetched once.
export function loadExtraIndexes(): Promise<VerseIndex[]> {
  extraIndexes ??= Promise.all(EXTRA_VERSIONS.map((v) => fetchIndex(v).catch(() => null))).then(
    (loaded) => {
      loadedExtraIndexes = loaded.filter((index): index is VerseIndex => index !== null)
      return loadedExtraIndexes
    },
  )
  return extraIndexes
}

export function dotRow(query: Float32Array, vectors: Int8Array, row: number): number {
  const dim = query.length
  let sum = 0
  for (let d = 0, base = row * dim; d < dim; d++) sum += query[d] * vectors[base + d]
  return sum / 127
}

// Best match per verse across translations. Each index contributes its top
// whole-verse candidates, and a candidate with clause windows also scores its
// best clause, so a quoted fragment of a long verse still lands on it.
// Measured on the voice + search eval set: top-1 went from 31/38 (BSB only)
// to 34/38, mostly KJV wording ("charity suffereth long" #54 → #1).
function rankVerses(query: Float32Array, indexes: VerseIndex[]): { reference: string; score: number }[] {
  const best = new Map<string, number>()
  const scores = new Float32Array(Math.max(...indexes.map((index) => index.refs.length)))
  for (const index of indexes) {
    for (let row = 0; row < index.refs.length; row++) scores[row] = dotRow(query, index.vectors, row)
    for (const row of topKIndices(scores.subarray(0, index.refs.length), PER_INDEX_CANDIDATES)) {
      let score = scores[row]
      const phrases = index.phrases
      if (phrases) {
        for (let p = phrases.offsets[row]; p < phrases.offsets[row + 1]; p++) {
          score = Math.max(score, dotRow(query, phrases.vectors, p))
        }
      }
      const reference = index.refs[row]
      if (score > (best.get(reference) ?? -Infinity)) best.set(reference, score)
    }
  }
  return [...best]
    .map(([reference, score]) => ({ reference, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RANKED)
}

export async function semanticSearch(
  query: string,
  { limit = 25, offset = 0 }: { limit?: number; offset?: number },
): Promise<ScriptureSearchResponse> {
  const engine = await loadSemanticEngine()
  if (!engine) return { query, total: 0, limit, offset, results: [] }

  // KJV/NIV join as soon as they have downloaded; a search never waits on them.
  void loadExtraIndexes()
  const ranked = rankVerses(await engine.embed(query), [engine, ...loadedExtraIndexes])
  return {
    query,
    total: ranked.length,
    limit,
    offset,
    results: ranked.slice(offset, offset + limit).map(({ reference }) => {
      const text = engine.textByRef.get(reference) ?? ""
      return { reference, text, highlight: highlight(text, query) }
    }),
  }
}

// Return the indices of the k highest scores, in descending score order, via a
// size-k min-heap: one pass over all scores, O(n log k) instead of sorting n.
function topKIndices(scores: Float32Array, k: number): number[] {
  const n = scores.length
  const size = Math.min(k, n)
  const heap = new Int32Array(size) // indices; heap[0] is the smallest score
  let count = 0

  const swap = (a: number, b: number) => {
    const t = heap[a]
    heap[a] = heap[b]
    heap[b] = t
  }
  const siftUp = (i: number) => {
    while (i > 0) {
      const p = (i - 1) >> 1
      if (scores[heap[i]] < scores[heap[p]]) {
        swap(i, p)
        i = p
      } else break
    }
  }
  const siftDown = (i: number) => {
    for (;;) {
      const l = 2 * i + 1
      const r = 2 * i + 2
      let m = i
      if (l < count && scores[heap[l]] < scores[heap[m]]) m = l
      if (r < count && scores[heap[r]] < scores[heap[m]]) m = r
      if (m === i) break
      swap(i, m)
      i = m
    }
  }

  for (let i = 0; i < n; i++) {
    if (count < size) {
      heap[count] = i
      siftUp(count)
      count++
    } else if (scores[i] > scores[heap[0]]) {
      heap[0] = i
      siftDown(0)
    }
  }

  return Array.from(heap.subarray(0, count)).sort(
    (a, b) => scores[b] - scores[a],
  )
}

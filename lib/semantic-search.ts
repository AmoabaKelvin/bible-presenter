// Client-side semantic ("find by meaning") scripture search.
//
// Loads a small sentence-embedding model (transformers.js) plus the int8
// vector blob built by scripts/build-embeddings.mjs, embeds the query in the
// browser, and ranks every BSB verse by cosine similarity. Returns the same
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

// Loaded once, reused across queries.
type Engine = {
  embed: (text: string) => Promise<Float32Array>
  vectors: Int8Array
  refs: string[]
  texts: string[]
  meta: Meta
}

const MAX_RANKED = 300

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
    const texts = refs.map((r) => textByRef.get(r) ?? "")

    // transformers.js is heavy and browser-only — load it lazily.
    const { pipeline, env } = await import("@huggingface/transformers")
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

    return { embed, vectors, refs, texts, meta }
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

export async function semanticSearch(
  query: string,
  { limit = 25, offset = 0 }: { limit?: number; offset?: number },
): Promise<ScriptureSearchResponse> {
  const engine = await loadSemanticEngine()
  if (!engine) return { query, total: 0, limit, offset, results: [] }

  const { embed, vectors, refs, texts, meta } = engine
  const dim = meta.dim
  const q = await embed(query)

  // Cosine over unit-normalized query vs int8 verse vectors. The int8 scale
  // (1/127) is a constant across rows, so we can rank on the raw dot product.
  // Scores go into a typed array (no per-verse objects), and a fixed-size heap
  // selects the top candidates without sorting all ~31k rows — this runs on
  // every keystroke, so it stays off the allocator's back.
  const scores = new Float32Array(meta.count)
  for (let i = 0; i < meta.count; i++) {
    const base = i * dim
    let dot = 0
    for (let d = 0; d < dim; d++) dot += q[d] * vectors[base + d]
    scores[i] = dot
  }

  const top = topKIndices(scores, MAX_RANKED)
  const page = top.slice(offset, offset + limit)
  return {
    query,
    total: top.length,
    limit,
    offset,
    results: page.map((i) => ({
      reference: refs[i],
      text: texts[i],
      highlight: highlight(texts[i], query),
    })),
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

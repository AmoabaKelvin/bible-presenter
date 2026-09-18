// "That's why the Bible says eyes have not seen, ears have not heard…" — no
// reference spoken, just the words. Find the verse being quoted with the
// offline "find by meaning" indexes, and only speak up when it's clearly one
// verse: a wrong verse on the projector is worse than none.
// Thresholds come from: bun scripts/eval-quote-threshold.ts
// ponytail: ~130 ms on the main thread per sentence (embed + search of ~80 MB
// of vectors). Move into a worker if the UI stutters while someone talks.

export type PhraseIndex = { vectors: Int8Array; offsets: Uint32Array }
export type VerseIndex = {
  vectors: Int8Array
  refs: string[]
  // Clause windows of this translation's long verses, grouped by verse:
  // rows offsets[i] until offsets[i + 1] belong to verse i.
  phrases?: PhraseIndex
}
export type QuoteMatch = { reference: string; score: number; margin: number; viaPhrase: boolean }

// Everything up to and including the last of these is preamble, not quote.
const LEAD_IN =
  /^.*\b(?:the bible (?:says|said|tells us|declares)|(?:the )?scriptures? (?:says?|said|tells us|declares?)|the word of god (?:says|said)|(?:as )?it is written|(?:jesus|paul|david|the lord|god) (?:said|says)|the psalmist (?:said|says))\b(?: that)?/i
const MIN_WORDS = 4
// Cosine of the best verse, and its lead over the best *different* passage.
// Ordinary sermon talk scores up to ~0.74 against some verse but never leads
// by much; a real quote leads clearly.
const MIN_SCORE = 0.76
// 0.05 let "we need to pray for our nation and for our leaders" through as
// 1 Thessalonians 5:25. Real quotes in the sample lead by 0.07 or more.
const MIN_MARGIN = 0.06
// With "the Bible says…" in front we already know a quote is coming, so a
// weaker match will do — but it must still clearly beat its rivals: relaxing
// the margin too let a loose "eyes have not seen…" through as Mark 8:18.
const MIN_SCORE_AFTER_LEAD_IN = 0.7
// A short clause matches a short query more easily than a whole verse does,
// so a phrase-derived win has to be stronger to count.
const MIN_SCORE_PHRASE = 0.82
const MIN_MARGIN_PHRASE = 0.06
// Verses whose clauses are worth scoring. Generous: the whole-verse score of a
// quoted fragment can be mediocre (that is the problem phrases solve), it just
// can't be nowhere.
const CANDIDATES = 48
// Gospel parallels and the same verse in another translation say the same
// thing; they aren't rivals, so they don't count against the margin.
const SAME_PASSAGE_COSINE = 0.8

export function stripLeadIn(text: string): { quote: string; hadLeadIn: boolean } {
  const quote = text.replace(LEAD_IN, "").trim()
  return { quote, hadLeadIn: quote.length !== text.trim().length }
}

function dot(query: Float32Array, vectors: Int8Array, row: number): number {
  const dim = query.length
  let sum = 0
  for (let d = 0, base = row * dim; d < dim; d++) sum += query[d] * vectors[base + d]
  return sum / 127
}

type Candidate = { reference: string; index: VerseIndex; row: number; whole: number; phrase: number }

// Best candidate on one kind of score, accepted only if it clearly beats the
// best *different* passage on that same kind of score.
function verdict(
  candidates: Candidate[],
  score: (candidate: Candidate) => number,
  query: Float32Array,
  minScore: number,
  minMargin: number,
): QuoteMatch | null {
  const ranked = [...candidates].sort((a, b) => score(b) - score(a))
  const best = ranked[0]
  if (!best || score(best) < minScore) return null

  const dim = query.length
  const samePassage = (other: Candidate) => {
    if (other.reference === best.reference) return true
    let sum = 0
    for (let d = 0; d < dim; d++) sum += best.index.vectors[best.row * dim + d] * other.index.vectors[other.row * dim + d]
    return sum / (127 * 127) >= SAME_PASSAGE_COSINE
  }
  const rival = ranked.find((candidate) => !samePassage(candidate))
  const margin = score(best) - (rival ? score(rival) : 0)
  return margin >= minMargin
    ? { reference: best.reference, score: score(best), margin, viaPhrase: score === phraseScore }
    : null
}

const wholeScore = (candidate: Candidate) => candidate.whole
const phraseScore = (candidate: Candidate) => candidate.phrase

export function pickQuote(query: Float32Array, indexes: VerseIndex[], hadLeadIn: boolean): QuoteMatch | null {
  // Coarse pass: whole verses, every translation.
  const candidates: Candidate[] = []
  for (const index of indexes) {
    const top: Candidate[] = []
    for (let row = 0; row < index.refs.length; row++) {
      const whole = dot(query, index.vectors, row)
      if (top.length < CANDIDATES || whole > top[top.length - 1].whole) {
        top.push({ reference: index.refs[row], index, row, whole, phrase: 0 })
        top.sort((a, b) => b.whole - a.whole)
        if (top.length > CANDIDATES) top.pop()
      }
    }
    candidates.push(...top)
  }

  // Fine pass: the candidates' own clauses, so a fragment of a long verse
  // isn't drowned out by the rest of it. Only these few verses are scored,
  // which keeps a 100k-row phrase index off the critical path.
  for (const candidate of candidates) {
    const phrases = candidate.index.phrases
    if (!phrases) continue
    for (let row = phrases.offsets[candidate.row]; row < phrases.offsets[candidate.row + 1]; row++) {
      candidate.phrase = Math.max(candidate.phrase, dot(query, phrases.vectors, row))
    }
  }

  // Two independent verdicts: the whole verse matched, or one of its clauses
  // did. Kept separate because scoring clauses lifts rivals as well as the
  // answer, which would otherwise erase the margin on short verses. The
  // whole-verse verdict wins ties: more context, more reliable.
  return (
    verdict(candidates, wholeScore, query, hadLeadIn ? MIN_SCORE_AFTER_LEAD_IN : MIN_SCORE, MIN_MARGIN) ??
    verdict(candidates, phraseScore, query, MIN_SCORE_PHRASE, MIN_MARGIN_PHRASE)
  )
}

// Translations preachers quote from, beyond the BSB index the app already
// loads for Cmd+K. Fetched once, on the first quote. Only KJV ships clause
// windows; see scripts/build-embeddings.mjs for why.
const QUOTED_VERSIONS = ["kjv", "niv"]
let extraIndexes: Promise<VerseIndex[]> | null = null

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

// Pull the indexes down while the mic is being switched on, so the first quote
// is instant and a service that starts offline still has them.
export function warmQuoteIndexes() {
  void loadExtraIndexes()
}

function loadExtraIndexes(): Promise<VerseIndex[]> {
  extraIndexes ??= Promise.all(QUOTED_VERSIONS.map((v) => fetchIndex(v).catch(() => null))).then(
    (loaded) => loaded.filter((index): index is VerseIndex => index !== null),
  )
  return extraIndexes
}

export async function matchQuote(text: string): Promise<QuoteMatch | null> {
  const { quote, hadLeadIn } = stripLeadIn(text)
  if (quote.split(/\s+/).length < MIN_WORDS) return null
  const { loadSemanticEngine } = await import("@/lib/semantic-search")
  const [engine, extra] = await Promise.all([loadSemanticEngine(), loadExtraIndexes()])
  if (!engine) return null
  return pickQuote(await engine.embed(quote), [engine, ...extra], hadLeadIn)
}

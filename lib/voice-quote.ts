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
export type QuoteMatch = { reference: string; score: number; margin: number; viaPhrase: boolean; verbatim?: boolean }

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
// And a few words of Bible-sounding talk ("and he said unto them", "the
// children of israel") sit close to a clause of *some* verse: those came back
// as Luke 24:19 and Amos 9:7. The shortest real clause quote in the sample is
// six words ("by his stripes we are healed").
const MIN_WORDS_PHRASE = 6
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

export function pickQuote(
  query: Float32Array,
  indexes: VerseIndex[],
  hadLeadIn: boolean,
  wordCount = Infinity,
): QuoteMatch | null {
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
    (wordCount >= MIN_WORDS_PHRASE ? verdict(candidates, phraseScore, query, MIN_SCORE_PHRASE, MIN_MARGIN_PHRASE) : null)
  )
}

// ---- Verbatim fragments -----------------------------------------------------
// "…and gave gifts unto men." A few words lifted from a verse don't *mean* what
// the verse means (Ephesians 4:8 is mostly about ascending and captivity), so
// the embedding search can't find them: that fragment scored 0.73 with the
// right verse nowhere in the top five. But the words themselves give it away:
// "gave gifts unto men" occurs in exactly one verse of the KJV. So: a run of
// consecutive words from the transcript that occurs in one verse only.
// Four words, not three: "our nation and" — ordinary talk — is unique to Luke 7:5.
// Unique isn't distinctive, though: "was a young man" is unique to Judges 17:7
// and "i will say of the lord" to Psalm 91:2, and a preacher says both in
// passing. So the run must also hold a word the Bible itself rarely uses
// ("gifts", "captivity", "medicine"), and be most of what was said — or long.
// Measured with: bun scripts/eval-quote-threshold.ts
const RUN_WORDS = 4
const RARE_WORD_VERSES = 150
const RUN_COVERAGE = 0.6
const LONG_RUN_WORDS = 6
// At least this many of the run's words must carry meaning ("and it came to" doesn't).
const RUN_CONTENT_WORDS = 2
const FILLER = new Set(
  "a all am an and are as at be but by did do for from had has hast hath have he her him his i in into is it me my no not of on or our shall she so that the thee their them then there they this thou thy to unto up upon us was we were what when which who will with ye you your".split(" "),
)
const AMBIGUOUS = -1

export type VerbatimIndex = { refs: string[]; words: string[][]; runs: Map<number, number>; verseCount: Map<string, number> }

const wordsOf = (text: string) => text.toLowerCase().replace(/'/g, "").replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean)

// FNV-1a. A Map keyed by the joined strings of ~780k runs costs several times
// the memory; collisions are harmless because every hit is checked against the verse.
function hashRun(words: string[], start: number): number {
  let hash = 0x811c9dc5
  for (let w = start; w < start + RUN_WORDS; w++) {
    for (let c = 0; c < words[w].length; c++) hash = Math.imul(hash ^ words[w].charCodeAt(c), 0x01000193)
    hash = Math.imul(hash ^ 32, 0x01000193)
  }
  return hash
}

export function buildVerbatimIndex(verses: { reference: string; text: string }[]): VerbatimIndex {
  const index: VerbatimIndex = { refs: [], words: [], runs: new Map(), verseCount: new Map() }
  verses.forEach(({ reference, text }, row) => {
    const words = wordsOf(text)
    for (const word of new Set(words)) index.verseCount.set(word, (index.verseCount.get(word) ?? 0) + 1)
    index.refs.push(reference)
    index.words.push(words)
    for (let start = 0; start + RUN_WORDS <= words.length; start++) {
      const hash = hashRun(words, start)
      const seen = index.runs.get(hash)
      if (seen === undefined) index.runs.set(hash, row)
      else if (seen !== row) index.runs.set(hash, AMBIGUOUS)
    }
  })
  return index
}

export function pickVerbatim(text: string, index: VerbatimIndex): QuoteMatch | null {
  const heard = wordsOf(text)
  let best: { row: number; length: number } | null = null
  let tied = false
  for (let start = 0; start + RUN_WORDS <= heard.length; start++) {
    const row = index.runs.get(hashRun(heard, start))
    if (row === undefined || row === AMBIGUOUS) continue
    const verse = index.words[row]
    // Where in the verse, and how far the agreement runs past the four words.
    let length = 0
    for (let at = 0; at + RUN_WORDS <= verse.length && length === 0; at++) {
      let same = 0
      while (start + same < heard.length && at + same < verse.length && heard[start + same] === verse[at + same]) same++
      if (same >= RUN_WORDS) length = same
    }
    if (length === 0) continue // hash collision
    const run = heard.slice(start, start + length)
    if (run.filter((word) => !FILLER.has(word)).length < RUN_CONTENT_WORDS) continue
    if (!run.some((word) => (index.verseCount.get(word) ?? 0) <= RARE_WORD_VERSES)) continue
    if (length < LONG_RUN_WORDS && length / heard.length < RUN_COVERAGE) continue
    if (!best || length > best.length) { best = { row, length }; tied = false }
    else if (length === best.length && row !== best.row) tied = true
  }
  // Two verses equally well quoted in one breath: don't guess.
  if (!best || tied) return null
  return { reference: index.refs[best.row], score: 1, margin: 1, viaPhrase: true, verbatim: true }
}

let verbatimIndex: Promise<VerbatimIndex | null> | null = null
// KJV only: it is what gets quoted from memory, word for word.
function loadVerbatimIndex(): Promise<VerbatimIndex | null> {
  verbatimIndex ??= (async () => {
    const res = await fetch("/bibles/kjv.json")
    if (!res.ok) return null
    const bible: { chapters: Record<string, { number: number; text: string }[]> } = await res.json()
    return buildVerbatimIndex(
      Object.entries(bible.chapters).flatMap(([key, verses]) => {
        const at = key.lastIndexOf(":")
        return verses.map((verse) => ({ reference: `${key.slice(0, at)} ${key.slice(at + 1)}:${verse.number}`, text: verse.text }))
      }),
    )
  })().catch(() => null)
  return verbatimIndex
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
  void loadVerbatimIndex()
  // The embedding model too, or the first quote of the service lands seconds late.
  void import("@/lib/semantic-search").then(({ loadSemanticEngine }) => loadSemanticEngine())
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
  const [engine, extra, verbatim] = await Promise.all([loadSemanticEngine(), loadExtraIndexes(), loadVerbatimIndex()])
  // Meaning first: it has the whole sentence to go on. Exact words catch the fragments it can't.
  return (engine && pickQuote(await engine.embed(quote), [engine, ...extra], hadLeadIn, quote.split(/\s+/).length)) || (verbatim && pickVerbatim(quote, verbatim))
}

// Lets the desktop smoke test check quote matching inside the packaged runtime.
if (typeof window !== "undefined" && window.flowcastDesktop) Object.assign(window, { flowcastMatchQuote: matchQuote })

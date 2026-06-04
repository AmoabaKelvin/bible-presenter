// Fusion logic for unified scripture search.
//
// Lexical search (exact/fuzzy, against the active version) and semantic search
// (meaning, against the bundled BSB embeddings) run as two independent ranked
// lists. Semantic is the trustworthy "find by meaning" signal, so it leads:
// the top semantic matches are placed first, then the remainder of both lists
// is blended with Reciprocal Rank Fusion. This keeps a loose lexical/fuzzy hit
// (e.g. "fourth" fuzzily matching "forth") from outranking the verse the model
// actually identified, while still surfacing exact and fuzzy matches below.
//
// The two searches are run separately (and progressively) by the search hook
// so exact results can paint before the slower semantic pass resolves; this
// module only owns the merge.

import type { ScriptureSearchResult } from "@/lib/scripture-search"

// How many candidates to pull from each method before fusing. Lexical is
// precise so we take more; semantic is kept tighter to limit thematic noise.
export const LEXICAL_CANDIDATES = 40
export const SEMANTIC_CANDIDATES = 25
// The top N semantic matches lead the results, ahead of the blended remainder.
const SEMANTIC_LEAD = 5
// RRF dampening constant — the standard default. Higher = flatter weighting.
const RRF_K = 60

function refKey(reference: string): string {
  return reference.trim().toLowerCase()
}

// Semantic-led fusion: the strongest meaning matches lead, then everything
// else is blended by Reciprocal Rank Fusion (a verse both methods rank highly
// rises within the blended tail). Deduped by reference.
export function fuse(
  lexical: ScriptureSearchResult[],
  semantic: ScriptureSearchResult[],
): ScriptureSearchResult[] {
  const pick = new Map<string, ScriptureSearchResult>()
  semantic.forEach((r) => {
    const k = refKey(r.reference)
    if (!pick.has(k)) pick.set(k, r)
  })
  lexical.forEach((r) => {
    const k = refKey(r.reference)
    if (!pick.has(k)) pick.set(k, r) // only used when semantic missed this verse
  })

  // Reserve the leading slots for the top semantic matches.
  const leadKeys: string[] = []
  const reserved = new Set<string>()
  for (const r of semantic.slice(0, SEMANTIC_LEAD)) {
    const k = refKey(r.reference)
    if (!reserved.has(k)) {
      reserved.add(k)
      leadKeys.push(k)
    }
  }

  // RRF the remainder of both lists (skipping anything already reserved).
  const score = new Map<string, number>()
  const accumulate = (list: ScriptureSearchResult[]) =>
    list.forEach((r, i) => {
      const k = refKey(r.reference)
      if (reserved.has(k)) return
      score.set(k, (score.get(k) ?? 0) + 1 / (RRF_K + i))
    })
  accumulate(lexical)
  accumulate(semantic)

  const tailKeys = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)

  return [...leadKeys, ...tailKeys].map((k) => pick.get(k)!)
}

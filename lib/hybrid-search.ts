// Fusion logic for unified scripture search.
//
// Lexical search (exact, against the active version) and semantic search
// (meaning, against the bundled BSB embeddings) run as two independent ranked
// lists. They are combined with Reciprocal Rank Fusion: a verse both methods
// rank highly rises to the top, while exact-only and meaning-only hits still
// place fairly — without comparing incompatible score scales.
//
// The two searches are run separately (and progressively) by the search hook
// so exact results can paint before the slower semantic pass resolves; this
// module only owns the merge.

import type { ScriptureSearchResult } from "@/lib/scripture-search"

// How many candidates to pull from each method before fusing. Lexical is
// precise so we take more; semantic is kept tighter to limit thematic noise.
export const LEXICAL_CANDIDATES = 40
export const SEMANTIC_CANDIDATES = 25
// RRF dampening constant — the standard default. Higher = flatter weighting.
const RRF_K = 60

function refKey(reference: string): string {
  return reference.trim().toLowerCase()
}

// Fuse two ranked lists by summed reciprocal rank, deduped by reference.
// Lexical text wins on ties since it's already in the reader's version.
export function fuse(
  lexical: ScriptureSearchResult[],
  semantic: ScriptureSearchResult[],
): ScriptureSearchResult[] {
  const score = new Map<string, number>()
  const pick = new Map<string, ScriptureSearchResult>()

  lexical.forEach((r, i) => {
    const k = refKey(r.reference)
    score.set(k, (score.get(k) ?? 0) + 1 / (RRF_K + i))
    if (!pick.has(k)) pick.set(k, r)
  })
  semantic.forEach((r, i) => {
    const k = refKey(r.reference)
    score.set(k, (score.get(k) ?? 0) + 1 / (RRF_K + i))
    if (!pick.has(k)) pick.set(k, r) // only used when lexical missed this verse
  })

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => pick.get(k)!)
}

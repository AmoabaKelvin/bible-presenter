// Re-rank search hits by how well they match the query and drop duplicates.
// LRCLIB's API isn't relevance-ranked (it can bury an exact title match under
// loose matches), and both sources return repeats of the same song.

import type { LyricsHit } from "./types"

export function rankAndDedupe(hits: LyricsHit[], query: string): LyricsHit[] {
  const q = query.toLowerCase().trim()
  const words = q.split(/\s+/).filter(Boolean)

  const score = (h: LyricsHit): number => {
    const title = h.title.toLowerCase()
    const artist = h.artist.toLowerCase()
    let s = 0
    if (title === q) s += 1000
    if (title.startsWith(q)) s += 200
    if (title.includes(q)) s += 120
    if (words.length) {
      s += (words.filter((w) => title.includes(w)).length / words.length) * 100
      s += (words.filter((w) => artist.includes(w)).length / words.length) * 30
    }
    return s
  }

  const ranked = hits
    .map((h, i) => ({ h, s: score(h), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i) // ties keep original order
    .map((x) => x.h)

  const seen = new Set<string>()
  return ranked.filter((h) => {
    const key = `${h.title}|${h.artist}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

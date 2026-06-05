// Orchestrates the lyrics source chain: LRCLIB first (free, broad coverage),
// Genius as fallback when LRCLIB has no match and a token is configured.

import type { LyricsHit, LyricsSourceName } from "./types"
import { searchLrclib, fetchLrclibLyrics } from "./lrclib"
import { fetchGeniusLyrics, geniusEnabled, searchGenius } from "./genius"
import { rankAndDedupe } from "./rank"

export type { LyricsHit } from "./types"

export async function searchLyrics(
  query: string,
  signal?: AbortSignal,
): Promise<LyricsHit[]> {
  const lrclib = await searchLrclib(query, signal).catch(() => [])
  if (lrclib.length > 0) return rankAndDedupe(lrclib, query)
  if (geniusEnabled()) {
    const genius = await searchGenius(query, signal).catch(() => [])
    return rankAndDedupe(genius, query)
  }
  return []
}

const fetchers: Record<
  LyricsSourceName,
  (ref: string, signal?: AbortSignal) => Promise<string | null>
> = {
  lrclib: fetchLrclibLyrics,
  genius: fetchGeniusLyrics,
}

export async function fetchLyricsForHit(
  source: LyricsSourceName,
  ref: string,
  signal?: AbortSignal,
): Promise<string | null> {
  return fetchers[source]?.(ref, signal).catch(() => null) ?? null
}

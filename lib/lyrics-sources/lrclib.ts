// LRCLIB — free, no-auth lyrics database. Primary source. Search returns up to
// 20 records, each already carrying plain (and often synced) lyrics; we keep
// only records that actually have plain lyrics so a picked result always has
// something to project.

import type { LyricsHit } from "./types"

const BASE = "https://lrclib.net"
const UA = "FlowCast/0.1 (https://github.com/AmoabaKelvin/bible-presenter)"

interface LrclibRecord {
  id: number
  trackName?: string
  artistName?: string
  plainLyrics?: string | null
  instrumental?: boolean
}

// All LRCLIB calls share the same UA header and bail to null on a non-2xx.
async function lrclibGet<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { headers: { "User-Agent": UA }, signal })
  if (!res.ok) return null
  return (await res.json()) as T
}

export async function searchLrclib(
  query: string,
  signal?: AbortSignal,
): Promise<LyricsHit[]> {
  const data = await lrclibGet<LrclibRecord[]>(
    `/api/search?q=${encodeURIComponent(query)}`,
    signal,
  )
  if (!Array.isArray(data)) return []
  return data
    .filter((r) => !r.instrumental && (r.plainLyrics ?? "").trim() !== "")
    .map((r) => ({
      id: String(r.id),
      title: r.trackName ?? "",
      artist: r.artistName ?? "",
      thumbnail: "",
      source: "lrclib" as const,
      ref: String(r.id),
    }))
    .filter((h) => h.title)
}

export async function fetchLrclibLyrics(
  ref: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const data = await lrclibGet<LrclibRecord>(`/api/get/${ref}`, signal)
  return data?.plainLyrics?.trim() || null
}

// Client for the song search + lyrics proxy routes (app/api/lyrics/*).

export interface SongSearchResult {
  id: string
  title: string
  artist: string
  thumbnail: string
  source: "lrclib" | "genius"
  ref: string
}

export async function searchSongsOnline(
  query: string,
  signal?: AbortSignal,
): Promise<SongSearchResult[]> {
  const res = await fetch(`/api/lyrics/search?q=${encodeURIComponent(query)}`, { signal })
  if (!res.ok) throw new Error("Search failed. Please try again.")
  const data = (await res.json()) as { results?: SongSearchResult[] }
  return data.results ?? []
}

export async function fetchLyricsOnline(
  hit: SongSearchResult,
  signal?: AbortSignal,
): Promise<string> {
  const params = new URLSearchParams({ source: hit.source, ref: hit.ref })
  const res = await fetch(`/api/lyrics/fetch?${params}`, { signal })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? "No lyrics found for this song.")
  }
  const data = (await res.json()) as { lyrics: string }
  return data.lyrics
}

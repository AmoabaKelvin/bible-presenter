export type LyricsSourceName = "lrclib" | "genius"

// A search result from any source. `ref` is the source-specific handle used to
// fetch the full lyrics later (LRCLIB record id, or Genius page URL).
export interface LyricsHit {
  id: string
  title: string
  artist: string
  thumbnail: string
  source: LyricsSourceName
  ref: string
}

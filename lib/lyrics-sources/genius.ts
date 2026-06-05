// Genius — deep catalog, used as fallback. The API only exposes search +
// metadata, not lyrics, so we search via the API (needs GENIUS_ACCESS_TOKEN)
// then scrape the lyrics from the song page's [data-lyrics-container] elements.
// Genius serves a Cloudflare challenge to non-browser agents, so the page fetch
// must send a browser User-Agent.

import * as cheerio from "cheerio"
import type { LyricsHit } from "./types"

const TOKEN = process.env.GENIUS_ACCESS_TOKEN
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

export function geniusEnabled(): boolean {
  return !!TOKEN
}

interface GeniusHit {
  result: {
    id: number
    title?: string
    url?: string
    primary_artist?: { name?: string }
    song_art_image_thumbnail_url?: string
    song_art_image_url?: string
  }
}

export async function searchGenius(
  query: string,
  signal?: AbortSignal,
): Promise<LyricsHit[]> {
  if (!TOKEN) return []
  const res = await fetch(
    `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${TOKEN}` }, signal },
  )
  if (!res.ok) return []
  const data = (await res.json()) as { response?: { hits?: GeniusHit[] } }
  return (data.response?.hits ?? [])
    .map((h) => ({
      id: String(h.result.id),
      title: h.result.title ?? "",
      artist: h.result.primary_artist?.name ?? "",
      thumbnail:
        h.result.song_art_image_thumbnail_url ?? h.result.song_art_image_url ?? "",
      source: "genius" as const,
      ref: h.result.url ?? "",
    }))
    .filter((h) => h.title && h.ref && !isAggregatorTitle(h.title))
}

// Genius search sometimes ranks user list/playlist pages (e.g. "Top 5 Jams of
// 2014") above songs; those scrape to a tracklist, not lyrics. Drop them.
function isAggregatorTitle(title: string): boolean {
  return /\b(tracklist|setlist|playlist|top\s*\d|best\s+(of|songs)|\d+\s+(best|jams|hits|songs)|jams\s+of)\b/i.test(
    title,
  )
}

export async function fetchGeniusLyrics(
  url: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA }, signal })
  if (!res.ok) return null
  const html = await res.text()
  const $ = cheerio.load(html)

  const containers = $("[data-lyrics-container='true']")
  if (containers.length === 0) return null
  // Drop the contributor/credits header block Genius injects at the top.
  containers.find("[data-exclude-from-selection='true']").remove()
  // Convert line breaks before flattening nested annotation anchors to text.
  $("br").replaceWith("\n")

  const raw = containers
    .map((_, el) => $(el).text())
    .get()
    .join("\n")

  return normalizeGeniusLyrics(raw)
}

// Genius packs sections with "[Verse 1]" / "[Chorus]" headers but not always a
// blank line between them. Ensure a blank line precedes each header so the song
// parser splits sections (and lifts the headers into labels). Also strip the
// trailing "… Embed" artifact Genius appends.
function normalizeGeniusLyrics(text: string): string {
  let out = text.replace(/\r\n?/g, "\n")
  out = out.replace(/\n*(\[[^\]\n]+\])/g, "\n\n$1") // blank line before headers
  out = out.replace(/\d*Embed$/i, "") // trailing "…Embed" / "5Embed"
  out = out.replace(/\n{3,}/g, "\n\n").trim()
  return out || ""
}

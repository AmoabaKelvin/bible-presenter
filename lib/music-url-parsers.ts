export interface ParsedYouTubeRef {
  videoId?: string
  playlistId?: string
}

export type SpotifyContentType = "track" | "album" | "playlist" | "artist" | "episode" | "show"

export interface ParsedSpotifyRef {
  type: SpotifyContentType
  id: string
  uri: string
}

export const SPOTIFY_AUTH_SCOPES = [
  "streaming",
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
]

const SPOTIFY_URI_RE = /^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)$/
const SPOTIFY_ID_RE = /^[A-Za-z0-9]{10,}$/

export function parseYouTubeUrl(input: string): ParsedYouTubeRef | null {
  const raw = input.trim()
  if (!raw) return null

  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return { videoId: raw }
  if (/^(PL|RD|UU|OL|FL|LL)[A-Za-z0-9_-]{10,}$/.test(raw)) {
    return { playlistId: raw }
  }

  let url: URL
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "").replace(/^music\./, "")
  if (host !== "youtube.com" && host !== "youtu.be") return null

  if (host === "youtu.be") {
    const videoId = url.pathname.slice(1) || undefined
    const playlistId = url.searchParams.get("list") || undefined
    return videoId || playlistId ? { videoId, playlistId } : null
  }

  if (url.pathname === "/watch") {
    const videoId = url.searchParams.get("v") || undefined
    const playlistId = url.searchParams.get("list") || undefined
    return videoId || playlistId ? { videoId, playlistId } : null
  }
  if (url.pathname === "/playlist") {
    const playlistId = url.searchParams.get("list") || undefined
    return playlistId ? { playlistId } : null
  }

  const embedMatch = url.pathname.match(/^\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/)
  if (embedMatch) return { videoId: embedMatch[1] }
  return null
}

export function parseSpotifyRef(input: string): ParsedSpotifyRef | null {
  const raw = input.trim()
  if (!raw) return null

  const uriMatch = raw.match(SPOTIFY_URI_RE)
  if (uriMatch) {
    const type = uriMatch[1] as SpotifyContentType
    const id = uriMatch[2]
    return { type, id, uri: `spotify:${type}:${id}` }
  }

  let url: URL
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, "")
  if (host !== "open.spotify.com") return null

  const [typeRaw, idRaw] = url.pathname.split("/").filter(Boolean)
  if (!typeRaw || !idRaw) return null
  if (!["track", "album", "playlist", "artist", "episode", "show"].includes(typeRaw)) return null

  const id = idRaw.split("?")[0]
  if (!SPOTIFY_ID_RE.test(id)) return null

  const type = typeRaw as SpotifyContentType
  return { type, id, uri: `spotify:${type}:${id}` }
}

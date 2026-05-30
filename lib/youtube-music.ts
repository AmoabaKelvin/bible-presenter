// Shared types and helpers for the slideshow's YouTube music player.
// The operator window writes commands to localStorage; the slideshow
// window listens for them via the `storage` event, dispatches to the
// IFrame Player, and writes state back the other way.

export const MUSIC_COMMAND_KEY = "flowcastMusicCommand"
export const MUSIC_STATE_KEY = "flowcastMusicState"
export const MUSIC_URL_KEY = "flowcastMusicUrl"
export const MUSIC_VOLUME_KEY = "flowcastMusicVolume"
export const MUSIC_PROVIDER_KEY = "flowcastMusicProvider"

// The slideshow tab writes a timestamp here every couple of seconds so
// the operator can tell whether the output window is actually open.
export const SLIDESHOW_HEARTBEAT_KEY = "flowcastSlideshowHeartbeat"
export const SLIDESHOW_HEARTBEAT_INTERVAL_MS = 2000
export const SLIDESHOW_HEARTBEAT_STALE_MS = 5000

export type MusicCommand =
  | {
      id: string
      type: "load"
      provider?: "youtube"
      url?: string
      videoId?: string
      playlistId?: string
      playlistIndex?: number
      title?: string
      author?: string
      thumbnailUrl?: string
      autoplay?: boolean
    }
  | {
      id: string
      type: "load"
      provider: "spotify"
      uri: string
      contextUri?: string
      offsetUri?: string
      positionMs?: number
      autoplay?: boolean
    }
  | { id: string; type: "play"; provider?: MusicProvider }
  | { id: string; type: "pause"; provider?: MusicProvider }
  | { id: string; type: "next"; provider?: MusicProvider }
  | { id: string; type: "prev"; provider?: MusicProvider }
  | { id: string; type: "playAt"; provider?: MusicProvider; index: number }
  | { id: string; type: "seek"; provider?: MusicProvider; seconds: number }
  | { id: string; type: "volume"; provider?: MusicProvider; value: number }
  | { id: string; type: "stop"; provider?: MusicProvider }

// Distributive Omit so each variant of MusicCommand keeps its own
// fields. `Omit<A | B, K>` would collapse to common fields only.
export type MusicCommandInput = MusicCommand extends infer C
  ? C extends { id: string }
    ? Omit<C, "id">
    : never
  : never

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error"
export type MusicProvider = "youtube" | "spotify"

export interface MusicState {
  provider?: MusicProvider
  status: PlayerStatus
  videoId?: string
  uri?: string
  title?: string
  author?: string
  albumArtUrl?: string
  errorMessage?: string
  volume: number
  duration?: number
  currentTime?: number
  hasPlaylist?: boolean
  playlistVideoIds?: string[]
  playlistIndex?: number
}

export const DEFAULT_MUSIC_STATE: MusicState = {
  status: "idle",
  volume: 60,
}

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

  // Allow bare IDs too: 11-char video, ~34-char playlist starting with PL/RD/UU/OL/FL
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return { videoId: raw }
  if (/^(PL|RD|UU|OL|FL|LL)[A-Za-z0-9_-]{10,}$/.test(raw)) return { playlistId: raw }

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
  // youtube.com/embed/VIDEO_ID and shorts/VIDEO_ID
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

export function isSpotifyLoadCommand(
  cmd: MusicCommand,
): cmd is Extract<MusicCommand, { provider: "spotify"; type: "load" }> {
  return cmd.type === "load" && cmd.provider === "spotify"
}

export function makeCommandId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Shared types and helpers for the slideshow's YouTube music player.
// The operator window writes commands to localStorage; the slideshow
// window listens for them via the `storage` event, dispatches to the
// IFrame Player, and writes state back the other way.

export const MUSIC_COMMAND_KEY = "flowwwwMusicCommand"
export const MUSIC_STATE_KEY = "flowwwwMusicState"
export const MUSIC_URL_KEY = "flowwwwMusicUrl"
export const MUSIC_VOLUME_KEY = "flowwwwMusicVolume"

export type MusicCommand =
  | { id: string; type: "load"; url: string; videoId?: string; playlistId?: string; autoplay?: boolean }
  | { id: string; type: "play" }
  | { id: string; type: "pause" }
  | { id: string; type: "next" }
  | { id: string; type: "prev" }
  | { id: string; type: "volume"; value: number }
  | { id: string; type: "stop" }

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error"

export interface MusicState {
  status: PlayerStatus
  videoId?: string
  title?: string
  author?: string
  volume: number
  duration?: number
  currentTime?: number
  hasPlaylist?: boolean
}

export const DEFAULT_MUSIC_STATE: MusicState = {
  status: "idle",
  volume: 60,
}

export interface ParsedYouTubeRef {
  videoId?: string
  playlistId?: string
}

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

export function makeCommandId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

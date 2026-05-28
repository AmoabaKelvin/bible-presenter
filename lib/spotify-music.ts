import type { MusicCommandInput, ParsedSpotifyRef } from "@/lib/youtube-music"
import { parseSpotifyRef } from "@/lib/youtube-music"

export interface SpotifyAuthStatus {
  connected: boolean
  profile?: unknown
  session?: {
    expiresAt: number
    expiresIn: number
    scope: string
  }
  error?: string
}

export interface SpotifyLoadOptions {
  uri: string
  contextUri?: string
  offsetUri?: string
  positionMs?: number
  autoplay?: boolean
}

export function getSpotifyLoginUrl(returnTo = "/") {
  const params = new URLSearchParams({ returnTo })
  return `/api/spotify/login?${params}`
}

export async function getSpotifyStatus(): Promise<SpotifyAuthStatus> {
  const res = await fetch("/api/spotify/status", { cache: "no-store" })
  if (!res.ok) return { connected: false, error: "Failed to read Spotify status." }
  return res.json()
}

export async function disconnectSpotify() {
  const res = await fetch("/api/spotify/logout", { method: "POST" })
  if (!res.ok) throw new Error("Failed to disconnect Spotify.")
}

export async function searchSpotify(
  query: string,
  options: { type?: string; limit?: number; offset?: number } = {},
) {
  const params = new URLSearchParams({
    q: query,
    type: options.type || "track,album,playlist",
    limit: String(options.limit ?? 10),
    offset: String(options.offset ?? 0),
  })
  const res = await fetch(`/api/spotify/search?${params}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Spotify search failed.")
  return res.json()
}

export async function getSpotifyPlaylists(
  options: { limit?: number; offset?: number; all?: boolean } = {},
) {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 20),
    offset: String(options.offset ?? 0),
  })
  if (options.all) params.set("all", "true")
  const res = await fetch(`/api/spotify/me/playlists?${params}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load Spotify playlists.")
  return res.json()
}

export async function getSpotifyPlaylistItems(
  playlistId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
  })
  const res = await fetch(`/api/spotify/playlists/${playlistId}/items?${params}`, {
    cache: "no-store",
  })
  if (!res.ok) {
    const err = new Error("Failed to load Spotify playlist items.") as Error & {
      status?: number
    }
    err.status = res.status
    throw err
  }
  return res.json()
}

export function makeSpotifyLoadCommand(options: SpotifyLoadOptions): MusicCommandInput {
  return {
    type: "load",
    provider: "spotify",
    uri: options.uri,
    contextUri: options.contextUri,
    offsetUri: options.offsetUri,
    positionMs: options.positionMs,
    autoplay: options.autoplay ?? true,
  }
}

export function makeSpotifyLoadCommandFromRef(
  input: string | ParsedSpotifyRef,
  options: Omit<SpotifyLoadOptions, "uri"> = {},
) {
  const ref = typeof input === "string" ? parseSpotifyRef(input) : input
  if (!ref) return null
  return makeSpotifyLoadCommand({ ...options, uri: ref.uri })
}

export interface YouTubeAuthStatus {
  connected: boolean
  channel?: unknown
  session?: {
    expiresAt: number
    expiresIn: number
    scope: string
  }
  error?: string
}

export interface YouTubePlaylistSummary {
  id: string
  playlistId: string
  title: string
  description?: string
  channelTitle?: string
  thumbnailUrl?: string
  itemCount?: number | null
}

export interface YouTubePlaylistTrack {
  id: string
  videoId: string
  title: string
  author?: string
  thumbnailUrl?: string
}

export function getYouTubeLoginUrl(returnTo = "/") {
  const params = new URLSearchParams({ returnTo })
  return `/api/youtube/login?${params}`
}

export async function getYouTubeStatus(): Promise<YouTubeAuthStatus> {
  const res = await fetch("/api/youtube/status", { cache: "no-store" })
  if (!res.ok) return { connected: false, error: "Failed to read YouTube status." }
  return res.json()
}

export async function disconnectYouTube() {
  const res = await fetch("/api/youtube/logout", { method: "POST" })
  if (!res.ok) throw new Error("Failed to disconnect YouTube.")
}

export async function getYouTubePlaylists(options: { limit?: number; all?: boolean } = {}) {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 50),
  })
  if (options.all ?? true) params.set("all", "true")
  const res = await fetch(`/api/youtube/playlists?${params}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load YouTube playlists.")
  return res.json() as Promise<{ items?: YouTubePlaylistSummary[] }>
}

export async function getYouTubePlaylistItems(
  playlistId: string,
  options: { limit?: number; all?: boolean } = {},
) {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 50),
  })
  if (options.all ?? true) params.set("all", "true")
  const res = await fetch(`/api/youtube/playlists/${playlistId}/items?${params}`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load YouTube playlist tracks.")
  return res.json() as Promise<{ items?: YouTubePlaylistTrack[] }>
}

export async function searchYouTube(
  query: string,
  options: { limit?: number; signal?: AbortSignal } = {},
) {
  const params = new URLSearchParams({
    q: query,
    limit: String(options.limit ?? 12),
  })
  const res = await fetch(`/api/youtube/search?${params}`, {
    cache: "no-store",
    signal: options.signal,
  })
  if (!res.ok) {
    const err = new Error("YouTube search failed.") as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<{ items?: YouTubePlaylistTrack[] }>
}

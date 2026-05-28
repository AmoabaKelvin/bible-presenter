import { spotifyFetchJson } from "@/lib/spotify-auth"

export const runtime = "nodejs"

const DEFAULT_TYPES = "track,album,playlist"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const q = requestUrl.searchParams.get("q")?.trim()
  if (!q) return Response.json({ error: "Missing search query." }, { status: 400 })

  const type = requestUrl.searchParams.get("type") || DEFAULT_TYPES
  const limit = clampNumber(requestUrl.searchParams.get("limit"), 1, 10, 10)
  const offset = clampNumber(requestUrl.searchParams.get("offset"), 0, 1000, 0)
  const params = new URLSearchParams({ q, type, limit: String(limit), offset: String(offset) })

  const res = await spotifyFetchJson<SpotifySearchResponse>(`/search?${params}`)
  if (!res.ok) return Response.json(res.data, { status: res.status })
  return Response.json({
    ...res.data,
    playlists: res.data.playlists
      ? {
          ...res.data.playlists,
          items: res.data.playlists.items?.filter(isPlaylist).map(normalizePlaylist) ?? [],
        }
      : undefined,
  })
}

interface SpotifySearchResponse {
  playlists?: {
    items?: (SpotifyPlaylist | null)[]
  }
}

interface SpotifyPlaylist {
  id: string
  name: string
  uri: string
  tracks?: { total?: number }
  items?: { total?: number }
}

function normalizePlaylist<T extends SpotifyPlaylist>(playlist: T) {
  const trackCount =
    typeof playlist.tracks?.total === "number"
      ? playlist.tracks.total
      : typeof playlist.items?.total === "number"
        ? playlist.items.total
        : null

  return {
    ...playlist,
    trackCount,
  }
}

function isPlaylist(playlist: SpotifyPlaylist | null): playlist is SpotifyPlaylist {
  return playlist !== null
}

function clampNumber(raw: string | null, min: number, max: number, fallback: number) {
  const value = raw ? Number(raw) : fallback
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

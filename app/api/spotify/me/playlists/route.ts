import { spotifyFetchJson } from "@/lib/spotify-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const limit = clampNumber(requestUrl.searchParams.get("limit"), 1, 50, 20)
  const offset = clampNumber(requestUrl.searchParams.get("offset"), 0, 1000, 0)
  const loadAll = requestUrl.searchParams.get("all") === "true"

  if (loadAll) return getAllPlaylists(limit, offset)

  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })

  const res = await spotifyFetchJson<SpotifyPaging<SpotifyPlaylist>>(`/me/playlists?${params}`)
  if (!res.ok) return Response.json(res.data, { status: res.status })
  return Response.json({
    ...res.data,
    items: res.data.items?.map(normalizePlaylist) ?? [],
  })
}

async function getAllPlaylists(limit: number, initialOffset: number) {
  const allItems: SpotifyPlaylist[] = []
  let total: number | undefined
  let offset = initialOffset

  // Spotify caps this endpoint at 50 per page. Keep a generous hard cap
  // so a bad paging response cannot loop forever.
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    const res = await spotifyFetchJson<SpotifyPaging<SpotifyPlaylist>>(`/me/playlists?${params}`)
    if (!res.ok) return Response.json(res.data, { status: res.status })

    const items = res.data.items ?? []
    allItems.push(...items)
    total = res.data.total

    if (items.length === 0) break
    if (typeof total === "number" && allItems.length >= total - initialOffset) break
    if (!res.data.next) break
    offset += limit
  }

  return Response.json({
    items: allItems.map(normalizePlaylist),
    total: total ?? allItems.length,
    limit,
    offset: initialOffset,
    next: null,
    previous: null,
  })
}

interface SpotifyPaging<T> {
  items?: T[]
  total?: number
  limit?: number
  offset?: number
  next?: string | null
  previous?: string | null
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

function clampNumber(raw: string | null, min: number, max: number, fallback: number) {
  const value = raw ? Number(raw) : fallback
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

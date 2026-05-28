import { spotifyFetch } from "@/lib/spotify-auth"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ playlistId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { playlistId } = await context.params
  const requestUrl = new URL(request.url)
  const limit = clampNumber(requestUrl.searchParams.get("limit"), 1, 100, 100)
  const offset = clampNumber(requestUrl.searchParams.get("offset"), 0, 10000, 0)
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })

  // Spotify's March 2026 API migration removed /playlists/{id}/tracks and
  // replaced it with /playlists/{id}/items. In Development Mode this only
  // works for playlists the user owns or collaborates on; others 403.
  return spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}/items?${params}`)
}

function clampNumber(raw: string | null, min: number, max: number, fallback: number) {
  const value = raw ? Number(raw) : fallback
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

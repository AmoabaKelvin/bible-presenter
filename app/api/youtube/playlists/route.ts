import { youtubeFetchJson } from "@/lib/youtube-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const limit = clampNumber(requestUrl.searchParams.get("limit"), 1, 50, 50)
  const loadAll = requestUrl.searchParams.get("all") === "true"

  if (loadAll) return getAllPlaylists(limit)

  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    mine: "true",
    maxResults: String(limit),
  })
  const pageToken = requestUrl.searchParams.get("pageToken")
  if (pageToken) params.set("pageToken", pageToken)

  const res = await youtubeFetchJson<YouTubeListResponse<YouTubePlaylist>>(`/playlists?${params}`)
  if (!res.ok) return Response.json(res.data, { status: res.status })
  return Response.json({
    ...res.data,
    items: res.data.items?.map(normalizePlaylist) ?? [],
  })
}

async function getAllPlaylists(limit: number) {
  const allItems: YouTubePlaylist[] = []
  let nextPageToken: string | undefined
  let pageInfo: YouTubeListResponse<YouTubePlaylist>["pageInfo"] | undefined

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      mine: "true",
      maxResults: String(limit),
    })
    if (nextPageToken) params.set("pageToken", nextPageToken)

    const res = await youtubeFetchJson<YouTubeListResponse<YouTubePlaylist>>(`/playlists?${params}`)
    if (!res.ok) return Response.json(res.data, { status: res.status })

    allItems.push(...(res.data.items ?? []))
    pageInfo = res.data.pageInfo
    nextPageToken = res.data.nextPageToken
    if (!nextPageToken) break
  }

  return Response.json({
    items: allItems.map(normalizePlaylist),
    pageInfo: pageInfo ?? { totalResults: allItems.length, resultsPerPage: limit },
    nextPageToken: null,
  })
}

interface YouTubeListResponse<T> {
  items?: T[]
  nextPageToken?: string
  pageInfo?: { totalResults?: number; resultsPerPage?: number }
}

interface YouTubePlaylist {
  id: string
  snippet?: {
    title?: string
    description?: string
    channelTitle?: string
    thumbnails?: Record<string, { url?: string; width?: number; height?: number }>
  }
  contentDetails?: { itemCount?: number }
}

function normalizePlaylist(playlist: YouTubePlaylist) {
  return {
    id: playlist.id,
    playlistId: playlist.id,
    title: playlist.snippet?.title || "Untitled playlist",
    description: playlist.snippet?.description || "",
    channelTitle: playlist.snippet?.channelTitle || "",
    thumbnailUrl: getBestThumbnail(playlist.snippet?.thumbnails),
    itemCount: playlist.contentDetails?.itemCount ?? null,
  }
}

function getBestThumbnail(thumbnails?: Record<string, { url?: string }>) {
  if (!thumbnails) return undefined
  return thumbnails.maxres?.url || thumbnails.standard?.url || thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url
}

function clampNumber(raw: string | null, min: number, max: number, fallback: number) {
  const value = raw ? Number(raw) : fallback
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

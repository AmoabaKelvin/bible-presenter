import { youtubeFetchJson } from "@/lib/youtube-auth"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ playlistId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { playlistId } = await context.params
  const requestUrl = new URL(request.url)
  const limit = clampNumber(requestUrl.searchParams.get("limit"), 1, 50, 50)
  const loadAll = requestUrl.searchParams.get("all") === "true"

  if (loadAll) return getAllPlaylistItems(playlistId, limit)

  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    playlistId,
    maxResults: String(limit),
  })
  const pageToken = requestUrl.searchParams.get("pageToken")
  if (pageToken) params.set("pageToken", pageToken)

  const res = await youtubeFetchJson<YouTubeListResponse<YouTubePlaylistItem>>(`/playlistItems?${params}`)
  if (!res.ok) return Response.json(res.data, { status: res.status })
  return Response.json({
    ...res.data,
    items: res.data.items?.map(normalizePlaylistItem).filter((item) => item.videoId) ?? [],
  })
}

async function getAllPlaylistItems(playlistId: string, limit: number) {
  const allItems: YouTubePlaylistItem[] = []
  let nextPageToken: string | undefined
  let pageInfo: YouTubeListResponse<YouTubePlaylistItem>["pageInfo"] | undefined

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: String(limit),
    })
    if (nextPageToken) params.set("pageToken", nextPageToken)

    const res = await youtubeFetchJson<YouTubeListResponse<YouTubePlaylistItem>>(`/playlistItems?${params}`)
    if (!res.ok) return Response.json(res.data, { status: res.status })

    allItems.push(...(res.data.items ?? []))
    pageInfo = res.data.pageInfo
    nextPageToken = res.data.nextPageToken
    if (!nextPageToken) break
  }

  return Response.json({
    items: allItems.map(normalizePlaylistItem).filter((item) => item.videoId),
    pageInfo: pageInfo ?? { totalResults: allItems.length, resultsPerPage: limit },
    nextPageToken: null,
  })
}

interface YouTubeListResponse<T> {
  items?: T[]
  nextPageToken?: string
  pageInfo?: { totalResults?: number; resultsPerPage?: number }
}

interface YouTubePlaylistItem {
  id: string
  snippet?: {
    title?: string
    channelTitle?: string
    videoOwnerChannelTitle?: string
    thumbnails?: Record<string, { url?: string; width?: number; height?: number }>
    resourceId?: { videoId?: string }
  }
  contentDetails?: { videoId?: string }
}

function normalizePlaylistItem(item: YouTubePlaylistItem) {
  const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId
  return {
    id: item.id,
    videoId,
    title: item.snippet?.title || "Untitled video",
    author: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || "",
    thumbnailUrl: getBestThumbnail(item.snippet?.thumbnails),
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

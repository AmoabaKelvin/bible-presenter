import { youtubeFetchJson } from "@/lib/youtube-auth"

export const runtime = "nodejs"

// Note: YouTube Data API search.list costs 100 quota units per call
// (default daily quota is 10,000 units → ~100 searches/day). The client
// debounces to avoid burning through it.
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const q = requestUrl.searchParams.get("q")?.trim()
  if (!q) return Response.json({ error: "Missing search query." }, { status: 400 })

  const limit = clampNumber(requestUrl.searchParams.get("limit"), 1, 25, 12)
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q,
    maxResults: String(limit),
    videoEmbeddable: "true",
    safeSearch: "moderate",
  })

  const res = await youtubeFetchJson<YouTubeSearchResponse>(`/search?${params}`)
  if (!res.ok) return Response.json(res.data, { status: res.status })
  return Response.json({
    items: (res.data.items ?? [])
      .map(normalizeSearchItem)
      .filter((item) => item.videoId),
  })
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[]
}

interface YouTubeSearchItem {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    channelTitle?: string
    thumbnails?: Record<string, { url?: string }>
  }
}

function normalizeSearchItem(item: YouTubeSearchItem) {
  const videoId = item.id?.videoId
  return {
    id: videoId ?? "",
    videoId,
    title: decodeEntities(item.snippet?.title || "Untitled video"),
    author: decodeEntities(item.snippet?.channelTitle || ""),
    thumbnailUrl: getBestThumbnail(item.snippet?.thumbnails),
  }
}

// search.list returns titles/authors with HTML entities (&amp; &#39; etc).
function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function getBestThumbnail(thumbnails?: Record<string, { url?: string }>) {
  if (!thumbnails) return undefined
  return (
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url
  )
}

function clampNumber(raw: string | null, min: number, max: number, fallback: number) {
  const value = raw ? Number(raw) : fallback
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

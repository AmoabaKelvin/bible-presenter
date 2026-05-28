// Tiny oEmbed client. YouTube's oEmbed endpoint is public (no API key
// needed) and returns title + author + thumbnail for a single video.

export interface OEmbedTrack {
  videoId: string
  title: string
  author: string
  thumbnailUrl?: string
}

const cache = new Map<string, OEmbedTrack | null>()
const inflight = new Map<string, Promise<OEmbedTrack | null>>()

async function fetchOne(videoId: string): Promise<OEmbedTrack | null> {
  if (cache.has(videoId)) return cache.get(videoId) ?? null
  const existing = inflight.get(videoId)
  if (existing) return existing
  const promise = (async () => {
    try {
      const url = `https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D${videoId}&format=json`
      const res = await fetch(url)
      if (!res.ok) {
        cache.set(videoId, null)
        return null
      }
      const data = await res.json()
      const track: OEmbedTrack = {
        videoId,
        title: data.title ?? videoId,
        author: data.author_name ?? "",
        thumbnailUrl: data.thumbnail_url,
      }
      cache.set(videoId, track)
      return track
    } catch {
      cache.set(videoId, null)
      return null
    } finally {
      inflight.delete(videoId)
    }
  })()
  inflight.set(videoId, promise)
  return promise
}

export async function fetchTracks(videoIds: string[]): Promise<Array<OEmbedTrack | null>> {
  return Promise.all(videoIds.map(fetchOne))
}

export function getCachedTrack(videoId: string): OEmbedTrack | null | undefined {
  return cache.get(videoId)
}

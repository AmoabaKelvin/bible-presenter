import type { YouTubePlaylistSummary } from "@/lib/youtube-account"

export interface YouTubeChannelResponse {
  items?: {
    snippet?: {
      title?: string
      thumbnails?: Record<string, { url?: string }>
    }
  }[]
}

export function formatYouTubePlaylistCount(playlist: YouTubePlaylistSummary) {
  if (typeof playlist.itemCount !== "number") return "Playlist"
  return `${playlist.itemCount} video${playlist.itemCount === 1 ? "" : "s"}`
}

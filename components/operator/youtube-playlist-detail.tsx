"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getYouTubePlaylistItems,
  type YouTubePlaylistSummary,
  type YouTubePlaylistTrack,
} from "@/lib/youtube-account"
import { formatYouTubePlaylistCount } from "./youtube-browser-types"
import { YouTubeTrackItem } from "./youtube-browser-ui"

interface YouTubePlaylistDetailProps {
  playlist: YouTubePlaylistSummary
  activeVideoId?: string
  onBack: () => void
  onPlayAll: () => void
  onPlayTrack: (track: YouTubePlaylistTrack, index: number) => void
}

export function YouTubePlaylistDetail({
  playlist,
  activeVideoId,
  onBack,
  onPlayAll,
  onPlayTrack,
}: YouTubePlaylistDetailProps) {
  const [tracks, setTracks] = useState<YouTubePlaylistTrack[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setTracks(null)
    getYouTubePlaylistItems(playlist.playlistId, { limit: 50, all: true })
      .then((data) => {
        if (!cancelled) setTracks(data.items ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || "Failed to load tracks.")
        setTracks([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [playlist.playlistId])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-2 py-2 border-b border-border/60 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="size-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          aria-label="Back to YouTube playlists"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium truncate leading-tight" title={playlist.title}>
            {playlist.title}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight">
            {formatYouTubePlaylistCount(playlist)}
          </p>
        </div>
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs shrink-0"
          onClick={() => {
            const firstTrack = tracks?.[0]
            if (firstTrack) onPlayTrack(firstTrack, 0)
            else onPlayAll()
          }}
        >
          <Play className="size-3 mr-1" />
          Play all
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-thin">
        {loading && (
          <div className="grid place-items-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-[11px] text-destructive px-3 py-3">{error}</p>}
        {!loading && !error && (tracks?.length ?? 0) === 0 && (
          <p className="text-[11px] text-muted-foreground px-3 py-3">This playlist is empty.</p>
        )}
        <ul className="px-1 py-1 space-y-0.5">
          {(tracks ?? []).map((track, i) => (
            <YouTubeTrackItem
              key={`${track.id}-${i}`}
              track={track}
              active={activeVideoId === track.videoId}
              subtitle={track.author || playlist.channelTitle || ""}
              index={i}
              onClick={() => onPlayTrack(track, i)}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

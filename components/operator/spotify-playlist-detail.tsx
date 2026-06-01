"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, Loader2, Music2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSpotifyPlaylistItems } from "@/lib/spotify-music"
import {
  formatPlaylistTrackCount,
  type SpotifyPlaylistItemRow,
  type SpotifyPlaylistItemTrack,
  type SpotifyPlaylistSummary,
} from "./spotify-browser-types"

interface PlaylistDetailProps {
  playlist: SpotifyPlaylistSummary
  activeUri?: string
  onBack: () => void
  onPlayAll: () => void
  onPlayTrack: (trackUri: string) => void
}

export function SpotifyPlaylistDetail({
  playlist,
  activeUri,
  onBack,
  onPlayAll,
  onPlayTrack,
}: PlaylistDetailProps) {
  const [items, setItems] = useState<SpotifyPlaylistItemRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setForbidden(false)
    setItems(null)
    getSpotifyPlaylistItems(playlist.id, { limit: 100 })
      .then((data: { items?: SpotifyPlaylistItemRow[] }) => {
        if (cancelled) return
        setItems(data.items ?? [])
      })
      .catch((err: Error & { status?: number }) => {
        if (cancelled) return
        if (err.status === 403) setForbidden(true)
        else setError(err.message || "Failed to load tracks.")
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [playlist.id])

  const tracks = (items ?? [])
    .map((row) => row.item)
    .filter((track): track is SpotifyPlaylistItemTrack => !!track && !!track.uri)

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-2 py-2 border-b border-border/60 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="size-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          aria-label="Back to playlists"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium truncate leading-tight" title={playlist.name}>
            {playlist.name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight">
            {formatPlaylistTrackCount(playlist)}
          </p>
        </div>
        <Button size="sm" className="h-7 px-2.5 text-xs shrink-0" onClick={onPlayAll}>
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
        {forbidden && (
          <div className="px-3 py-4 text-center space-y-2.5">
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              Spotify only lets the app open the tracks of playlists you own or collaborate
              on. This one belongs to someone else &mdash; but you can still play the whole thing.
            </p>
            <Button size="sm" className="h-7 text-xs" onClick={onPlayAll}>
              <Play className="size-3 mr-1" />
              Play all
            </Button>
          </div>
        )}
        {!loading && !error && !forbidden && tracks.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-3 py-3">This playlist is empty.</p>
        )}
        <ul className="px-1 py-1 space-y-0.5">
          {tracks.map((track, i) => (
            <li key={`${track.id}-${i}`}>
              <button
                type="button"
                onClick={() => onPlayTrack(track.uri)}
                className={`group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left ${
                  activeUri === track.uri ? "bg-foreground/[0.06]" : "hover:bg-accent/60"
                }`}
              >
                <span className="font-mono text-[10px] text-muted-foreground w-5 tabular-nums shrink-0 text-right">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="size-8 rounded-sm bg-accent shrink-0 overflow-hidden grid place-items-center">
                  {track.album?.images?.[0]?.url ? (
                    <img src={track.album.images[0].url} alt="" className="size-full object-cover" />
                  ) : (
                    <Music2 className="size-3 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[12px] truncate ${
                      activeUri === track.uri ? "font-medium text-foreground" : "text-foreground/85"
                    }`}
                    title={track.name}
                  >
                    {track.name}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground truncate">
                    {track.artists?.map((artist) => artist.name).join(", ") || ""}
                  </p>
                </div>
                <Play className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

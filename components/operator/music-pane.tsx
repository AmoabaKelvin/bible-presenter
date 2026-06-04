"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { MusicState } from "@/lib/music-protocol"
import { fetchTracks, getCachedTrack, type OEmbedTrack } from "@/lib/youtube-oembed"
import type { SpotifyAuthStatus } from "@/lib/spotify-music"
import { MusicBrowsePanel } from "./music-browse-panel"
import { MusicPlayerControls } from "./music-player-controls"
import { YouTubeTracksList } from "./music-youtube-tracks-list"
import {
  type YouTubeAuthStatus,
  type YouTubePlaylistSummary,
  type YouTubePlaylistTrack,
} from "@/lib/youtube-account"

interface MusicPaneProps {
  state: MusicState
  url: string | null
  slideshowOnline: boolean
  youtubeStatus: YouTubeAuthStatus
  onYouTubeStatusChange: (status: YouTubeAuthStatus) => void
  spotifyStatus: SpotifyAuthStatus
  onSpotifyStatusChange: (status: SpotifyAuthStatus) => void
  onOpenOutput: () => void
  onLoadYouTubePlaylist: (playlist: YouTubePlaylistSummary) => void
  onLoadYouTubeTrack: (
    track: YouTubePlaylistTrack,
    playlist: YouTubePlaylistSummary,
    index: number,
  ) => void
  onLoadYouTubeVideo: (track: YouTubePlaylistTrack) => void
  onLoadSpotify: (uri: string, options?: { contextUri?: string; offsetUri?: string }) => void
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrev: () => void
  onPlayAt: (index: number) => void
  onSeek: (seconds: number) => void
  onVolume: (value: number) => void
  onStop: () => void
}

export function MusicPane({
  state,
  url,
  slideshowOnline,
  youtubeStatus,
  onYouTubeStatusChange,
  spotifyStatus,
  onSpotifyStatusChange,
  onOpenOutput,
  onLoadYouTubePlaylist,
  onLoadYouTubeTrack,
  onLoadYouTubeVideo,
  onLoadSpotify,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onPlayAt,
  onSeek,
  onVolume,
  onStop,
}: MusicPaneProps) {
  const [tracks, setTracks] = useState<Record<string, OEmbedTrack | null>>({})
  const fetchedRef = useRef<Set<string>>(new Set())

  const provider = state.provider ?? "youtube"
  const isSpotify = provider === "spotify"
  const loaded = state.status !== "idle"
  const playing = state.status === "playing"
  const loading = state.status === "loading"
  const muted = state.volume === 0
  const hasYouTubePlaylist =
    !isSpotify && !!state.hasPlaylist && (state.playlistVideoIds?.length ?? 0) > 0
  const hasSpotifyContext = isSpotify && !!state.hasPlaylist

  // Fetch oEmbed titles whenever the YouTube playlist changes
  useEffect(() => {
    if (isSpotify) return
    const ids = state.playlistVideoIds ?? []
    if (ids.length === 0) return
    const fresh = ids.filter((id) => !fetchedRef.current.has(id))
    if (fresh.length === 0) return
    fresh.forEach((id) => fetchedRef.current.add(id))
    setTracks((prev) => {
      const next = { ...prev }
      for (const id of fresh) {
        const cached = getCachedTrack(id)
        if (cached !== undefined) next[id] = cached
      }
      return next
    })
    fetchTracks(fresh).then((results) => {
      setTracks((prev) => {
        const next = { ...prev }
        results.forEach((track, i) => {
          next[fresh[i]] = track
        })
        return next
      })
    })
  }, [state.playlistVideoIds, isSpotify])

  const headerTitle = useMemo(() => {
    if (!loaded) return "No music"
    return state.title || "Loading…"
  }, [loaded, state.title])

  const albumArt =
    state.albumArtUrl ||
    (state.videoId && !isSpotify ? tracks[state.videoId]?.thumbnailUrl : undefined)

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 py-2.5 flex items-center justify-between border-b border-border/60">
        <div className="flex items-baseline gap-2">
          <span className="eyebrow">Music</span>
          {loaded && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {isSpotify ? "Spotify" : "YouTube"}
            </span>
          )}
          {hasYouTubePlaylist && (
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {(state.playlistIndex ?? 0) + 1} / {state.playlistVideoIds?.length ?? 0}
            </span>
          )}
        </div>
        {url && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="text-[10px] font-mono uppercase tracking-wider px-2 h-7 rounded text-muted-foreground hover:text-destructive transition-colors"
                onClick={onStop}
              >
                Clear
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Remove loaded music</TooltipContent>
          </Tooltip>
        )}
      </header>

      {loaded && (
        <MusicPlayerControls
          state={state}
          title={headerTitle}
          albumArtUrl={albumArt}
          canSkip={hasYouTubePlaylist || hasSpotifyContext}
          playing={playing}
          loading={loading}
          muted={muted}
          onPlay={onPlay}
          onPause={onPause}
          onNext={onNext}
          onPrev={onPrev}
          onSeek={onSeek}
          onVolume={onVolume}
        />
      )}

      {hasYouTubePlaylist ? (
        <YouTubeTracksList
          videoIds={state.playlistVideoIds ?? []}
          activeIndex={state.playlistIndex}
          tracks={tracks}
          playing={playing}
          onPlayAt={onPlayAt}
        />
      ) : (
        <MusicBrowsePanel
          loaded={loaded}
          slideshowOnline={slideshowOnline}
          youtubeStatus={youtubeStatus}
          spotifyStatus={spotifyStatus}
          activeYouTubeVideoId={!isSpotify ? state.videoId : undefined}
          activeYouTubePlaylistId={!isSpotify ? url ?? undefined : undefined}
          activeSpotifyUri={isSpotify ? state.uri : undefined}
          onOpenOutput={onOpenOutput}
          onYouTubeStatusChange={onYouTubeStatusChange}
          onSpotifyStatusChange={onSpotifyStatusChange}
          onLoadYouTubePlaylist={onLoadYouTubePlaylist}
          onLoadYouTubeTrack={onLoadYouTubeTrack}
          onLoadYouTubeVideo={onLoadYouTubeVideo}
          onLoadSpotify={onLoadSpotify}
        />
      )}
    </div>
  )
}

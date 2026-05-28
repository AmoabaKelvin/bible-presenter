"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Loader2,
  ExternalLink,
  Music2,
  Youtube,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { MusicState } from "@/lib/youtube-music"
import { fetchTracks, getCachedTrack, type OEmbedTrack } from "@/lib/youtube-oembed"
import { getSpotifyLoginUrl, type SpotifyAuthStatus } from "@/lib/spotify-music"
import { SpotifyBrowser } from "./spotify-browser"
import {
  getYouTubeLoginUrl,
  type YouTubeAuthStatus,
  type YouTubePlaylistSummary,
  type YouTubePlaylistTrack,
} from "@/lib/youtube-account"
import { YouTubeBrowser } from "./youtube-browser"

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

function formatTime(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
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
  const [browseProvider, setBrowseProvider] = useState<"youtube" | "spotify">("youtube")
  const fetchedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!youtubeStatus.connected && spotifyStatus.connected) setBrowseProvider("spotify")
    else if (youtubeStatus.connected && !spotifyStatus.connected) setBrowseProvider("youtube")
  }, [youtubeStatus.connected, spotifyStatus.connected])

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
    <div className="flex-1 min-h-0 flex flex-col">
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

      {/* Now playing card — only rendered when something is actually loaded.
          Keeps the pane condensed when there's nothing to control. */}
      {loaded && (
      <div className="px-4 py-2.5 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-sm bg-accent grid place-items-center shrink-0 overflow-hidden">
            {albumArt ? (
              <img src={albumArt} alt="" className="size-full object-cover" />
            ) : (
              <Music className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-medium truncate leading-tight" title={headerTitle}>
              {headerTitle}
            </p>
            <p className="text-[10.5px] text-muted-foreground truncate leading-tight mt-0.5">
              {state.status === "error" && state.errorMessage
                ? state.errorMessage
                : state.author || formatTime(state.currentTime) + " / " + formatTime(state.duration)}
            </p>
          </div>

          {/* Inline transport */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              aria-label="Previous"
              disabled={!hasYouTubePlaylist && !hasSpotifyContext}
              onClick={onPrev}
              className="size-7 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <SkipBack className="size-3.5" />
            </button>
            <button
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => (playing ? onPause() : onPlay())}
              className="size-9 grid place-items-center rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : playing ? (
                <Pause className="size-3.5" />
              ) : (
                <Play className="size-3.5 ml-px" />
              )}
            </button>
            <button
              aria-label="Next"
              disabled={!hasYouTubePlaylist && !hasSpotifyContext}
              onClick={onNext}
              className="size-7 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <SkipForward className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Seek + volume on one row */}
        <div className="flex items-center gap-3 mt-2.5">
          <Slider
            value={[Math.min(state.currentTime ?? 0, state.duration ?? 0)]}
            min={0}
            max={Math.max(state.duration ?? 0, 1)}
            step={1}
            onValueChange={([v]) => onSeek(v)}
            disabled={!state.duration}
            aria-label="Seek"
            className="flex-1"
          />
          <div className="flex items-center gap-1.5 w-[96px] shrink-0">
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => onVolume(muted ? 60 : 0)}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
            <Slider
              value={[state.volume]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onVolume(v)}
              className="flex-1"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
      )}

      {/* Browse section */}
      {hasYouTubePlaylist ? (
        <YouTubeTracksList
          videoIds={state.playlistVideoIds ?? []}
          activeIndex={state.playlistIndex}
          tracks={tracks}
          playing={playing}
          onPlayAt={onPlayAt}
        />
      ) : youtubeStatus.connected || spotifyStatus.connected ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex border-b border-border/60">
            <SourceButton active={browseProvider === "youtube"} onClick={() => setBrowseProvider("youtube")}>
              <Youtube className="size-3 mr-1.5" />
              YouTube
            </SourceButton>
            <SourceButton active={browseProvider === "spotify"} onClick={() => setBrowseProvider("spotify")}>
              <Music2 className="size-3 mr-1.5" />
              Spotify
            </SourceButton>
          </div>
          {browseProvider === "youtube" ? (
            youtubeStatus.connected ? (
              <YouTubeBrowser
                status={youtubeStatus}
                activeVideoId={!isSpotify ? state.videoId : undefined}
                activePlaylistId={!isSpotify ? url ?? undefined : undefined}
                onStatusChange={onYouTubeStatusChange}
                onLoadPlaylist={onLoadYouTubePlaylist}
                onLoadTrack={onLoadYouTubeTrack}
                onLoadVideo={onLoadYouTubeVideo}
              />
            ) : (
              <ConnectPanel provider="youtube" loaded={loaded} />
            )
          ) : spotifyStatus.connected ? (
            <SpotifyBrowser
              status={spotifyStatus}
              slideshowOnline={slideshowOnline}
              activeUri={isSpotify ? state.uri : undefined}
              onStatusChange={onSpotifyStatusChange}
              onLoadSpotify={onLoadSpotify}
            />
          ) : (
            <ConnectPanel provider="spotify" loaded={loaded} />
          )}
        </div>
      ) : (
        <EmptyBrowse
          slideshowOnline={slideshowOnline}
          loaded={loaded}
          onOpenOutput={onOpenOutput}
        />
      )}
    </div>
  )
}

interface YouTubeTracksListProps {
  videoIds: string[]
  activeIndex?: number
  tracks: Record<string, OEmbedTrack | null>
  playing: boolean
  onPlayAt: (i: number) => void
}

function YouTubeTracksList({
  videoIds,
  activeIndex,
  tracks,
  playing,
  onPlayAt,
}: YouTubeTracksListProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-thin">
      <ul className="px-2 py-2 space-y-0.5">
        {videoIds.map((videoId, i) => {
          const track = tracks[videoId]
          const isActive = activeIndex === i
          return (
            <li
              key={`${videoId}-${i}`}
              onClick={() => onPlayAt(i)}
              className={`group relative flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                isActive ? "bg-foreground/[0.06]" : "hover:bg-accent/60"
              }`}
            >
              <span
                aria-hidden
                className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full ${
                  isActive ? "bg-[color:var(--live)]" : "bg-transparent"
                }`}
              />
              <span className="font-mono text-[10px] text-muted-foreground w-5 tabular-nums shrink-0 text-right">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="size-8 rounded-sm bg-accent grid place-items-center shrink-0 overflow-hidden">
                {track?.thumbnailUrl ? (
                  <img src={track.thumbnailUrl} alt="" className="size-full object-cover" />
                ) : (
                  <Music className="size-3 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[12px] truncate ${
                    isActive ? "font-medium text-foreground" : "text-foreground/85"
                  }`}
                  title={track?.title}
                >
                  {track?.title || videoId}
                </p>
                {track?.author && (
                  <p className="text-[10.5px] text-muted-foreground truncate">{track.author}</p>
                )}
              </div>
              {isActive && (
                <span className="text-[9px] font-mono uppercase tracking-wider text-[color:var(--live)] shrink-0">
                  {playing ? "Now" : "Cued"}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface EmptyBrowseProps {
  slideshowOnline: boolean
  loaded: boolean
  onOpenOutput: () => void
}

function EmptyBrowse({ slideshowOnline, loaded, onOpenOutput }: EmptyBrowseProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-6 text-center gap-3">
      {!slideshowOnline ? (
        <>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Open the output window first — music plays in the slideshow tab.
          </p>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenOutput}>
            <ExternalLink className="size-3 mr-1.5" />
            Open output
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-[12px] font-medium">
              {loaded ? "Connect an account to browse" : "Connect music"}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[280px]">
              Link YouTube or Spotify to browse account playlists and play them in the output window.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-8 text-xs bg-[#ff0033] hover:bg-[#ff0033]/90 text-white" asChild>
              <a href={getYouTubeLoginUrl(typeof window === "undefined" ? "/" : window.location.pathname)}>
                <Youtube className="size-3 mr-1.5" />
                Connect YouTube
              </a>
            </Button>
            <Button size="sm" className="h-8 text-xs bg-[#1DB954] hover:bg-[#1DB954]/90 text-white" asChild>
              <a href={getSpotifyLoginUrl(typeof window === "undefined" ? "/" : window.location.pathname)}>
                <Music2 className="size-3 mr-1.5" />
                Connect Spotify
              </a>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function SourceButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center h-9 text-[11px] font-mono uppercase tracking-wider transition-colors ${
        active
          ? "text-foreground border-b-2 border-foreground -mb-px"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function ConnectPanel({ provider, loaded }: { provider: "youtube" | "spotify"; loaded: boolean }) {
  const isYouTube = provider === "youtube"
  const href = isYouTube
    ? getYouTubeLoginUrl(typeof window === "undefined" ? "/" : window.location.pathname)
    : getSpotifyLoginUrl(typeof window === "undefined" ? "/" : window.location.pathname)

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-6 text-center gap-3">
      <div className={`size-10 rounded-full grid place-items-center ${isYouTube ? "bg-[#ff0033]/10" : "bg-[#1DB954]/10"}`}>
        {isYouTube ? (
          <Youtube className="size-4 text-[#ff0033]" />
        ) : (
          <Music2 className="size-4 text-[#1DB954]" />
        )}
      </div>
      <div className="space-y-1">
        <p className="text-[12px] font-medium">
          {loaded ? `Connect ${isYouTube ? "YouTube" : "Spotify"} to browse` : `Connect ${isYouTube ? "YouTube" : "Spotify"}`}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[260px]">
          {isYouTube
            ? "Link your Google account to browse official YouTube playlists."
            : "Link your Spotify account to browse playlists and search Spotify's catalog."}
        </p>
      </div>
      <Button
        size="sm"
        className={`h-8 text-xs text-white ${isYouTube ? "bg-[#ff0033] hover:bg-[#ff0033]/90" : "bg-[#1DB954] hover:bg-[#1DB954]/90"}`}
        asChild
      >
        <a href={href}>
          {isYouTube ? <Youtube className="size-3 mr-1.5" /> : <Music2 className="size-3 mr-1.5" />}
          Connect {isYouTube ? "YouTube" : "Spotify"}
        </a>
      </Button>
    </div>
  )
}

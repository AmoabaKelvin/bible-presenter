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
  Plus,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { MusicState } from "@/lib/youtube-music"
import { parseYouTubeUrl } from "@/lib/youtube-music"
import { fetchTracks, getCachedTrack, type OEmbedTrack } from "@/lib/youtube-oembed"

interface MusicPaneProps {
  state: MusicState
  url: string | null
  slideshowOnline: boolean
  onOpenOutput: () => void
  onLoad: (url: string) => void
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
  onOpenOutput,
  onLoad,
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

  // Fetch oEmbed titles whenever the playlist changes
  useEffect(() => {
    const ids = state.playlistVideoIds ?? []
    if (ids.length === 0) return
    const fresh = ids.filter((id) => !fetchedRef.current.has(id))
    if (fresh.length === 0) return
    fresh.forEach((id) => fetchedRef.current.add(id))
    // Seed with cached entries immediately so first paint isn't blank
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
  }, [state.playlistVideoIds])

  const loaded = state.status !== "idle"
  const playing = state.status === "playing"
  const loading = state.status === "loading"
  const muted = state.volume === 0
  const hasPlaylist = !!state.hasPlaylist && (state.playlistVideoIds?.length ?? 0) > 0

  const headerTitle = useMemo(() => {
    if (!loaded) return "No music"
    return state.title || "Loading…"
  }, [loaded, state.title])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="px-4 py-2.5 flex items-center justify-between border-b border-border/60">
        <div className="flex items-baseline gap-2">
          <span className="eyebrow">Music</span>
          {hasPlaylist && (
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {(state.playlistIndex ?? 0) + 1} / {state.playlistVideoIds?.length ?? 0}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    className="size-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label="Load music"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Load music</TooltipContent>
            </Tooltip>
            <LoadPopover
              slideshowOnline={slideshowOnline}
              currentUrl={url}
              onLoad={onLoad}
              onOpenOutput={onOpenOutput}
              onStop={onStop}
            />
          </Popover>
        </div>
      </header>

      {/* Now playing card */}
      <div className="px-4 pt-3 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-12 rounded-md bg-accent grid place-items-center shrink-0 overflow-hidden">
            {state.videoId && tracks[state.videoId]?.thumbnailUrl ? (
              <img
                src={tracks[state.videoId]!.thumbnailUrl!}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Music className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-[13px] truncate ${loaded ? "font-medium" : "text-muted-foreground"}`}
              title={headerTitle}
            >
              {headerTitle}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {state.author || (loaded ? "" : "Hit + to add a YouTube URL")}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <Slider
            value={[Math.min(state.currentTime ?? 0, state.duration ?? 0)]}
            min={0}
            max={Math.max(state.duration ?? 0, 1)}
            step={1}
            onValueChange={([v]) => onSeek(v)}
            disabled={!loaded || !state.duration}
            aria-label="Seek"
          />
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground tabular-nums mt-1">
            <span>{formatTime(state.currentTime)}</span>
            <span>{formatTime(state.duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="Previous"
                disabled={!loaded || !hasPlaylist}
                onClick={onPrev}
                className="size-9 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <SkipBack className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Previous</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={playing ? "Pause" : "Play"}
                disabled={!loaded}
                onClick={() => (playing ? onPause() : onPlay())}
                className="size-11 grid place-items-center rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 transition-colors shadow-sm"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : playing ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4 ml-px" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{playing ? "Pause" : "Play"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="Next"
                disabled={!loaded || !hasPlaylist}
                onClick={onNext}
                className="size-9 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <SkipForward className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Next</TooltipContent>
          </Tooltip>

          <div className="flex-1 flex items-center gap-2 ml-2">
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => onVolume(muted ? 60 : 0)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
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

      {/* Playlist */}
      {hasPlaylist ? (
        <ScrollArea className="flex-1 min-h-0">
          <ul className="px-2 py-2 space-y-0.5">
            {(state.playlistVideoIds ?? []).map((videoId, i) => {
              const track = tracks[videoId]
              const isActive = state.playlistIndex === i
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
                      <img
                        src={track.thumbnailUrl}
                        alt=""
                        className="size-full object-cover"
                      />
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
                      <p className="text-[10.5px] text-muted-foreground truncate">
                        {track.author}
                      </p>
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
        </ScrollArea>
      ) : (
        <div className="flex-1 min-h-0 grid place-items-center px-6 pb-4 text-center">
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            {!slideshowOnline
              ? "Open the output window first — music plays in the slideshow tab."
              : loaded
                ? "Single track loaded. Load a playlist to see and jump between tracks."
                : "Click + above to load a YouTube video or playlist."}
          </p>
        </div>
      )}
    </div>
  )
}

interface LoadPopoverProps {
  slideshowOnline: boolean
  currentUrl: string | null
  onLoad: (url: string) => void
  onOpenOutput: () => void
  onStop: () => void
}

function LoadPopover({
  slideshowOnline,
  currentUrl,
  onLoad,
  onOpenOutput,
  onStop,
}: LoadPopoverProps) {
  const [draftUrl, setDraftUrl] = useState("")
  const [error, setError] = useState(false)

  const handleLoad = () => {
    if (!slideshowOnline) return
    const parsed = parseYouTubeUrl(draftUrl)
    if (!parsed) {
      setError(true)
      return
    }
    onLoad(draftUrl)
    setDraftUrl("")
    setError(false)
  }

  return (
    <PopoverContent align="end" side="bottom" className="w-[320px] p-3">
      <div className="space-y-3">
        {!slideshowOnline && (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-2.5 text-[11px] leading-relaxed">
            <p className="text-foreground mb-1.5">Output window isn&rsquo;t open</p>
            <p className="text-muted-foreground mb-2">
              Music plays in the slideshow tab, so it needs to be open first.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs w-full"
              onClick={onOpenOutput}
            >
              <ExternalLink className="size-3 mr-1.5" />
              Open output
            </Button>
          </div>
        )}
        <div>
          <label className="eyebrow block mb-1.5">YouTube URL</label>
          <div className="flex gap-1.5">
            <Input
              value={draftUrl}
              onChange={(e) => {
                setDraftUrl(e.target.value)
                if (error) setError(false)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLoad()
              }}
              placeholder="Paste a video or playlist URL"
              disabled={!slideshowOnline}
              className={`h-8 text-sm ${error ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleLoad}
              disabled={!draftUrl.trim() || !slideshowOnline}
              className="h-8"
            >
              Load
            </Button>
          </div>
        </div>

        {currentUrl && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground truncate" title={currentUrl}>
                {currentUrl}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                onClick={onStop}
              >
                <X className="size-3 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        )}
      </div>
    </PopoverContent>
  )
}

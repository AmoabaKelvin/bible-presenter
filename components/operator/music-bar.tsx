"use client"

import { useState } from "react"
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Settings2,
  X,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { MusicState } from "@/lib/youtube-music"
import { parseYouTubeUrl } from "@/lib/youtube-music"

interface MusicBarProps {
  state: MusicState
  url: string | null
  onLoad: (url: string) => void
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrev: () => void
  onVolume: (value: number) => void
  onStop: () => void
}

export function MusicBar({
  state,
  url,
  onLoad,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onVolume,
  onStop,
}: MusicBarProps) {
  const [draftUrl, setDraftUrl] = useState("")
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [error, setError] = useState(false)

  const loaded = state.status !== "idle"
  const playing = state.status === "playing"
  const loading = state.status === "loading"
  const muted = state.volume === 0

  const handleLoad = () => {
    const parsed = parseYouTubeUrl(draftUrl)
    if (!parsed) {
      setError(true)
      return
    }
    onLoad(draftUrl)
    setDraftUrl("")
    setError(false)
    setPopoverOpen(false)
  }

  const title = state.title || (state.videoId ? "Loading…" : "")

  return (
    <div className="border-t border-border px-2 py-2">
      <div className="flex items-center gap-1.5 px-1">
        <Music className="size-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          {loaded ? (
            <p className="text-[12px] truncate" title={title}>
              {title || "Loading…"}
            </p>
          ) : (
            <p className="text-[12px] text-muted-foreground">No music</p>
          )}
        </div>

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  aria-label="Music settings"
                  className="size-6 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Settings2 className="size-3" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">Music</TooltipContent>
          </Tooltip>
          <PopoverContent align="start" side="top" className="w-[320px] p-3">
            <div className="space-y-3">
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
                    className={`h-8 text-sm ${error ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleLoad} disabled={!draftUrl.trim()} className="h-8">
                    Load
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Music plays in the slideshow tab so screen-sharing carries the audio.
                </p>
              </div>

              {url && (
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground truncate" title={url}>
                      {url}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => {
                        onStop()
                        setPopoverOpen(false)
                      }}
                    >
                      <X className="size-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-1 mt-1 px-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Previous"
              disabled={!loaded || !state.hasPlaylist}
              onClick={onPrev}
              className="size-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <SkipBack className="size-3.5" />
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
              className="size-8 grid place-items-center rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 transition-colors"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : playing ? (
                <Pause className="size-3.5" />
              ) : (
                <Play className="size-3.5 ml-px" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{playing ? "Pause" : "Play"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Next"
              disabled={!loaded || !state.hasPlaylist}
              onClick={onNext}
              className="size-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <SkipForward className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Next</TooltipContent>
        </Tooltip>

        <div className="flex-1 flex items-center gap-1.5 ml-1.5">
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => onVolume(muted ? 60 : 0)}
            className="text-muted-foreground hover:text-foreground transition-colors"
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
  )
}

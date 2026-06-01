"use client"

import { Loader2, Music, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import type { MusicState } from "@/lib/music-protocol"

interface MusicPlayerControlsProps {
  state: MusicState
  title: string
  albumArtUrl?: string
  canSkip: boolean
  playing: boolean
  loading: boolean
  muted: boolean
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (seconds: number) => void
  onVolume: (value: number) => void
}

function formatTime(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return "0:00"
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

export function MusicPlayerControls({
  state,
  title,
  albumArtUrl,
  canSkip,
  playing,
  loading,
  muted,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onVolume,
}: MusicPlayerControlsProps) {
  return (
    <div className="px-4 py-2.5 border-b border-border/60">
      <div className="flex items-center gap-2.5">
        <div className="size-9 rounded-sm bg-accent grid place-items-center shrink-0 overflow-hidden">
          {albumArtUrl ? (
            <img src={albumArtUrl} alt="" className="size-full object-cover" />
          ) : (
            <Music className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium truncate leading-tight" title={title}>
            {title}
          </p>
          <p className="text-[10.5px] text-muted-foreground truncate leading-tight mt-0.5">
            {state.status === "error" && state.errorMessage
              ? state.errorMessage
              : state.author || `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`}
          </p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            aria-label="Previous"
            disabled={!canSkip}
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
            disabled={!canSkip}
            onClick={onNext}
            className="size-7 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <SkipForward className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2.5">
        <Slider
          value={[Math.min(state.currentTime ?? 0, state.duration ?? 0)]}
          min={0}
          max={Math.max(state.duration ?? 0, 1)}
          step={1}
          onValueChange={([value]) => onSeek(value)}
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
            onValueChange={([value]) => onVolume(value)}
            className="flex-1"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  )
}

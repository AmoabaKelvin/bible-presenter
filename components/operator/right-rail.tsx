"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Highlighter, Radio, Eraser, ExternalLink, Plus, BookA } from "lucide-react"
import { SlideStage, SlideContent, type SelectedVerse, type FontSize } from "@/components/slide-stage"
import { BackgroundPopover } from "./background-popover"
import { MusicPane } from "./music-pane"
import type { RefObject } from "react"
import type { MusicState } from "@/lib/youtube-music"
import type { SpotifyAuthStatus } from "@/lib/spotify-music"
import type { YouTubeAuthStatus, YouTubePlaylistSummary, YouTubePlaylistTrack } from "@/lib/youtube-account"

interface RightRailProps {
  previewVerses: SelectedVerse[]
  liveVerses: SelectedVerse[]
  previewMediaUrl: string | null
  liveMediaUrl: string | null
  fontSize: FontSize
  onFontSizeChange: (s: FontSize) => void
  version: string
  backgroundColor: string
  onBackgroundColorChange: (c: string) => void
  backgroundImage: string | null
  backgroundKind: "image" | "video" | null
  onUploadBackground: (file: File) => void
  onClearBackground: () => void
  onResetBackground: () => void
  themeLoaded: boolean
  previewContentRef: RefObject<HTMLDivElement | null>
  onGoLive: () => void
  onClearLive: () => void
  onOpenOutput: () => void
  onApplyHighlight: (color: string) => void
  onClearHighlights: () => void
  onDefineSelection: () => void
  onAddPreviewToQueue: () => void
  // music
  musicState: MusicState
  musicUrl: string | null
  slideshowOnline: boolean
  youtubeStatus: YouTubeAuthStatus
  onYouTubeStatusChange: (status: YouTubeAuthStatus) => void
  spotifyStatus: SpotifyAuthStatus
  onSpotifyStatusChange: (status: SpotifyAuthStatus) => void
  onMusicLoadYouTubePlaylist: (playlist: YouTubePlaylistSummary) => void
  onMusicLoadYouTubeVideo: (track: YouTubePlaylistTrack) => void
  onMusicLoadYouTubeTrack: (
    track: YouTubePlaylistTrack,
    playlist: YouTubePlaylistSummary,
    index: number,
  ) => void
  onMusicLoadSpotify: (uri: string, options?: { contextUri?: string; offsetUri?: string }) => void
  onMusicPlay: () => void
  onMusicPause: () => void
  onMusicNext: () => void
  onMusicPrev: () => void
  onMusicPlayAt: (idx: number) => void
  onMusicSeek: (seconds: number) => void
  onMusicVolume: (v: number) => void
  onMusicStop: () => void
}

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
  { value: "extra-large", label: "XL" },
]

const HIGHLIGHTS = [
  { value: "rgba(250, 204, 21, 0.55)", swatch: "#facc15", label: "Yellow" },
  { value: "rgba(74, 222, 128, 0.55)", swatch: "#4ade80", label: "Green" },
  { value: "rgba(96, 165, 250, 0.55)", swatch: "#60a5fa", label: "Blue" },
  { value: "rgba(244, 114, 182, 0.55)", swatch: "#f472b6", label: "Pink" },
  { value: "rgba(251, 146, 60, 0.55)", swatch: "#fb923c", label: "Orange" },
]

export function RightRail({
  previewVerses,
  liveVerses,
  previewMediaUrl,
  liveMediaUrl,
  fontSize,
  onFontSizeChange,
  version,
  backgroundColor,
  onBackgroundColorChange,
  backgroundImage,
  backgroundKind,
  onUploadBackground,
  onClearBackground,
  onResetBackground,
  themeLoaded,
  previewContentRef,
  onGoLive,
  onClearLive,
  onOpenOutput,
  onApplyHighlight,
  onClearHighlights,
  onDefineSelection,
  onAddPreviewToQueue,
  musicState,
  musicUrl,
  slideshowOnline,
  youtubeStatus,
  onYouTubeStatusChange,
  spotifyStatus,
  onSpotifyStatusChange,
  onMusicLoadYouTubePlaylist,
  onMusicLoadYouTubeTrack,
  onMusicLoadYouTubeVideo,
  onMusicLoadSpotify,
  onMusicPlay,
  onMusicPause,
  onMusicNext,
  onMusicPrev,
  onMusicPlayAt,
  onMusicSeek,
  onMusicVolume,
  onMusicStop,
}: RightRailProps) {
  const bg = themeLoaded ? backgroundColor : "#0a0a0a"
  const isLive = liveVerses.length > 0 || !!liveMediaUrl
  const hasPreview = previewVerses.length > 0 || !!previewMediaUrl

  return (
    <aside className="w-[500px] shrink-0 h-full border-l border-border bg-card/30 flex flex-col overflow-y-auto">
      {/* Slide presentation settings */}
      <div className="h-14 shrink-0 px-4 border-b border-border flex items-center justify-between gap-2">
        <span className="eyebrow">Slide</span>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border border-border overflow-hidden">
            {FONT_SIZES.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onFontSizeChange(opt.value)}
                className={`h-7 w-7 text-[10.5px] font-mono transition-colors ${
                  fontSize === opt.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                aria-pressed={fontSize === opt.value}
                title={`Font size ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <BackgroundPopover
            backgroundColor={backgroundColor}
            backgroundImage={backgroundImage}
            backgroundKind={backgroundKind}
            onColorChange={onBackgroundColorChange}
            onUploadImage={onUploadBackground}
            onClearImage={onClearBackground}
            onReset={onResetBackground}
          />
        </div>
      </div>

      {/* PREVIEW */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <span className="eyebrow">Preview</span>
          <div className="flex items-center gap-1">
            <Highlighter className="size-3 text-muted-foreground" />
            {HIGHLIGHTS.map((c) => (
              <Tooltip key={c.swatch}>
                <TooltipTrigger asChild>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onApplyHighlight(c.value)}
                    aria-label={`Highlight ${c.label}`}
                    className="size-3.5 rounded-sm border border-border/70 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c.swatch }}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom">{c.label}</TooltipContent>
              </Tooltip>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onClearHighlights}
                  aria-label="Clear highlights"
                  className="size-3.5 grid place-items-center rounded-sm border border-border/70 text-muted-foreground hover:bg-accent"
                >
                  <Eraser className="size-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Clear highlights</TooltipContent>
            </Tooltip>
            <span className="mx-0.5 h-3.5 w-px bg-border" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onDefineSelection}
                  aria-label="Define selected word"
                  className="size-3.5 grid place-items-center rounded-sm border border-border/70 text-muted-foreground hover:bg-accent"
                >
                  <BookA className="size-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Define selected word</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="aspect-video rounded-md overflow-hidden border border-border bg-black relative">
          <SlideStage
            backgroundColor={bg}
            backgroundImage={backgroundImage}
            backgroundKind={backgroundKind ?? undefined}
            mediaUrl={previewMediaUrl}
            className="w-full h-full"
          >
            {previewVerses.length > 0 && (
              <SlideContent
                verses={previewVerses}
                fontSize={fontSize}
                backgroundColor={bg}
                backgroundImage={backgroundImage}
                defaultVersion={version}
                innerRef={previewContentRef}
              />
            )}
          </SlideStage>
          {!hasPreview && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <p className="text-xs text-white/40">Nothing in preview</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            onClick={onGoLive}
            disabled={!hasPreview}
            className="flex-1 h-10 text-sm font-medium bg-go-live text-white hover:bg-go-live/90 focus-visible:ring-go-live/40"
          >
            <Radio className="size-4 mr-2" />
            Go live
            <kbd className="ml-auto px-1.5 py-0.5 text-[10px] font-mono rounded border border-white/30 bg-white/15 text-white">
              ␣
            </kbd>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onAddPreviewToQueue}
                disabled={!hasPreview}
                variant="outline"
                className="h-10 px-3"
                aria-label="Add preview to queue"
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Add to queue</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* LIVE */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <span className="flex items-center gap-2 eyebrow">
            {isLive && <span className="live-dot" />}
            <span className={isLive ? "text-foreground" : ""}>Live</span>
          </span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenOutput}
                  className="size-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Open output window"
                >
                  <ExternalLink className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open output window — press F there for fullscreen</TooltipContent>
            </Tooltip>
            {isLive && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onClearLive}
                    className="text-[10px] font-mono uppercase tracking-wider px-2 h-7 rounded text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Clear
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Black out the output</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div
          className={`aspect-video rounded-md overflow-hidden bg-black relative border ${
            isLive ? "border-[color:var(--live)]/60" : "border-border"
          }`}
        >
          <SlideStage
            backgroundColor={bg}
            backgroundImage={backgroundImage}
            backgroundKind={backgroundKind ?? undefined}
            mediaUrl={liveMediaUrl}
            className="w-full h-full"
          >
            {liveVerses.length > 0 && (
              <SlideContent
                verses={liveVerses}
                fontSize={fontSize}
                backgroundColor={bg}
                backgroundImage={backgroundImage}
                defaultVersion={version}
              />
            )}
          </SlideStage>
          {!isLive && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <p className="text-xs text-white/30">Nothing is live</p>
            </div>
          )}
        </div>
      </div>

      {/* MUSIC */}
      <MusicPane
        state={musicState}
        url={musicUrl}
        slideshowOnline={slideshowOnline}
        youtubeStatus={youtubeStatus}
        onYouTubeStatusChange={onYouTubeStatusChange}
        spotifyStatus={spotifyStatus}
        onSpotifyStatusChange={onSpotifyStatusChange}
        onOpenOutput={onOpenOutput}
        onLoadYouTubePlaylist={onMusicLoadYouTubePlaylist}
        onLoadYouTubeTrack={onMusicLoadYouTubeTrack}
        onLoadYouTubeVideo={onMusicLoadYouTubeVideo}
        onLoadSpotify={onMusicLoadSpotify}
        onPlay={onMusicPlay}
        onPause={onMusicPause}
        onNext={onMusicNext}
        onPrev={onMusicPrev}
        onPlayAt={onMusicPlayAt}
        onSeek={onMusicSeek}
        onVolume={onMusicVolume}
        onStop={onMusicStop}
      />
    </aside>
  )
}

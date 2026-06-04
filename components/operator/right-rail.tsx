"use client"

import type { SelectedVerse, FontSize } from "@/components/slide-stage"
import { BackgroundPopover } from "./background-popover"
import { MusicPane } from "./music-pane"
import { SlideLivePanel } from "./slide-live-panel"
import { SlidePreviewPanel } from "./slide-preview-panel"
import type { RefObject } from "react"
import type { MusicState } from "@/lib/music-protocol"
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

  return (
    <aside className="w-[500px] shrink-0 h-full border-l border-border bg-card/30 flex flex-col overflow-hidden">
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

      <SlidePreviewPanel
        verses={previewVerses}
        mediaUrl={previewMediaUrl}
        fontSize={fontSize}
        version={version}
        backgroundColor={bg}
        backgroundImage={backgroundImage}
        backgroundKind={backgroundKind}
        contentRef={previewContentRef}
        onGoLive={onGoLive}
        onApplyHighlight={onApplyHighlight}
        onClearHighlights={onClearHighlights}
        onDefineSelection={onDefineSelection}
        onAddToQueue={onAddPreviewToQueue}
      />

      <SlideLivePanel
        verses={liveVerses}
        mediaUrl={liveMediaUrl}
        fontSize={fontSize}
        version={version}
        backgroundColor={bg}
        backgroundImage={backgroundImage}
        backgroundKind={backgroundKind}
        onOpenOutput={onOpenOutput}
        onClearLive={onClearLive}
      />

      {/* MUSIC */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
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
      </div>
    </aside>
  )
}

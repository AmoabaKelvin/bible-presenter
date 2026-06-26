"use client"

import type { SelectedVerse, FontSize } from "@/components/slide-stage"
import { BackgroundPopover, type ResolvedTargets } from "./background-popover"
import { MusicPane } from "./music-pane"
import { SlideLivePanel } from "./slide-live-panel"
import { SlidePreviewPanel } from "./slide-preview-panel"
import { PresentationSettingsDialog } from "./presentation-settings-dialog"
import type { PresentationSettings } from "@/lib/presentation-settings"
import type { BackgroundTarget } from "@/lib/background-config"
import type { ResolvedBackground } from "@/hooks/use-operator-background"
import type { RefObject } from "react"
import type { MusicState } from "@/lib/music-protocol"
import type { SpotifyAuthStatus } from "@/lib/spotify-music"
import type { YouTubeAuthStatus, YouTubePlaylistSummary, YouTubePlaylistTrack } from "@/lib/youtube-account"

interface RightRailProps {
  previewVerses: SelectedVerse[]
  liveVerses: SelectedVerse[]
  previewMediaUrl: string | null
  liveMediaUrl: string | null
  previewMediaKind: "image" | "video"
  liveMediaKind: "image" | "video"
  fontSize: FontSize
  onFontSizeChange: (s: FontSize) => void
  presentation: PresentationSettings
  onPresentationChange: (s: PresentationSettings) => void
  version: string
  // Resolved backgrounds for each panel (by their first slide's kind) and the
  // per-type controls.
  previewBackground: ResolvedBackground
  liveBackground: ResolvedBackground
  defaultBackground: ResolvedBackground
  backgroundTargets: ResolvedTargets
  onLayerColorChange: (target: BackgroundTarget, color: string) => void
  onUploadLayerImage: (target: BackgroundTarget, file: File) => void
  onClearLayerImage: (target: BackgroundTarget) => void
  onResetLayer: (target: BackgroundTarget) => void
  onResetAllBackgrounds: () => void
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
  previewMediaKind,
  liveMediaKind,
  fontSize,
  onFontSizeChange,
  presentation,
  onPresentationChange,
  version,
  previewBackground,
  liveBackground,
  defaultBackground,
  backgroundTargets,
  onLayerColorChange,
  onUploadLayerImage,
  onClearLayerImage,
  onResetLayer,
  onResetAllBackgrounds,
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
  // The settings-dialog preview renders a sample scripture verse, so it shows
  // the default layer. Fall back to a neutral color until persistence loads.
  const settingsBgColor = themeLoaded ? defaultBackground.color : "#0a0a0a"

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
            targets={backgroundTargets}
            onColorChange={onLayerColorChange}
            onUploadImage={onUploadLayerImage}
            onClearImage={onClearLayerImage}
            onResetLayer={onResetLayer}
            onResetAll={onResetAllBackgrounds}
          />
          <PresentationSettingsDialog
            settings={presentation}
            onChange={onPresentationChange}
            backgroundColor={settingsBgColor}
            backgroundImage={defaultBackground.url}
            backgroundKind={defaultBackground.kind}
            version={version}
          />
        </div>
      </div>

      <SlidePreviewPanel
        verses={previewVerses}
        mediaUrl={previewMediaUrl}
        mediaKind={previewMediaKind}
        fontSize={fontSize}
        presentation={presentation}
        version={version}
        backgroundColor={themeLoaded ? previewBackground.color : "#0a0a0a"}
        backgroundImage={previewBackground.url}
        backgroundKind={previewBackground.kind}
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
        mediaKind={liveMediaKind}
        fontSize={fontSize}
        presentation={presentation}
        version={version}
        backgroundColor={themeLoaded ? liveBackground.color : "#0a0a0a"}
        backgroundImage={liveBackground.url}
        backgroundKind={liveBackground.kind}
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

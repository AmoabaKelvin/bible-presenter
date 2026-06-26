"use client"

import { ExternalLink } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  SlideContent,
  SlideStage,
  type FontSize,
  type SelectedVerse,
} from "@/components/slide-stage"
import type { PresentationSettings } from "@/lib/presentation-settings"

interface SlideLivePanelProps {
  verses: SelectedVerse[]
  mediaUrl: string | null
  mediaKind: "image" | "video"
  fontSize: FontSize
  presentation: PresentationSettings
  version: string
  backgroundColor: string
  backgroundImage: string | null
  backgroundKind: "image" | "video" | null
  onOpenOutput: () => void
  onClearLive: () => void
}

export function SlideLivePanel({
  verses,
  mediaUrl,
  mediaKind,
  fontSize,
  presentation,
  version,
  backgroundColor,
  backgroundImage,
  backgroundKind,
  onOpenOutput,
  onClearLive,
}: SlideLivePanelProps) {
  const isLive = verses.length > 0 || !!mediaUrl

  return (
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
        className={`aspect-video rounded-md overflow-hidden bg-black relative ${
          isLive
            ? "border-2 border-[color:var(--live)] shadow-[0_0_0_3px_color-mix(in_oklch,var(--live)_22%,transparent)]"
            : "border border-border"
        }`}
      >
        <SlideStage
          backgroundColor={backgroundColor}
          backgroundImage={backgroundImage}
          backgroundKind={backgroundKind ?? undefined}
          mediaUrl={mediaUrl}
          mediaKind={mediaKind}
          className="w-full h-full"
        >
          {verses.length > 0 && (
            <SlideContent
              verses={verses}
              fontSize={fontSize}
              backgroundColor={backgroundColor}
              backgroundImage={backgroundImage}
              defaultVersion={version}
              presentation={presentation}
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
  )
}

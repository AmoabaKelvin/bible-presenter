"use client"

import type { RefObject } from "react"
import { BookA, Eraser, Highlighter, Plus, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  SlideContent,
  SlideStage,
  type FontSize,
  type SelectedVerse,
} from "@/components/slide-stage"

const HIGHLIGHTS = [
  { value: "rgba(250, 204, 21, 0.55)", swatch: "#facc15", label: "Yellow" },
  { value: "rgba(74, 222, 128, 0.55)", swatch: "#4ade80", label: "Green" },
  { value: "rgba(96, 165, 250, 0.55)", swatch: "#60a5fa", label: "Blue" },
  { value: "rgba(244, 114, 182, 0.55)", swatch: "#f472b6", label: "Pink" },
  { value: "rgba(251, 146, 60, 0.55)", swatch: "#fb923c", label: "Orange" },
]

interface SlidePreviewPanelProps {
  verses: SelectedVerse[]
  mediaUrl: string | null
  fontSize: FontSize
  version: string
  backgroundColor: string
  backgroundImage: string | null
  backgroundKind: "image" | "video" | null
  contentRef: RefObject<HTMLDivElement | null>
  onGoLive: () => void
  onApplyHighlight: (color: string) => void
  onClearHighlights: () => void
  onDefineSelection: () => void
  onAddToQueue: () => void
}

export function SlidePreviewPanel({
  verses,
  mediaUrl,
  fontSize,
  version,
  backgroundColor,
  backgroundImage,
  backgroundKind,
  contentRef,
  onGoLive,
  onApplyHighlight,
  onClearHighlights,
  onDefineSelection,
  onAddToQueue,
}: SlidePreviewPanelProps) {
  const hasPreview = verses.length > 0 || !!mediaUrl

  return (
    <div className="p-4 border-b border-border shrink-0">
      <div className="flex items-center justify-between mb-2.5">
        <span className="eyebrow">Preview</span>
        <div className="flex items-center gap-1">
          <Highlighter className="size-3 text-muted-foreground" />
          {HIGHLIGHTS.map((highlight) => (
            <Tooltip key={highlight.swatch}>
              <TooltipTrigger asChild>
                <button
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onApplyHighlight(highlight.value)}
                  aria-label={`Highlight ${highlight.label}`}
                  className="size-3.5 rounded-sm border border-border/70 hover:scale-110 transition-transform"
                  style={{ backgroundColor: highlight.swatch }}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">{highlight.label}</TooltipContent>
            </Tooltip>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onMouseDown={(event) => event.preventDefault()}
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
                onMouseDown={(event) => event.preventDefault()}
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
          backgroundColor={backgroundColor}
          backgroundImage={backgroundImage}
          backgroundKind={backgroundKind ?? undefined}
          mediaUrl={mediaUrl}
          className="w-full h-full"
        >
          {verses.length > 0 && (
            <SlideContent
              verses={verses}
              fontSize={fontSize}
              backgroundColor={backgroundColor}
              backgroundImage={backgroundImage}
              defaultVersion={version}
              innerRef={contentRef}
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
              onClick={onAddToQueue}
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
  )
}

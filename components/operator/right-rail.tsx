"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Highlighter,
  Radio,
  X,
  Eraser,
  ExternalLink,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { SlideStage, SlideContent, type SelectedVerse, type FontSize } from "@/components/slide-stage"
import { BackgroundPopover } from "./background-popover"
import type { RefObject } from "react"

interface RightRailProps {
  previewVerses: SelectedVerse[]
  liveVerses: SelectedVerse[]
  previewMediaUrl: string | null
  liveMediaUrl: string | null
  queue: SelectedVerse[]
  queueCursor: number
  fontSize: FontSize
  onFontSizeChange: (s: FontSize) => void
  version: string
  backgroundColor: string
  onBackgroundColorChange: (c: string) => void
  backgroundImage: string | null
  onBackgroundImageChange: (img: string | null) => void
  onResetBackground: () => void
  themeLoaded: boolean
  previewContentRef: RefObject<HTMLDivElement | null>
  onGoLive: () => void
  onClearLive: () => void
  onOpenOutput: () => void
  onApplyHighlight: (color: string) => void
  onClearHighlights: () => void
  onAddPreviewToQueue: () => void
  onQueuePreviewAt: (idx: number) => void
  onQueueProjectAt: (idx: number) => void
  onQueueRemove: (id: string) => void
  onQueueReorder: (from: number, to: number) => void
  onQueuePrev: () => void
  onQueueNext: () => void
  onClearQueue: () => void
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

function stripHtml(s: string) {
  if (typeof window === "undefined") return s.replace(/<[^>]+>/g, "")
  const tmp = document.createElement("div")
  tmp.innerHTML = s
  return tmp.textContent || ""
}

export function RightRail({
  previewVerses,
  liveVerses,
  previewMediaUrl,
  liveMediaUrl,
  queue,
  queueCursor,
  fontSize,
  onFontSizeChange,
  version,
  backgroundColor,
  onBackgroundColorChange,
  backgroundImage,
  onBackgroundImageChange,
  onResetBackground,
  themeLoaded,
  previewContentRef,
  onGoLive,
  onClearLive,
  onOpenOutput,
  onApplyHighlight,
  onClearHighlights,
  onAddPreviewToQueue,
  onQueuePreviewAt,
  onQueueProjectAt,
  onQueueRemove,
  onQueueReorder,
  onQueuePrev,
  onQueueNext,
  onClearQueue,
}: RightRailProps) {
  const bg = themeLoaded ? backgroundColor : "#0a0a0a"
  const isLive = liveVerses.length > 0 || !!liveMediaUrl
  const hasPreview = previewVerses.length > 0 || !!previewMediaUrl
  const hasQueue = queue.length > 0
  const cursorValid = queueCursor >= 0 && queueCursor < queue.length

  return (
    <aside className="w-[500px] shrink-0 h-full border-l border-border bg-card/30 flex flex-col">
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
            onColorChange={onBackgroundColorChange}
            onImageChange={onBackgroundImageChange}
            onReset={onResetBackground}
          />
        </div>
      </div>

      {/* PREVIEW */}
      <div className="p-4 border-b border-border">
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
          </div>
        </div>

        <div className="aspect-video rounded-md overflow-hidden border border-border bg-black relative">
          <SlideStage
            backgroundColor={bg}
            backgroundImage={backgroundImage}
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
            className="flex-1 h-10 text-sm font-medium"
          >
            <Radio className="size-4 mr-2" />
            Go live
            <kbd className="ml-auto px-1.5 py-0.5 text-[10px] font-mono rounded border border-background/30 bg-background/10">
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
      <div className="p-4 border-b border-border">
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
              <TooltipContent side="bottom">Open output window (1920×1080)</TooltipContent>
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

      {/* QUEUE */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/60">
          <div className="flex items-baseline gap-2">
            <span className="eyebrow">Queue</span>
            {hasQueue && (
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                {cursorValid ? `${queueCursor + 1} / ${queue.length}` : queue.length}
              </span>
            )}
          </div>
          {hasQueue && (
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onQueuePrev}
                    className="size-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label="Previous cue"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Prev (←)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onQueueNext}
                    className="size-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label="Next cue"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Next (→)</TooltipContent>
              </Tooltip>
              <span className="mx-1 h-4 w-px bg-border" />
              <button
                onClick={onClearQueue}
                className="text-[10px] font-mono uppercase tracking-wider px-1.5 h-7 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {!hasQueue ? (
            <div className="px-4 pt-3 pb-6">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Build a setlist for the service. Add verses (hover &amp; click <span className="inline-block size-3.5 align-text-bottom rounded-sm border border-border bg-card text-center text-[10px] leading-[14px]">+</span>) or push whatever&rsquo;s in preview here. Step through with arrow keys during the meeting.
              </p>
            </div>
          ) : (
            <ul className="px-2 py-2 space-y-0.5">
              {queue.map((v, i) => {
                const isCursor = i === queueCursor
                return (
                  <li
                    key={v.id}
                    onClick={() => onQueuePreviewAt(i)}
                    onDoubleClick={() => onQueueProjectAt(i)}
                    className={`group relative flex items-start gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${
                      isCursor ? "bg-foreground/[0.06]" : "hover:bg-accent/60"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-colors ${
                        isCursor ? "bg-[color:var(--live)]" : "bg-transparent"
                      }`}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground w-5 tabular-nums pt-0.5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`text-[12px] font-mono truncate ${
                            isCursor ? "text-foreground font-medium" : "text-foreground/85"
                          }`}
                        >
                          {v.reference || "Note"}
                        </span>
                        {v.version && (
                          <span className="text-[9.5px] font-mono px-1 py-px rounded border border-border text-muted-foreground shrink-0 tracking-wider">
                            {v.version}
                          </span>
                        )}
                        {isCursor && (
                          <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-[color:var(--live)]">
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {stripHtml(v.text)}
                      </p>
                    </div>
                    <div
                      className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-card/95 backdrop-blur-sm rounded-md border border-border p-0.5 shadow-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onQueueReorder(i, Math.max(0, i - 1))}
                        disabled={i === 0}
                        aria-label="Move up"
                        className="size-5 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      >
                        <ChevronUp className="size-3" />
                      </button>
                      <button
                        onClick={() => onQueueReorder(i, Math.min(queue.length - 1, i + 1))}
                        disabled={i === queue.length - 1}
                        aria-label="Move down"
                        className="size-5 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      >
                        <ChevronDown className="size-3" />
                      </button>
                      <button
                        onClick={() => onQueueRemove(v.id)}
                        aria-label="Remove from queue"
                        className="size-5 grid place-items-center rounded text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
      </div>
    </aside>
  )
}

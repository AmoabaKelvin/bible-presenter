"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import type { SelectedVerse } from "@/components/slide-stage"

function stripHtml(s: string) {
  if (typeof window === "undefined") return s.replace(/<[^>]+>/g, "")
  const tmp = document.createElement("div")
  tmp.innerHTML = s
  return tmp.textContent || ""
}

interface QueuePaneProps {
  queue: SelectedVerse[]
  queueCursor: number
  onPreviewAt: (idx: number) => void
  onProjectAt: (idx: number) => void
  onRemove: (id: string) => void
  onReorder: (from: number, to: number) => void
  onPrev: () => void
  onNext: () => void
  onClear: () => void
}

export function QueuePane({
  queue,
  queueCursor,
  onPreviewAt,
  onProjectAt,
  onRemove,
  onReorder,
  onPrev,
  onNext,
  onClear,
}: QueuePaneProps) {
  const hasQueue = queue.length > 0
  const cursorValid = queueCursor >= 0 && queueCursor < queue.length

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/60">
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
                  onClick={onPrev}
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
                  onClick={onNext}
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
              onClick={onClear}
              className="text-[10px] font-mono uppercase tracking-wider px-1.5 h-7 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {!hasQueue ? (
          <div className="px-3 pt-3 pb-6">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Build a setlist for the service. Add verses (hover and click <span className="inline-block size-3.5 align-text-bottom rounded-sm border border-border bg-card text-center text-[10px] leading-[14px]">+</span>) or push whatever&rsquo;s in preview here. Step through with arrow keys during the meeting.
            </p>
          </div>
        ) : (
          <ul className="px-2 py-2 space-y-0.5">
            {queue.map((v, i) => {
              const isCursor = i === queueCursor
              return (
                <li
                  key={v.id}
                  onClick={() => onPreviewAt(i)}
                  onDoubleClick={() => onProjectAt(i)}
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
                      onClick={() => onReorder(i, Math.max(0, i - 1))}
                      disabled={i === 0}
                      aria-label="Move up"
                      className="size-5 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronUp className="size-3" />
                    </button>
                    <button
                      onClick={() => onReorder(i, Math.min(queue.length - 1, i + 1))}
                      disabled={i === queue.length - 1}
                      aria-label="Move down"
                      className="size-5 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronDown className="size-3" />
                    </button>
                    <button
                      onClick={() => onRemove(v.id)}
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
  )
}

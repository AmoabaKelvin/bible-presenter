"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Trash2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { HistoryItem } from "./types"

const RECENT_OPEN_KEY = "flowwwwRecentOpen"

function relativeTime(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

function stripHtml(s: string) {
  if (typeof window === "undefined") return s.replace(/<[^>]+>/g, "")
  const tmp = document.createElement("div")
  tmp.innerHTML = s
  return tmp.textContent || ""
}

interface RecentSectionProps {
  recent: HistoryItem[]
  onSelectRecent: (item: HistoryItem) => void
  onClearRecent: () => void
}

export function RecentSection({ recent, onSelectRecent, onClearRecent }: RecentSectionProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_OPEN_KEY)
      if (stored === "1") setOpen(true)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(RECENT_OPEN_KEY, open ? "1" : "0")
    } catch {
      // ignore
    }
  }, [open])

  return (
    <div
      className={`border-t border-border flex flex-col min-h-0 ${
        open ? "max-h-[40%]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 h-9 hover:bg-accent/40 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-baseline gap-2">
          <span className="eyebrow">Recent</span>
          {recent.length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {recent.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {open && recent.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClearRecent()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      e.stopPropagation()
                      onClearRecent()
                    }
                  }}
                  className="size-6 grid place-items-center text-muted-foreground hover:text-foreground rounded transition-colors"
                  aria-label="Clear recent"
                >
                  <Trash2 className="size-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">Clear recent</TooltipContent>
            </Tooltip>
          )}
          <ChevronDown
            className={`size-3.5 text-muted-foreground transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
        </div>
      </button>

      {open && (
        <ScrollArea className="flex-1 min-h-0">
          <ul className="px-2 pb-3 space-y-0.5">
            {recent.length === 0 ? (
              <li className="px-2 py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Nothing yet — items you take live will appear here.
                </p>
              </li>
            ) : (
              recent.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onSelectRecent(item)}
                    className="group w-full text-left px-2.5 py-2 rounded-md hover:bg-accent/60 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-[12px] font-mono text-foreground truncate">
                          {item.reference || "Note"}
                        </span>
                        {item.version && (
                          <span className="text-[9.5px] font-mono px-1 py-px rounded border border-border text-muted-foreground shrink-0 tracking-wider">
                            {item.version}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        {relativeTime(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground line-clamp-2 mt-0.5">
                      {stripHtml(item.text)}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}

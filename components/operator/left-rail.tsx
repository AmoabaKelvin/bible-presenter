"use client"

import { Book, FileText, Image as ImageIcon, RotateCcw, BookMarked } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ThemeToggle } from "./theme-toggle"
import { MusicBar } from "./music-bar"
import type { Mode, HistoryItem } from "./types"
import type { MusicState } from "@/lib/youtube-music"

interface LeftRailProps {
  mode: Mode
  onModeChange: (m: Mode) => void
  recent: HistoryItem[]
  onSelectRecent: (item: HistoryItem) => void
  onClearRecent: () => void
  musicState: MusicState
  musicUrl: string | null
  slideshowOnline: boolean
  onOpenOutput: () => void
  onMusicLoad: (url: string) => void
  onMusicPlay: () => void
  onMusicPause: () => void
  onMusicNext: () => void
  onMusicPrev: () => void
  onMusicVolume: (v: number) => void
  onMusicStop: () => void
}

const MODES: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "bible", label: "Bible", icon: Book },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "media", label: "Media", icon: ImageIcon },
]

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

export function LeftRail({
  mode,
  onModeChange,
  recent,
  onSelectRecent,
  onClearRecent,
  musicState,
  musicUrl,
  slideshowOnline,
  onOpenOutput,
  onMusicLoad,
  onMusicPlay,
  onMusicPause,
  onMusicNext,
  onMusicPrev,
  onMusicVolume,
  onMusicStop,
}: LeftRailProps) {
  return (
    <aside className="w-[320px] shrink-0 h-full border-r border-border bg-card/30 flex flex-col">
      <div className="h-14 shrink-0 px-4 flex items-center gap-2 border-b border-border">
        <div className="size-7 grid place-items-center rounded-md bg-foreground text-background">
          <BookMarked className="size-3.5" />
        </div>
        <div className="leading-none">
          <div className="text-[13px] font-medium tracking-tight">flowwww</div>
        </div>
      </div>

      <nav className="p-2 border-b border-border">
        <ul className="space-y-0.5">
          {MODES.map(({ id, label, icon: Icon }) => {
            const active = mode === id
            return (
              <li key={id}>
                <button
                  onClick={() => onModeChange(id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4" />
                  <span>{label}</span>
                  {active && (
                    <span className="ml-auto size-1.5 rounded-full bg-foreground" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex items-center justify-between px-3 pt-4 pb-2">
        <span className="eyebrow">Recent</span>
        {recent.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClearRecent}
                className="size-6 grid place-items-center text-muted-foreground hover:text-foreground rounded transition-colors"
                aria-label="Clear recent"
              >
                <RotateCcw className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Clear recent</TooltipContent>
          </Tooltip>
        )}
      </div>

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

      <MusicBar
        state={musicState}
        url={musicUrl}
        slideshowOnline={slideshowOnline}
        onOpenOutput={onOpenOutput}
        onLoad={onMusicLoad}
        onPlay={onMusicPlay}
        onPause={onMusicPause}
        onNext={onMusicNext}
        onPrev={onMusicPrev}
        onVolume={onMusicVolume}
        onStop={onMusicStop}
      />

      <div className="border-t border-border p-2">
        <ThemeToggle />
      </div>
    </aside>
  )
}

function stripHtml(s: string) {
  if (typeof window === "undefined") return s.replace(/<[^>]+>/g, "")
  const tmp = document.createElement("div")
  tmp.innerHTML = s
  return tmp.textContent || ""
}

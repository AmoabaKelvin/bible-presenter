"use client"

import { Book, FileText, Image as ImageIcon, BookMarked } from "lucide-react"
import { ThemeToggle } from "./theme-toggle"
import { QueuePane } from "./queue-pane"
import { RecentSection } from "./recent-section"
import type { Mode, HistoryItem } from "./types"
import type { SelectedVerse } from "@/components/slide-stage"

interface LeftRailProps {
  mode: Mode
  onModeChange: (m: Mode) => void
  recent: HistoryItem[]
  onSelectRecent: (item: HistoryItem) => void
  onClearRecent: () => void
  queue: SelectedVerse[]
  queueCursor: number
  onQueuePreviewAt: (idx: number) => void
  onQueueProjectAt: (idx: number) => void
  onQueueRemove: (id: string) => void
  onQueueReorder: (from: number, to: number) => void
  onQueuePrev: () => void
  onQueueNext: () => void
  onClearQueue: () => void
}

const MODES: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "bible", label: "Bible", icon: Book },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "media", label: "Media", icon: ImageIcon },
]

export function LeftRail({
  mode,
  onModeChange,
  recent,
  onSelectRecent,
  onClearRecent,
  queue,
  queueCursor,
  onQueuePreviewAt,
  onQueueProjectAt,
  onQueueRemove,
  onQueueReorder,
  onQueuePrev,
  onQueueNext,
  onClearQueue,
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

      <QueuePane
        queue={queue}
        queueCursor={queueCursor}
        onPreviewAt={onQueuePreviewAt}
        onProjectAt={onQueueProjectAt}
        onRemove={onQueueRemove}
        onReorder={onQueueReorder}
        onPrev={onQueuePrev}
        onNext={onQueueNext}
        onClear={onClearQueue}
      />

      <RecentSection
        recent={recent}
        onSelectRecent={onSelectRecent}
        onClearRecent={onClearRecent}
      />

      <div className="border-t border-border p-2">
        <ThemeToggle />
      </div>
    </aside>
  )
}

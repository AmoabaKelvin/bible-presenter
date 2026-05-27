"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import type { BibleBook } from "@/lib/bible-data"

interface ChapterGridProps {
  book: BibleBook
  selected: number | null
  onSelect: (chapter: number) => void
}

export function ChapterGrid({ book, selected, onSelect }: ChapterGridProps) {
  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="px-8 py-8 max-w-[1100px] mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-medium tracking-tight">{book.name}</h2>
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            {book.chapters.length} chapters
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5">
          {book.chapters.map((verseCount, i) => {
            const chapter = i + 1
            const active = selected === chapter
            return (
              <button
                key={chapter}
                onClick={() => onSelect(chapter)}
                className={`group aspect-square rounded-md border transition-all flex flex-col items-center justify-center gap-0.5 ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:border-muted-foreground hover:bg-accent"
                }`}
              >
                <span className="text-base font-mono tabular-nums">{chapter}</span>
                <span
                  className={`text-[9px] font-mono tabular-nums ${
                    active ? "text-background/60" : "text-muted-foreground/70"
                  }`}
                >
                  {verseCount}v
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </ScrollArea>
  )
}

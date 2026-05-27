"use client"

import { useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { BibleBook, BibleRef } from "@/lib/bible-data"

export interface ChapterVerse {
  number: number
  text: string
}

interface ChapterReaderProps {
  book: BibleBook | null
  chapter: number | null
  verses: ChapterVerse[]
  loading: boolean
  error: string | null
  version: string
  selectedVerse: number | null
  rangeStart: number | null
  rangeEnd: number | null
  prevRef: BibleRef | null
  nextRef: BibleRef | null
  onNavigate: (ref: BibleRef) => void
  onSelectVerse: (verse: number, shiftKey: boolean) => void
  onDoubleClickVerse: (verse: number) => void
  onQueueVerse: (verse: number) => void
}

export function ChapterReader({
  book,
  chapter,
  verses,
  loading,
  error,
  version,
  selectedVerse,
  rangeStart,
  rangeEnd,
  prevRef,
  nextRef,
  onNavigate,
  onSelectVerse,
  onDoubleClickVerse,
  onQueueVerse,
}: ChapterReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Reset scroll position when chapter changes
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const sa = el.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null
    if (sa) sa.scrollTop = 0
  }, [book?.name, chapter])

  // Scroll the active verse into view when it changes (e.g. via jump search)
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const target = selectedVerse ?? rangeStart
    if (target == null) return
    const li = list.querySelector<HTMLLIElement>(`[data-verse-number="${target}"]`)
    if (!li) return
    li.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [selectedVerse, rangeStart, verses])

  if (!book || !chapter) return null

  if (loading && verses.length === 0) {
    return (
      <div className="flex-1 grid place-items-center">
        <Loader2 className="size-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 grid place-items-center px-8">
        <p className="text-sm text-destructive text-center">{error}</p>
      </div>
    )
  }

  const inRange = (n: number) =>
    rangeStart !== null && rangeEnd !== null && n >= rangeStart && n <= rangeEnd

  return (
    <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
      <article className="mx-auto max-w-[960px] px-10 pt-8 pb-24 select-text">
        <header className="mb-6 pb-4 border-b border-border flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <ChapterNav direction="prev" target={prevRef} onNavigate={onNavigate} />
            <h1 className="text-3xl tracking-tight font-medium">
              {book.name}{" "}
              <span className="text-muted-foreground font-normal">{chapter}</span>
            </h1>
            <ChapterNav direction="next" target={nextRef} onNavigate={onNavigate} />
          </div>
          <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider shrink-0">
            {version} · {verses.length} verses
          </span>
        </header>

        <ul ref={listRef}>
          {verses.map((v) => {
            const active = inRange(v.number) || selectedVerse === v.number
            return (
              <li
                key={v.number}
                data-verse-number={v.number}
                onClick={(e) => onSelectVerse(v.number, e.shiftKey)}
                onDoubleClick={() => onDoubleClickVerse(v.number)}
                className={`group relative flex gap-5 py-3 pr-12 pl-4 -mx-4 rounded-md cursor-pointer transition-colors ${
                  active ? "bg-foreground/[0.06]" : "hover:bg-accent/70"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full transition-colors ${
                    active
                      ? "bg-foreground"
                      : "bg-transparent group-hover:bg-foreground/30"
                  }`}
                />
                <span
                  className={`shrink-0 w-9 text-right font-mono tabular-nums text-[12px] pt-[7px] transition-colors ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground/60 group-hover:text-foreground"
                  }`}
                >
                  {v.number}
                </span>
                <p
                  className="flex-1 font-serif text-[19px] leading-[1.65] text-foreground/90"
                  dangerouslySetInnerHTML={{ __html: v.text }}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onQueueVerse(v.number)
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      aria-label={`Add verse ${v.number} to queue`}
                      className="absolute right-3 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-md border border-border bg-background text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent transition-all"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Add to queue</TooltipContent>
                </Tooltip>
              </li>
            )
          })}
        </ul>

        {(prevRef || nextRef) && (
          <nav
            className="mt-12 pt-6 border-t border-border flex items-center justify-center gap-5 text-sm"
            aria-label="Chapter navigation"
          >
            <ChapterNavInline direction="prev" target={prevRef} onNavigate={onNavigate} />
            <span aria-hidden className="text-muted-foreground/30 select-none">·</span>
            <ChapterNavInline direction="next" target={nextRef} onNavigate={onNavigate} />
          </nav>
        )}
      </article>
    </ScrollArea>
  )
}

function ChapterNav({
  direction,
  target,
  onNavigate,
}: {
  direction: "prev" | "next"
  target: BibleRef | null
  onNavigate: (ref: BibleRef) => void
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight
  const label = target ? `${target.book.name} ${target.chapter}` : null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => target && onNavigate(target)}
          disabled={!target}
          aria-label={
            target
              ? `${direction === "prev" ? "Previous" : "Next"} chapter: ${label}`
              : `No ${direction === "prev" ? "previous" : "next"} chapter`
          }
          className="size-6 grid place-items-center text-muted-foreground/60 hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground/60 transition-colors"
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {target ? label : direction === "prev" ? "Start of Bible" : "End of Bible"}
      </TooltipContent>
    </Tooltip>
  )
}

function ChapterNavInline({
  direction,
  target,
  onNavigate,
}: {
  direction: "prev" | "next"
  target: BibleRef | null
  onNavigate: (ref: BibleRef) => void
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight
  const isNext = direction === "next"
  if (!target) {
    return (
      <span className="text-muted-foreground/50 text-xs">
        {isNext ? "End of Bible" : "Start of Bible"}
      </span>
    )
  }
  const label = `${target.book.name} ${target.chapter}`
  return (
    <button
      type="button"
      onClick={() => onNavigate(target)}
      className="group inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
    >
      {!isNext && <Icon className="size-3.5" />}
      <span className="group-hover:underline underline-offset-4">{label}</span>
      {isNext && <Icon className="size-3.5" />}
    </button>
  )
}

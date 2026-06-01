"use client"

import { X } from "lucide-react"
import type { RefObject } from "react"
import type { BibleBook } from "@/lib/bible-data"

export function ScriptureTypeaheadChip({
  label,
  mono,
  onRemove,
}: {
  label: string
  mono?: boolean
  onRemove: () => void
}) {
  return (
    <span
      className={`h-6 inline-flex items-center gap-1 pl-1.5 pr-1 rounded-sm border border-border bg-accent/60 text-foreground text-[12px] shrink-0 ${
        mono ? "font-mono tabular-nums" : "font-medium"
      }`}
    >
      <span className="leading-none">{label}</span>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          onRemove()
        }}
        className="size-4 grid place-items-center rounded-[2px] text-muted-foreground hover:text-foreground hover:bg-background/60"
        aria-label={`Remove ${label}`}
        tabIndex={-1}
      >
        <X className="size-2.5" />
      </button>
    </span>
  )
}

export function ScriptureBookDropdown({
  matches,
  activeIndex,
  bookQuery,
  inputRef,
  onActiveIndexChange,
  onCommit,
}: {
  matches: BibleBook[]
  activeIndex: number
  bookQuery: string
  inputRef: RefObject<HTMLInputElement | null>
  onActiveIndexChange: (index: number) => void
  onCommit: (index: number) => void
}) {
  return (
    <div
      id="scripture-typeahead-listbox"
      role="listbox"
      className="absolute z-50 right-0 mt-1 w-[280px] max-h-72 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md scroll-thin"
    >
      {matches.map((match, index) => {
        const active = index === activeIndex
        return (
          <button
            key={match.name}
            type="button"
            role="option"
            aria-selected={active}
            onMouseEnter={() => onActiveIndexChange(index)}
            onMouseDown={(event) => {
              event.preventDefault()
              onCommit(index)
              inputRef.current?.focus()
            }}
            className={`w-full text-left px-2.5 py-1.5 text-sm flex items-center justify-between gap-2 ${
              active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
            }`}
          >
            <span className="truncate">{renderHighlightedName(match.name, bookQuery)}</span>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
              {match.chapters.length} ch
            </span>
          </button>
        )
      })}
    </div>
  )
}

function renderHighlightedName(name: string, query: string) {
  const q = query.trim()
  if (!q) return name
  const index = name.toLowerCase().indexOf(q.toLowerCase())
  if (index === -1) return name
  return (
    <>
      {name.slice(0, index)}
      <span className="font-semibold text-foreground">
        {name.slice(index, index + q.length)}
      </span>
      {name.slice(index + q.length)}
    </>
  )
}

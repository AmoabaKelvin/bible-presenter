"use client"

import { Eye, Plus } from "lucide-react"
import { CommandGroup, CommandItem } from "@/components/ui/command"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { SelectedVerse } from "@/components/slide-stage"
import type { DictionaryResultRow } from "@/hooks/use-dictionary-lookup"
import { definitionToSlide } from "@/lib/dictionary"
import type { ScriptureSearchResult } from "@/lib/scripture-search"

interface DictionaryResultsProps {
  rows: DictionaryResultRow[]
  onPreview: (verse: SelectedVerse) => void
  onProject: (verse: SelectedVerse) => void
  onQueue: (verse: SelectedVerse) => void
  onClose: () => void
}

export function DictionaryResults({
  rows,
  onPreview,
  onProject,
  onQueue,
  onClose,
}: DictionaryResultsProps) {
  if (rows.length === 0) return null
  return (
    <CommandGroup heading="Dictionary">
      {rows.map((row, index) => {
        const slide = () => definitionToSlide(row.word, row.text)
        return (
          <CommandItem
            key={`${row.source}-${row.word}-${index}`}
            value={`${row.word}-${row.source}-${index}`}
            onSelect={() => {
              onProject(slide())
              onClose()
            }}
            className="group flex-col items-start gap-1 py-2.5"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="font-serif text-[15px] capitalize text-foreground">
                {row.word}
                {row.senseNo != null && (
                  <span className="ml-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                    ·{row.senseNo}
                  </span>
                )}
                <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {row.source === "eastons" ? "Easton's" : "Webster's"}
                </span>
              </span>
              <span className="flex items-center gap-1 opacity-0 group-data-[selected=true]:opacity-100 transition-opacity">
                <RowAction
                  label="Preview"
                  onClick={(event) => {
                    event.stopPropagation()
                    onPreview(slide())
                    onClose()
                  }}
                >
                  <Eye className="size-3.5" />
                </RowAction>
                <RowAction
                  label="Add to queue"
                  onClick={(event) => {
                    event.stopPropagation()
                    onQueue(slide())
                  }}
                >
                  <Plus className="size-3.5" />
                </RowAction>
              </span>
            </div>
            <p className="font-serif text-[14px] leading-snug text-foreground/80 line-clamp-2">
              {row.text}
            </p>
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}

interface ScriptureResultsProps {
  results: ScriptureSearchResult[]
  total: number
  onPreview: (result: ScriptureSearchResult) => void
  onProject: (result: ScriptureSearchResult) => void
  onQueue: (result: ScriptureSearchResult) => void
  onNavigate: (result: ScriptureSearchResult) => void
  onClose: () => void
}

export function ScriptureResults({
  results,
  total,
  onPreview,
  onProject,
  onQueue,
  onNavigate,
  onClose,
}: ScriptureResultsProps) {
  if (results.length === 0) return null
  return (
    <CommandGroup heading={`Scripture · ${total} ${total === 1 ? "result" : "results"}`}>
      {results.map((result, index) => (
        <CommandItem
          key={`${result.reference}-${index}`}
          value={`${result.reference}-${index}`}
          onSelect={() => {
            onNavigate(result)
            onClose()
          }}
          className="group flex-col items-start gap-1 py-2.5"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="font-mono text-[12px] text-muted-foreground">
              {result.reference}
            </span>
            <span className="flex items-center gap-1 opacity-0 group-data-[selected=true]:opacity-100 transition-opacity">
              <RowAction
                label="Preview"
                onClick={(event) => {
                  event.stopPropagation()
                  onPreview(result)
                  onClose()
                }}
              >
                <Eye className="size-3.5" />
              </RowAction>
              <RowAction
                label="Add to queue"
                onClick={(event) => {
                  event.stopPropagation()
                  onQueue(result)
                }}
              >
                <Plus className="size-3.5" />
              </RowAction>
            </span>
          </div>
          <p
            className="font-serif text-[15px] leading-snug text-foreground/90 line-clamp-2 [&_em]:not-italic [&_em]:font-semibold [&_em]:text-foreground"
            dangerouslySetInnerHTML={{ __html: result.highlight ?? result.text }}
          />
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: (event: React.MouseEvent) => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="size-6 grid place-items-center rounded-sm border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

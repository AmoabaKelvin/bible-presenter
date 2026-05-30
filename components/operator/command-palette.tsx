"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Plus, Eye } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useScriptureSearch } from "@/hooks/use-scripture-search"
import type { ScriptureSearchResult } from "@/lib/scripture-search"
import type { SelectedVerse } from "@/components/slide-stage"
import {
  lookup,
  parseSenses,
  definitionToSlide,
  preloadDictionary,
  type DictEntry,
} from "@/lib/dictionary"

// The palette projects a definition's first (primary) sense — the operator can
// refine it afterward in the Define pane's editor.
function firstSenseSlide(e: DictEntry) {
  return definitionToSlide(e.word, parseSenses(e.definition)[0]?.text ?? e.definition)
}

type PaletteMode = "scripture" | "dictionary"

interface CommandPaletteProps {
  version: string
  onPreview: (result: ScriptureSearchResult) => void
  onProject: (result: ScriptureSearchResult) => void
  onQueue: (result: ScriptureSearchResult) => void
  onDefinePreview: (v: SelectedVerse) => void
  onDefineProject: (v: SelectedVerse) => void
  onDefineQueue: (v: SelectedVerse) => void
}

export function CommandPalette({
  version,
  onPreview,
  onProject,
  onQueue,
  onDefinePreview,
  onDefineProject,
  onDefineQueue,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("scripture")
  const [query, setQuery] = useState("")
  const { results, total, loading, error, hasMore, loadMore, activeQuery } =
    useScriptureSearch(paletteMode === "scripture" ? query : "", version)

  // Dictionary lookup state (only used in "dictionary" mode).
  const [defEntries, setDefEntries] = useState<DictEntry[]>([])
  const [defLoading, setDefLoading] = useState(false)
  const defReqId = useRef(0)

  useEffect(() => {
    if (paletteMode === "dictionary") preloadDictionary()
  }, [paletteMode])

  useEffect(() => {
    if (paletteMode !== "dictionary") return
    const q = query.trim()
    if (q.length < 2) {
      setDefEntries([])
      setDefLoading(false)
      return
    }
    setDefLoading(true)
    const id = ++defReqId.current
    const handle = setTimeout(async () => {
      const res = await lookup(q)
      if (id !== defReqId.current) return
      setDefEntries(res.entries)
      setDefLoading(false)
    }, 200)
    return () => clearTimeout(handle)
  }, [query, paletteMode])

  // Infinite scroll — fetch the next page as the list nears the bottom.
  // Works for both mouse-wheel scrolling and arrow-key navigation (cmdk
  // scrolls the active item into view, which fires this too).
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (loading || !hasMore) return
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) loadMore()
  }

  // Global Cmd/Ctrl+K toggles the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Clear the query when the palette closes so it opens fresh.
  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const close = () => setOpen(false)
  const project = (r: ScriptureSearchResult) => {
    onProject(r)
    close()
  }
  const preview = (r: ScriptureSearchResult) => {
    onPreview(r)
    close()
  }
  const projectDef = (e: DictEntry) => {
    onDefineProject(firstSenseSlide(e))
    close()
  }

  const isDict = paletteMode === "dictionary"
  const showHint = query.trim().length < 2
  const showSearching = isDict
    ? defLoading && defEntries.length === 0
    : loading && results.length === 0
  const showEmpty = isDict
    ? !defLoading && !showHint && defEntries.length === 0
    : !loading && !error && activeQuery !== "" && results.length === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden p-0 max-w-2xl top-[18%] translate-y-0"
      >
        <DialogTitle className="sr-only">Search the Bible</DialogTitle>
        <DialogDescription className="sr-only">
          Search across every verse and preview a result, or define a word.
        </DialogDescription>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-input-wrapper]]:h-12"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={
              isDict
                ? "Define a word — e.g. charity, Melchizedek…"
                : "Search the Bible — a word, phrase, or topic…"
            }
          />
          <div className="flex items-center gap-1 border-b px-2 py-1.5">
            {(["scripture", "dictionary"] as PaletteMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setPaletteMode(m)}
                className={`h-6 px-2.5 rounded text-[11px] font-medium transition-colors ${
                  paletteMode === m
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "scripture" ? "Scripture" : "Define"}
              </button>
            ))}
          </div>
          <CommandList className="max-h-[60vh]" onScroll={handleScroll}>
            {showHint && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Type at least 2 characters to {isDict ? "define" : "search"}.
              </div>
            )}
            {showSearching && (
              <div className="py-10 grid place-items-center">
                <Loader2 className="size-5 text-muted-foreground animate-spin" />
              </div>
            )}
            {error && !loading && (
              <div className="py-10 text-center text-sm text-destructive">
                {error}
              </div>
            )}
            {showEmpty && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {isDict
                  ? `No entry for “${query.trim()}”.`
                  : `No verses match “${activeQuery}”.`}
              </div>
            )}
            {isDict && defEntries.length > 0 && (
              <CommandGroup heading="Dictionary">
                {defEntries.map((e, i) => (
                  <CommandItem
                    key={`${e.source}-${i}`}
                    value={`${e.word}-${e.source}-${i}`}
                    onSelect={() => projectDef(e)}
                    className="group flex-col items-start gap-1 py-2.5"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-serif text-[15px] capitalize text-foreground">
                        {e.word}
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {e.source === "eastons" ? "Easton's" : "Webster's"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 opacity-0 group-data-[selected=true]:opacity-100 transition-opacity">
                        <RowAction
                          label="Preview"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            onDefinePreview(firstSenseSlide(e))
                            close()
                          }}
                        >
                          <Eye className="size-3.5" />
                        </RowAction>
                        <RowAction
                          label="Add to queue"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            onDefineQueue(firstSenseSlide(e))
                          }}
                        >
                          <Plus className="size-3.5" />
                        </RowAction>
                      </span>
                    </div>
                    <p className="font-serif text-[14px] leading-snug text-foreground/80 line-clamp-2">
                      {e.definition}
                    </p>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!isDict && results.length > 0 && (
              <CommandGroup
                heading={`Scripture · ${total} ${total === 1 ? "result" : "results"}`}
              >
                {results.map((r, i) => (
                  <CommandItem
                    key={`${r.reference}-${i}`}
                    value={`${r.reference}-${i}`}
                    onSelect={() => project(r)}
                    className="group flex-col items-start gap-1 py-2.5"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-mono text-[12px] text-muted-foreground">
                        {r.reference}
                      </span>
                      <span className="flex items-center gap-1 opacity-0 group-data-[selected=true]:opacity-100 transition-opacity">
                        <RowAction
                          label="Preview"
                          onClick={(e) => {
                            e.stopPropagation()
                            preview(r)
                          }}
                        >
                          <Eye className="size-3.5" />
                        </RowAction>
                        <RowAction
                          label="Add to queue"
                          onClick={(e) => {
                            e.stopPropagation()
                            onQueue(r)
                          }}
                        >
                          <Plus className="size-3.5" />
                        </RowAction>
                      </span>
                    </div>
                    <p
                      className="font-serif text-[15px] leading-snug text-foreground/90 line-clamp-2 [&_em]:not-italic [&_em]:font-semibold [&_em]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: r.highlight ?? r.text }}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {loading && results.length > 0 && (
              <div className="py-3 grid place-items-center">
                <Loader2 className="size-4 text-muted-foreground animate-spin" />
              </div>
            )}
          </CommandList>
          <div className="flex items-center justify-end gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span>
              <Kbd>↵</Kbd> Project
            </span>
            <span>
              <Kbd>Esc</Kbd> Close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: (e: React.MouseEvent) => void
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px]">
      {children}
    </kbd>
  )
}

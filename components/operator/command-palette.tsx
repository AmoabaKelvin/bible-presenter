"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
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
} from "@/components/ui/command"
import { useDictionaryLookup } from "@/hooks/use-dictionary-lookup"
import { useScriptureSearch } from "@/hooks/use-scripture-search"
import type { ScriptureSearchResult } from "@/lib/scripture-search"
import type { SelectedVerse } from "@/components/slide-stage"
import {
  DictionaryResults,
  ScriptureResults,
} from "./command-palette-results"
import { PaletteKbd, PaletteModeTabs, type PaletteMode } from "./command-palette-ui"

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
  const isDict = paletteMode === "dictionary"
  const { results, total, loading, error, hasMore, loadMore, activeQuery } =
    useScriptureSearch(isDict ? "" : query, version)
  const {
    entries: definitionEntries,
    rows: definitionRows,
    loading: definitionsLoading,
  } = useDictionaryLookup(query, isDict)

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

  const showHint = query.trim().length < 2
  const showSearching = isDict
    ? definitionsLoading && definitionEntries.length === 0
    : loading && results.length === 0
  const showEmpty = isDict
    ? !definitionsLoading && !showHint && definitionEntries.length === 0
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
          <PaletteModeTabs value={paletteMode} onChange={setPaletteMode} />
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
            {isDict && (
              <DictionaryResults
                rows={definitionRows}
                onPreview={onDefinePreview}
                onProject={onDefineProject}
                onQueue={onDefineQueue}
                onClose={close}
              />
            )}
            {!isDict && (
              <ScriptureResults
                results={results}
                total={total}
                onPreview={onPreview}
                onProject={onProject}
                onQueue={onQueue}
                onClose={close}
              />
            )}
            {loading && results.length > 0 && (
              <div className="py-3 grid place-items-center">
                <Loader2 className="size-4 text-muted-foreground animate-spin" />
              </div>
            )}
          </CommandList>
          <div className="flex items-center justify-end gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span>
              <PaletteKbd>↵</PaletteKbd> Project
            </span>
            <span>
              <PaletteKbd>Esc</PaletteKbd> Close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

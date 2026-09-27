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
import { parseFullScriptureReference, type ParsedScriptureReference } from "@/lib/scripture-reference"
import type { ScriptureSearchResult } from "@/lib/scripture-search"
import { resolveResultsToVersion } from "@/lib/version-text"
import type { SelectedVerse } from "@/components/slide-stage"
import {
  DictionaryResults,
  ScriptureResults,
} from "./command-palette-results"
import { PaletteKbd, PaletteModeTabs, type PaletteMode } from "./command-palette-ui"

interface CommandPaletteProps {
  version: string
  // "/" opens the palette too, for pages without their own reference box.
  openOnSlash: boolean
  onPreview: (result: ScriptureSearchResult) => void
  onProject: (result: ScriptureSearchResult) => void
  onQueue: (result: ScriptureSearchResult) => void
  onNavigate: (result: ScriptureSearchResult) => void
  onDefinePreview: (v: SelectedVerse) => void
  onDefineProject: (v: SelectedVerse) => void
  onDefineQueue: (v: SelectedVerse) => void
}

// A typed reference ("matt 3:1") as a single result, with its text in the
// active version once the chapter loads. A bare chapter lands on verse 1.
function useReferenceJump(
  parsed: ParsedScriptureReference | null,
  version: string,
): ScriptureSearchResult | null {
  const reference = parsed ? `${parsed.book.name} ${parsed.chapter}:${parsed.verse ?? 1}` : null
  const [text, setText] = useState<{ reference: string; text: string } | null>(null)

  useEffect(() => {
    if (!reference) return
    const controller = new AbortController()
    resolveResultsToVersion([{ reference, text: "" }], version, "", controller.signal).then(
      ([resolved]) => {
        if (!controller.signal.aborted) setText({ reference, text: resolved?.text ?? "" })
      },
    )
    return () => controller.abort()
  }, [reference, version])

  if (!reference) return null
  return { reference, text: text?.reference === reference ? text.text : "" }
}

export function CommandPalette({
  version,
  openOnSlash,
  onPreview,
  onProject,
  onQueue,
  onNavigate,
  onDefinePreview,
  onDefineProject,
  onDefineQueue,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("scripture")
  const [query, setQuery] = useState("")
  const isDict = paletteMode === "dictionary"
  // A reference goes straight to the verse instead of searching for it.
  const jumpTarget = isDict ? null : parseFullScriptureReference(query)
  const jump = useReferenceJump(jumpTarget, version)
  const { results, total, loading, enriching, error, hasMore, loadMore, activeQuery } =
    useScriptureSearch(isDict || jumpTarget ? "" : query, version)
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

  useEffect(() => {
    if (!openOnSlash) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return
      const target = e.target as HTMLElement | null
      if (target && (/^(INPUT|TEXTAREA)$/.test(target.tagName) || target.isContentEditable)) return
      e.preventDefault()
      setPaletteMode("scripture")
      setOpen(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [openOnSlash])

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
                : "Go to a reference (John 3:16) or search a word, phrase, or topic…"
            }
          />
          <PaletteModeTabs value={paletteMode} onChange={setPaletteMode} />
          <CommandList className="max-h-[60vh]" onScroll={handleScroll}>
            {showHint && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {isDict
                  ? "Type at least 2 characters to define."
                  : "Type a reference like John 3:16, or at least 2 characters to search."}
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
            {jump && (
              <ScriptureResults
                results={[jump]}
                heading="Go to"
                onPreview={onPreview}
                onProject={onProject}
                onQueue={onQueue}
                onNavigate={onNavigate}
                onClose={close}
              />
            )}
            {!isDict && !jump && (
              <ScriptureResults
                results={results}
                heading={`Scripture · ${total} ${total === 1 ? "result" : "results"}`}
                onPreview={onPreview}
                onProject={onProject}
                onQueue={onQueue}
                onNavigate={onNavigate}
                onClose={close}
              />
            )}
            {!isDict && enriching && results.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 py-3 text-[11px] text-muted-foreground/70">
                <Loader2 className="size-3 animate-spin" />
                finding related verses…
              </div>
            )}
          </CommandList>
          <div className="flex items-center justify-end gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span>
              <PaletteKbd>↵</PaletteKbd> {isDict ? "Project" : "Open"}
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

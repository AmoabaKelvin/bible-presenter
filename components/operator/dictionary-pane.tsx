"use client"

import { useEffect } from "react"
import { Search, Loader2, BookA, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { SelectedVerse } from "@/components/slide-stage"
import { useDictionaryLookup } from "@/hooks/use-dictionary-lookup"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { definitionToSlide } from "@/lib/dictionary"
import { DefinitionCard } from "./definition-card"

interface DictionaryPaneProps {
  onPreview: (v: SelectedVerse) => void
  onProject: (v: SelectedVerse) => void
  onQueue: (v: SelectedVerse) => void
  // A word pushed in from elsewhere (e.g. "Define" on a preview selection).
  // The nonce lets the same word re-seed the search on repeated requests.
  externalQuery?: string
  externalQueryNonce?: number
}

export function DictionaryPane({
  onPreview,
  onProject,
  onQueue,
  externalQuery,
  externalQueryNonce,
}: DictionaryPaneProps) {
  const [query, setQuery] = usePersistedState("workspace:dictionaryQuery", "")
  const { entries, suggestions, loading } = useDictionaryLookup(query, true, {
    delayMs: 220,
    suggestionsLimit: 8,
  })

  // Seed the search from an external "Define" request (keyed on the nonce so
  // defining the same word twice re-runs the search).
  useEffect(() => {
    if (externalQueryNonce && externalQuery) setQuery(externalQuery)
  }, [externalQuery, externalQueryNonce, setQuery])

  const queryReady = query.trim().length >= 2
  const showEmpty = !loading && queryReady && entries.length === 0
  const showHint = !queryReady

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header: title only, mirroring the other panes */}
      <div className="h-14 shrink-0 px-4 border-b border-border flex items-center">
        <h2 className="text-sm font-medium">Dictionary</h2>
      </div>

      {/* Search — same treatment as the Bible pane's full-text search */}
      <div className="px-10 pt-8 pb-2 max-w-[960px] mx-auto w-full">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Look up a word — e.g. charity, Melchizedek, propitiation"
            className="h-10 pl-10 text-sm"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-6 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent"
              aria-label="Clear"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="mx-auto w-full max-w-[960px] px-10 pb-24 pt-5">
          {showHint && (
            <div className="pt-16 text-center">
              <div className="size-10 rounded-full bg-accent grid place-items-center mx-auto mb-3">
                <BookA className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Search Webster&rsquo;s 1913 and Easton&rsquo;s Bible Dictionary.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Definitions preview, queue, and go live like any other slide.
              </p>
            </div>
          )}

          {loading && (
            <div className="py-16 grid place-items-center">
              <Loader2 className="size-5 text-muted-foreground animate-spin" />
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div className="flex flex-col gap-6">
              {entries.map((entry, i) => (
                <DefinitionCard
                  key={`${entry.source}-${i}`}
                  entry={entry}
                  onPreview={(body) => onPreview(definitionToSlide(entry.word, body))}
                  onProject={(body) => onProject(definitionToSlide(entry.word, body))}
                  onQueue={(body) => onQueue(definitionToSlide(entry.word, body))}
                />
              ))}
            </div>
          )}

          {showEmpty && (
            <div className="pt-12 text-center">
              <p className="text-sm text-muted-foreground">
                No entry for &ldquo;{query.trim()}&rdquo;.
              </p>
              {suggestions.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground/70 mb-2">Did you mean</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => setQuery(s)}
                        className="px-2.5 h-7 rounded-full border border-border text-[13px] text-foreground/80 hover:bg-accent transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

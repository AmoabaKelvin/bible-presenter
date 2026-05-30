"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, Eye, Plus, Radio, Loader2, BookA, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { SelectedVerse } from "@/components/slide-stage"
import {
  lookup,
  suggest,
  parseSenses,
  definitionToSlide,
  preloadDictionary,
  type DictEntry,
  type LookupResult,
} from "@/lib/dictionary"

interface DictionaryPaneProps {
  onPreview: (v: SelectedVerse) => void
  onProject: (v: SelectedVerse) => void
  onQueue: (v: SelectedVerse) => void
  // A word pushed in from elsewhere (e.g. "Define" on a preview selection).
  // The nonce lets the same word re-seed the search on repeated requests.
  externalQuery?: string
  externalQueryNonce?: number
}

const SOURCE_LABEL: Record<DictEntry["source"], string> = {
  eastons: "Easton's Bible Dictionary",
  websters: "Webster's 1913",
}

export function DictionaryPane({
  onPreview,
  onProject,
  onQueue,
  externalQuery,
  externalQueryNonce,
}: DictionaryPaneProps) {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<LookupResult | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  // Warm the dictionary the moment the pane opens so the first lookup is instant.
  useEffect(() => {
    preloadDictionary()
  }, [])

  // Seed the search from an external "Define" request (keyed on the nonce so
  // defining the same word twice re-runs the search).
  useEffect(() => {
    if (externalQueryNonce && externalQuery) setQuery(externalQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQueryNonce])

  // Debounced lookup as the operator types.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResult(null)
      setSuggestions([])
      setLoading(false)
      return
    }
    setLoading(true)
    const id = ++reqId.current
    const handle = setTimeout(async () => {
      const [res, sug] = await Promise.all([lookup(q), suggest(q, 8)])
      if (id !== reqId.current) return // a newer query superseded this one
      setResult(res)
      setSuggestions(sug)
      setLoading(false)
    }, 220)
    return () => clearTimeout(handle)
  }, [query])

  const entries = result?.entries ?? []
  const showEmpty = !loading && result !== null && entries.length === 0
  const showHint = query.trim().length < 2

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header: title only, mirroring the other panes */}
      <div className="h-14 shrink-0 px-4 border-b border-border flex items-center">
        <h2 className="text-sm font-medium">Dictionary</h2>
      </div>

      {/* Search — same treatment as the Bible pane's full-text search */}
      <div className="px-8 pt-6 pb-2 max-w-[1100px] mx-auto w-full">
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
        <div className="mx-auto w-full max-w-[1100px] px-8 pb-8 pt-5">
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

          {!loading &&
            entries.map((entry, i) => (
              <DefinitionCard
                key={`${entry.source}-${i}`}
                entry={entry}
                onPreview={(body) => onPreview(definitionToSlide(entry.word, body))}
                onProject={(body) => onProject(definitionToSlide(entry.word, body))}
                onQueue={(body) => onQueue(definitionToSlide(entry.word, body))}
              />
            ))}

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

function DefinitionCard({
  entry,
  onPreview,
  onProject,
  onQueue,
}: {
  entry: DictEntry
  onPreview: (body: string) => void
  onProject: (body: string) => void
  onQueue: (body: string) => void
}) {
  // Split the entry into discrete senses. Easton's entries aren't numbered the
  // way Webster's are, so they parse to a single sense — which is fine.
  const senses = useMemo(() => parseSenses(entry.definition), [entry.definition])

  // The operator picks one sense; its text seeds an editable draft that's what
  // actually projects. Re-seed the draft whenever the selected sense changes.
  const [selected, setSelected] = useState(0)
  const [draft, setDraft] = useState(senses[0]?.text ?? entry.definition)

  useEffect(() => {
    setSelected(0)
    setDraft(senses[0]?.text ?? entry.definition)
  }, [senses, entry.definition])

  const pick = (i: number) => {
    setSelected(i)
    setDraft(senses[i]?.text ?? "")
  }

  const multi = senses.length > 1

  const actions = (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        disabled={!draft.trim()}
        onClick={() => onPreview(draft)}
      >
        <Eye className="size-3.5 mr-1.5" />
        Preview
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        disabled={!draft.trim()}
        onClick={() => onQueue(draft)}
      >
        <Plus className="size-3.5 mr-1.5" />
        Queue
      </Button>
      <Button
        size="sm"
        className="h-8 text-xs"
        disabled={!draft.trim()}
        onClick={() => onProject(draft)}
      >
        <Radio className="size-3.5 mr-1.5" />
        Go live
      </Button>
    </div>
  )

  return (
    <div className="mb-5 rounded-lg border border-border bg-card/40 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-serif text-[24px] capitalize">{entry.word}</h3>
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-border text-muted-foreground">
          {SOURCE_LABEL[entry.source]}
        </span>
      </div>

      {multi ? (
        // Two columns: senses on the left, editor + actions on the right, both
        // using the full card width instead of stacking down the middle.
        <div className="grid gap-6 md:grid-cols-[1fr_minmax(300px,400px)]">
          <ul className="space-y-1">
            {senses.map((s, i) => {
              const active = i === selected
              return (
                <li key={i}>
                  <button
                    onClick={() => pick(i)}
                    className={`w-full text-left flex gap-3 rounded-md px-3 py-2.5 transition-colors ${
                      active ? "bg-accent ring-1 ring-border" : "hover:bg-accent/50"
                    }`}
                    aria-pressed={active}
                  >
                    <span
                      className={`shrink-0 font-mono text-[12px] pt-0.5 tabular-nums ${
                        active ? "text-foreground" : "text-muted-foreground/60"
                      }`}
                    >
                      {s.n}.
                    </span>
                    <span
                      className={`font-serif text-[15px] leading-[1.6] ${
                        active ? "text-foreground" : "text-foreground/70"
                      }`}
                    >
                      {s.text}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="flex flex-col gap-3 md:border-l md:border-border md:pl-6">
            <span className="eyebrow">Projected text</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[140px] flex-1 resize-y rounded-md border border-border bg-background px-3 py-2.5 font-serif text-[15px] leading-[1.6] text-foreground/90 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {actions}
          </div>
        </div>
      ) : (
        // Single-sense entries (Easton's): editor spans the full width.
        <div className="flex flex-col gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2.5 font-serif text-[15px] leading-[1.6] text-foreground/90 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {actions}
        </div>
      )}
    </div>
  )
}

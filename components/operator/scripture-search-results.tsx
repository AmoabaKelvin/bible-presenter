"use client"

import { Loader2, Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useScriptureSearch } from "@/hooks/use-scripture-search"
import type { ScriptureSearchResult } from "@/lib/scripture-search"

interface ScriptureSearchResultsProps {
  query: string
  version: string
  onPreview: (result: ScriptureSearchResult) => void
  onProject: (result: ScriptureSearchResult) => void
  onQueue: (result: ScriptureSearchResult) => void
}

export function ScriptureSearchResults({
  query,
  version,
  onPreview,
  onProject,
  onQueue,
}: ScriptureSearchResultsProps) {
  const { results, total, loading, error, hasMore, loadMore, activeQuery } =
    useScriptureSearch(query, version)

  const showInitialSpinner = loading && results.length === 0

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="mx-auto max-w-[960px] px-10 pt-4 pb-24">
        <div className="flex items-baseline justify-between gap-4 mb-3 h-6">
          <span className="eyebrow">Scripture</span>
          {activeQuery && !showInitialSpinner && (
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {total} {total === 1 ? "result" : "results"}
            </span>
          )}
        </div>

        {showInitialSpinner && (
          <div className="grid place-items-center py-20">
            <Loader2 className="size-5 text-muted-foreground animate-spin" />
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-destructive text-center py-16">{error}</p>
        )}

        {!showInitialSpinner && !error && activeQuery && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-16">
            No verses match &ldquo;{activeQuery}&rdquo;.
          </p>
        )}

        {results.length > 0 && (
          <ul>
            {results.map((r, i) => (
              <li
                key={`${r.reference}-${i}`}
                onClick={() => onPreview(r)}
                onDoubleClick={() => onProject(r)}
                className="group relative py-3 pr-12 pl-4 -mx-4 rounded-md cursor-pointer transition-colors hover:bg-accent/70"
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-transparent group-hover:bg-foreground/30 transition-colors"
                />
                <div className="font-mono text-[12px] text-muted-foreground mb-1">
                  {r.reference}
                </div>
                <p
                  className="font-serif text-[17px] leading-[1.6] text-foreground/90 [&_em]:not-italic [&_em]:font-semibold [&_em]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: r.highlight ?? r.text }}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onQueue(r)
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      aria-label={`Add ${r.reference} to queue`}
                      className="absolute right-3 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-md border border-border bg-background text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent transition-all"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Add to queue</TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : null}
              Load more
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

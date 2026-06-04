"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { searchScripture, type ScriptureSearchResult } from "@/lib/scripture-search"
import { semanticSearch } from "@/lib/semantic-search"
import {
  fuse,
  LEXICAL_CANDIDATES,
  SEMANTIC_CANDIDATES,
} from "@/lib/hybrid-search"
import { resolveResultsToVersion } from "@/lib/version-text"

const PAGE_SIZE = 25
const DEBOUNCE_MS = 280

interface UseScriptureSearch {
  results: ScriptureSearchResult[]
  total: number
  loading: boolean
  // True while exact results are shown but the (slower) semantic pass is still
  // running — so the UI can signal "more meaning matches are coming" instead of
  // looking finished.
  enriching: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  // The query the current results reflect (post-debounce, trimmed).
  activeQuery: string
}

export function useScriptureSearch(
  query: string,
  version: string,
): UseScriptureSearch {
  const [results, setResults] = useState<ScriptureSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeQuery, setActiveQuery] = useState("")

  // The full fused candidate list lives here; paging just reveals more of it,
  // so "load more" never refetches or re-embeds.
  const mergedRef = useRef<ScriptureSearchResult[]>([])
  const shownRef = useRef(PAGE_SIZE)
  const controllerRef = useRef<AbortController | null>(null)

  const trimmed = query.trim()

  // A fresh search runs in two decoupled phases: exact paints immediately,
  // then semantic folds in and re-ranks when it resolves. Exact never waits
  // on the (slower, model-backed) semantic pass.
  const search = useCallback(
    async (q: string) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const aborted = () => controller.signal.aborted

      setLoading(true)
      setError(null)
      setActiveQuery(q)
      shownRef.current = PAGE_SIZE

      // Phase 1 — exact (lexical), against the active version. Fast.
      let lexical: ScriptureSearchResult[] = []
      let lexicalFailed = false
      try {
        const lex = await searchScripture(q, {
          translation: version,
          limit: LEXICAL_CANDIDATES,
          offset: 0,
          signal: controller.signal,
        })
        lexical = lex.results
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        lexicalFailed = true
      }
      if (aborted()) return

      mergedRef.current = lexical
      setTotal(lexical.length)
      setResults(lexical.slice(0, PAGE_SIZE))
      // Keep the spinner only if exact found nothing — semantic is still
      // coming, so don't flash an empty "no results" state in the meantime.
      // Otherwise switch to the subtler "enriching" signal.
      if (lexical.length > 0) {
        setLoading(false)
        setEnriching(true)
      }

      // Phase 2 — semantic (meaning), against the BSB embeddings. Slower; on
      // first use it also downloads the model. Folds in and re-ranks. It must
      // never break search, so failures just leave the exact results standing.
      try {
        const sem = await semanticSearch(q, {
          limit: SEMANTIC_CANDIDATES,
          offset: 0,
        })
        if (aborted()) return
        const merged = fuse(lexical, sem.results)
        // Semantic hits arrive in BSB; rewrite every result into the active
        // version so what's previewed and projected always matches the
        // operator's translation.
        const resolved = await resolveResultsToVersion(
          merged,
          version,
          q,
          controller.signal,
        )
        if (aborted()) return
        mergedRef.current = resolved
        setTotal(resolved.length)
        setResults(resolved.slice(0, shownRef.current))
      } catch {
        if (aborted()) return
      } finally {
        if (!aborted()) {
          setLoading(false)
          setEnriching(false)
          if (mergedRef.current.length === 0 && lexicalFailed) {
            setError("Search failed. Please try again.")
          }
        }
      }
    },
    [version],
  )

  // Debounced fresh search whenever the query or version changes.
  useEffect(() => {
    if (trimmed.length < 2) {
      controllerRef.current?.abort()
      mergedRef.current = []
      shownRef.current = PAGE_SIZE
      setResults([])
      setTotal(0)
      setActiveQuery("")
      setError(null)
      setLoading(false)
      setEnriching(false)
      return
    }
    const t = setTimeout(() => search(trimmed), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [trimmed, version, search])

  // Paging is a pure client-side reveal over the already-fused list.
  const loadMore = useCallback(() => {
    if (loading) return
    if (results.length >= mergedRef.current.length) return
    shownRef.current = results.length + PAGE_SIZE
    setResults(mergedRef.current.slice(0, shownRef.current))
  }, [loading, results.length])

  return {
    results,
    total,
    loading,
    enriching,
    error,
    hasMore: results.length < total,
    loadMore,
    activeQuery,
  }
}

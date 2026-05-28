"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  searchScripture,
  type ScriptureSearchResult,
} from "@/lib/scripture-search"

const PAGE_SIZE = 25
const DEBOUNCE_MS = 280

interface UseScriptureSearch {
  results: ScriptureSearchResult[]
  total: number
  loading: boolean
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
  const [error, setError] = useState<string | null>(null)
  const [activeQuery, setActiveQuery] = useState("")

  const offsetRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)

  const trimmed = query.trim()

  const run = useCallback(
    async (q: string, offset: number, append: boolean) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      setLoading(true)
      setError(null)
      try {
        const data = await searchScripture(q, {
          translation: version,
          limit: PAGE_SIZE,
          offset,
          signal: controller.signal,
        })
        offsetRef.current = offset
        setTotal(data.total)
        setActiveQuery(q)
        setResults((prev) => (append ? [...prev, ...data.results] : data.results))
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        setError("Search failed. Please try again.")
        if (!append) setResults([])
      } finally {
        setLoading(false)
      }
    },
    [version],
  )

  // Debounced fresh search whenever the query or version changes.
  useEffect(() => {
    if (trimmed.length < 2) {
      controllerRef.current?.abort()
      setResults([])
      setTotal(0)
      setActiveQuery("")
      setError(null)
      setLoading(false)
      return
    }
    const t = setTimeout(() => run(trimmed, 0, false), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [trimmed, version, run])

  const loadMore = useCallback(() => {
    if (loading || !activeQuery) return
    if (results.length >= total) return
    run(activeQuery, offsetRef.current + PAGE_SIZE, true)
  }, [loading, activeQuery, results.length, total, run])

  return {
    results,
    total,
    loading,
    error,
    hasMore: results.length < total,
    loadMore,
    activeQuery,
  }
}

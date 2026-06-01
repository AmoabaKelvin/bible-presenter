"use client"

import { useEffect, useRef, useState } from "react"
import { searchYouTube, type YouTubePlaylistTrack } from "@/lib/youtube-account"

export function useYouTubeSearch(enabled: boolean) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<YouTubePlaylistTrack[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 450)
    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    if (!enabled) return
    if (!debouncedQuery) {
      setResults(null)
      setError(null)
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    searchYouTube(debouncedQuery, { limit: 12, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setResults(data.items ?? [])
      })
      .catch((err: Error & { status?: number }) => {
        if (controller.signal.aborted || err.name === "AbortError") return
        setError(
          err.status === 403
            ? "YouTube search quota is exhausted for today."
            : err.message || "Search failed.",
        )
        setResults([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [debouncedQuery, enabled])

  return {
    query,
    setQuery,
    debouncedQuery,
    results: results ?? [],
    loading,
    error,
    resetSearch: () => {
      setResults(null)
      setQuery("")
    },
  }
}

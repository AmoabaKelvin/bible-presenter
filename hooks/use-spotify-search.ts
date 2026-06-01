"use client"

import { useEffect, useRef, useState } from "react"
import { searchSpotify } from "@/lib/spotify-music"
import type { SearchResponse } from "@/components/operator/spotify-browser-types"

export function useSpotifySearch(enabled: boolean) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 300)
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
    searchSpotify(debouncedQuery, { type: "track,album,playlist", limit: 6 })
      .then((data) => {
        if (controller.signal.aborted) return
        setResults(data as SearchResponse)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err.message || "Search failed.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [debouncedQuery, enabled])

  const visibleTracks = results?.tracks?.items?.filter(Boolean) ?? []
  const visibleAlbums = results?.albums?.items?.filter(Boolean) ?? []
  const visiblePlaylists = results?.playlists?.items?.filter(Boolean) ?? []

  return {
    query,
    setQuery,
    debouncedQuery,
    visibleTracks,
    visibleAlbums,
    visiblePlaylists,
    totalHits: visibleTracks.length + visibleAlbums.length + visiblePlaylists.length,
    loading,
    error,
    resetSearch: () => setResults(null),
  }
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { getYouTubePlaylists, type YouTubePlaylistSummary } from "@/lib/youtube-account"

export function useYouTubePlaylists(enabled: boolean) {
  const [playlists, setPlaylists] = useState<YouTubePlaylistSummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (playlists !== null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getYouTubePlaylists({ limit: 50, all: true })
      .then((data) => {
        if (!cancelled) setPlaylists(data.items ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || "Failed to load YouTube playlists.")
        setPlaylists([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, playlists])

  return {
    playlists: useMemo(() => playlists?.filter(Boolean) ?? [], [playlists]),
    loading,
    error,
    resetPlaylists: () => setPlaylists(null),
  }
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { getSpotifyPlaylists } from "@/lib/spotify-music"
import type { SpotifyPlaylistSummary } from "@/components/operator/spotify-browser-types"

export function useSpotifyPlaylists(enabled: boolean) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (playlists !== null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getSpotifyPlaylists({ limit: 50, all: true })
      .then((data: { items?: SpotifyPlaylistSummary[] }) => {
        if (cancelled) return
        setPlaylists(data.items ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || "Failed to load playlists.")
        setPlaylists([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, playlists])

  const filteredPlaylists = useMemo(() => playlists?.filter(Boolean) ?? [], [playlists])

  return {
    playlists: filteredPlaylists,
    loading,
    error,
    resetPlaylists: () => setPlaylists(null),
  }
}

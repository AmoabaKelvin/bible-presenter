"use client"

import { useEffect, useState } from "react"
import {
  getSpotifyStatus,
  type SpotifyAuthStatus,
} from "@/lib/spotify-music"
import {
  getYouTubeStatus,
  type YouTubeAuthStatus,
} from "@/lib/youtube-account"

export function useMusicAccountStatus() {
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyAuthStatus>({ connected: false })
  const [youtubeStatus, setYouTubeStatus] = useState<YouTubeAuthStatus>({ connected: false })

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      getSpotifyStatus()
        .then((status) => {
          if (!cancelled) setSpotifyStatus(status)
        })
        .catch(() => {
          // status defaults to disconnected
        })
      getYouTubeStatus()
        .then((status) => {
          if (!cancelled) setYouTubeStatus(status)
        })
        .catch(() => {
          // status defaults to disconnected
        })
    }
    refresh()
    const params = new URLSearchParams(window.location.search)
    if (params.has("spotify") || params.has("youtube")) {
      params.delete("spotify")
      params.delete("youtube")
      const next = window.location.pathname + (params.toString() ? `?${params}` : "")
      window.history.replaceState({}, "", next)
      refresh()
    }
    return () => {
      cancelled = true
    }
  }, [])

  return { spotifyStatus, setSpotifyStatus, youtubeStatus, setYouTubeStatus }
}

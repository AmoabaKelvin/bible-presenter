"use client"

import { useCallback, useEffect, useState } from "react"
import {
  DEFAULT_MUSIC_STATE,
  MUSIC_PROVIDER_KEY,
  MUSIC_STATE_KEY,
  MUSIC_URL_KEY,
  MUSIC_VOLUME_KEY,
  type MusicState,
} from "@/lib/music-protocol"

export function useOperatorMusicState() {
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [musicState, setMusicState] = useState<MusicState>(DEFAULT_MUSIC_STATE)

  useEffect(() => {
    try {
      const mu = localStorage.getItem(MUSIC_URL_KEY)
      if (mu) setMusicUrl(mu)

      const mv = localStorage.getItem(MUSIC_VOLUME_KEY)
      const initialVolume = mv != null ? Number(mv) : DEFAULT_MUSIC_STATE.volume
      setMusicState((s) => ({
        ...s,
        volume: Number.isFinite(initialVolume) ? initialVolume : s.volume,
      }))

      const cachedState = localStorage.getItem(MUSIC_STATE_KEY)
      if (cachedState) {
        try {
          setMusicState((s) => ({ ...s, ...JSON.parse(cachedState) }))
        } catch {
          // ignore corrupt persisted music state
        }
      }
    } catch {
      // ignore unavailable storage
    }
  }, [])

  useEffect(() => {
    if (musicUrl) localStorage.setItem(MUSIC_URL_KEY, musicUrl)
    else localStorage.removeItem(MUSIC_URL_KEY)
  }, [musicUrl])

  useEffect(() => {
    localStorage.setItem(MUSIC_VOLUME_KEY, String(musicState.volume))
  }, [musicState.volume])

  useEffect(() => {
    const apply = () => {
      const raw = localStorage.getItem(MUSIC_STATE_KEY)
      if (!raw) return
      setMusicState((prev) => {
        if (JSON.stringify(prev) === raw) return prev
        try {
          return JSON.parse(raw) as MusicState
        } catch {
          return prev
        }
      })
    }
    apply()
    const onStorage = (e: StorageEvent) => {
      if (e.key === MUSIC_STATE_KEY) apply()
    }
    window.addEventListener("storage", onStorage)
    const interval = setInterval(apply, 500)
    return () => {
      window.removeEventListener("storage", onStorage)
      clearInterval(interval)
    }
  }, [])

  const setMusicStateOptimistic = useCallback((next: MusicState) => {
    setMusicState(next)
    try {
      if (next.provider) localStorage.setItem(MUSIC_PROVIDER_KEY, next.provider)
      localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(next))
    } catch {
      // ignore unavailable storage
    }
  }, [])

  return { musicUrl, setMusicUrl, musicState, setMusicState, setMusicStateOptimistic }
}

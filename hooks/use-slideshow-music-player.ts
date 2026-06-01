"use client"

import { useEffect, useRef, useState } from "react"
import {
  MUSIC_COMMAND_KEY,
  MUSIC_PROVIDER_KEY,
  MUSIC_STATE_KEY,
  SLIDESHOW_HEARTBEAT_KEY,
  SLIDESHOW_HEARTBEAT_INTERVAL_MS,
  isSpotifyLoadCommand,
  type MusicCommand,
  type MusicProvider,
  type MusicState,
} from "@/lib/music-protocol"
import {
  cleanupSpotifyRuntime,
  createSpotifyRuntime,
  enableSpotifyAudio,
} from "@/lib/slideshow-spotify-player"
import {
  cleanupYouTubeRuntime,
  createYouTubeRuntime,
  enableYouTubeAudio,
} from "@/lib/slideshow-youtube-player"

let globalActiveProvider: MusicProvider = "youtube"

function hasGesture() {
  return sessionStorage.getItem("flowcastGesture") === "1"
}

function readInitialProvider() {
  try {
    const storedProvider = localStorage.getItem(MUSIC_PROVIDER_KEY)
    if (storedProvider === "youtube" || storedProvider === "spotify") return storedProvider
    const storedState = localStorage.getItem(MUSIC_STATE_KEY)
    const provider = storedState ? (JSON.parse(storedState) as MusicState).provider : undefined
    if (provider === "youtube" || provider === "spotify") return provider
  } catch {
    // ignore corrupt persisted music provider
  }
  return "youtube"
}

export function useSlideshowMusicPlayer() {
  const [needsAudioGesture, setNeedsAudioGesture] = useState(false)
  const lastCommandIdRef = useRef<string | null>(null)

  useEffect(() => {
    globalActiveProvider = readInitialProvider()
    const spotify = createSpotifyRuntime({
      getActiveProvider: () => globalActiveProvider,
      setActiveProvider: (provider) => {
        globalActiveProvider = provider
      },
      setNeedsAudioGesture,
      hasGesture,
    })
    const youtube = createYouTubeRuntime({
      getActiveProvider: () => globalActiveProvider,
      setActiveProvider: (provider) => {
        globalActiveProvider = provider
      },
      hasGesture,
    })

    const dispatch = (cmd: MusicCommand) => {
      if (isSpotifyLoadCommand(cmd)) {
        spotify.startPlayback(cmd).catch((err) => {
          spotify.publishState({ status: "error", errorMessage: (err as Error).message })
        })
        return
      }
      if (cmd.provider === "spotify" || (cmd.type !== "load" && globalActiveProvider === "spotify")) {
        spotify.dispatchControl(cmd).catch((err) => {
          spotify.publishState({ status: "error", errorMessage: (err as Error).message })
        })
        return
      }
      youtube.dispatch(cmd)
    }

    const processCommand = () => {
      const raw = localStorage.getItem(MUSIC_COMMAND_KEY)
      if (!raw) return
      let cmd: MusicCommand
      try {
        cmd = JSON.parse(raw)
      } catch {
        return
      }
      if (!cmd.id || cmd.id === lastCommandIdRef.current) return
      lastCommandIdRef.current = cmd.id
      if ((cmd.type === "play" || (cmd.type === "load" && cmd.autoplay)) && !hasGesture()) {
        setNeedsAudioGesture(true)
      }
      dispatch(cmd)
    }

    youtube.loadSdk()

    const onStorage = (e: StorageEvent) => {
      if (e.key === MUSIC_COMMAND_KEY) processCommand()
    }
    window.addEventListener("storage", onStorage)
    processCommand()

    return () => {
      window.removeEventListener("storage", onStorage)
      cleanupYouTubeRuntime()
      cleanupSpotifyRuntime()
    }
  }, [])

  useEffect(() => {
    const tick = () => {
      try {
        localStorage.setItem(SLIDESHOW_HEARTBEAT_KEY, String(Date.now()))
      } catch {
        // ignore
      }
    }
    tick()
    const interval = setInterval(tick, SLIDESHOW_HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const enableAudio = () => {
    sessionStorage.setItem("flowcastGesture", "1")
    setNeedsAudioGesture(false)
    enableYouTubeAudio()
    enableSpotifyAudio()
  }

  return { needsAudioGesture, enableAudio }
}

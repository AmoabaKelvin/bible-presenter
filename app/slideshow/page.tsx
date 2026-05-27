"use client"

import { useState, useEffect, useRef } from "react"
import {
  SlideStage,
  SlideContent,
  type FontSize,
  type SelectedVerse,
} from "@/components/slide-stage"
import {
  DEFAULT_MUSIC_STATE,
  MUSIC_COMMAND_KEY,
  MUSIC_STATE_KEY,
  type MusicCommand,
  type MusicState,
} from "@/lib/youtube-music"

interface VerseData {
  verses: SelectedVerse[]
  fontSize: FontSize
  darkMode: boolean
  version?: string
  backgroundColor?: string
  backgroundImage?: string
  mediaUrl?: string
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: string | HTMLElement,
        opts: Record<string, unknown>,
      ) => YTPlayer
      PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YTPlayer {
  loadVideoById: (id: string) => void
  loadPlaylist: (opts: { list: string; listType: string }) => void
  cueVideoById: (id: string) => void
  cuePlaylist: (opts: { list: string; listType: string }) => void
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  nextVideo: () => void
  previousVideo: () => void
  setVolume: (v: number) => void
  getVolume: () => number
  getVideoData: () => { video_id: string; title: string; author: string }
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState?: () => number
}

// Module-level guard — React StrictMode mounts effects twice in dev,
// which would otherwise create two YT.Player instances racing on the
// same localStorage state. Keep a single player for the lifetime of
// the tab.
let globalPlayer: YTPlayer | null = null
let globalReady = false
let globalHasPlaylist = false
let globalLastStatus: MusicState["status"] = "idle"

export default function SlideshowPage() {
  const [data, setData] = useState<VerseData>({
    verses: [],
    fontSize: "extra-large",
    darkMode: true,
    version: "KJV",
    backgroundColor: "#000000",
  })
  const [needsAudioGesture, setNeedsAudioGesture] = useState(false)

  const lastCommandIdRef = useRef<string | null>(null)
  const pendingCommandsRef = useRef<MusicCommand[]>([])
  const titlePollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Slide data sync (unchanged behavior) ───────────────────────────
  useEffect(() => {
    const updateFavicon = (verseRef?: string) => {
      const canvas = document.createElement("canvas")
      canvas.width = 32
      canvas.height = 32
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.fillStyle = "#22c55e"
        ctx.fillRect(0, 0, 32, 32)
        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 20px sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("S", 16, 17)

        const link = document.querySelector("link[rel='icon']") as HTMLLinkElement
        if (link) {
          link.href = canvas.toDataURL()
        } else {
          const newLink = document.createElement("link")
          newLink.rel = "icon"
          newLink.href = canvas.toDataURL()
          document.head.appendChild(newLink)
        }
      }
      if (verseRef) document.title = `${verseRef} - Slideshow`
      else document.title = "flowwww — Slideshow"
    }

    updateFavicon()

    const applyStored = (parsed: VerseData) => {
      const storedBgColor = localStorage.getItem("biblePresenterBackgroundColor")
      const storedBgImage = localStorage.getItem("biblePresenterBackgroundImage")
      if (storedBgColor) parsed.backgroundColor = storedBgColor
      if (storedBgImage) parsed.backgroundImage = storedBgImage
      else parsed.backgroundImage = undefined
      return parsed
    }

    const stored = localStorage.getItem("bibleVerseData")
    if (stored) {
      try {
        const parsed = applyStored(JSON.parse(stored))
        setData(parsed)
        if (parsed.verses?.length > 0) {
          const firstVerse = parsed.verses[0]
          const title =
            firstVerse.reference ||
            firstVerse.text?.substring(0, 30) + (firstVerse.text?.length > 30 ? "..." : "")
          updateFavicon(title)
        }
      } catch {
        console.error("Failed to parse stored data")
      }
    }

    const handleStorageChange = () => {
      const updated = localStorage.getItem("bibleVerseData")
      if (!updated) return
      try {
        const parsed = applyStored(JSON.parse(updated))
        setData(parsed)
        if (parsed.verses?.length > 0) {
          const firstVerse = parsed.verses[0]
          const title =
            firstVerse.reference ||
            firstVerse.text?.substring(0, 30) + (firstVerse.text?.length > 30 ? "..." : "")
          updateFavicon(title)
        }
      } catch {
        console.error("Failed to parse updated data")
      }
    }

    window.addEventListener("storage", handleStorageChange)
    const interval = setInterval(() => {
      const current = localStorage.getItem("bibleVerseData")
      if (!current) return
      try {
        const parsed = applyStored(JSON.parse(current))
        const currentWithBg = JSON.stringify(parsed)
        setData((prev) => {
          if (JSON.stringify(prev) !== currentWithBg) {
            if (parsed.verses?.length > 0) {
              const firstVerse = parsed.verses[0]
              const title =
                firstVerse.reference ||
                firstVerse.text?.substring(0, 30) + (firstVerse.text?.length > 30 ? "..." : "")
              updateFavicon(title)
            }
            return parsed
          }
          return prev
        })
      } catch {
        // ignore
      }
    }, 500)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  // ── YouTube IFrame Player ──────────────────────────────────────────
  useEffect(() => {
    // Helper to publish the player's current state to the operator.
    // Status is sticky — only changes when explicitly told. We never
    // let polling overwrite a known status with the default.
    const publishState = (overrides: Partial<MusicState> = {}) => {
      if (overrides.status !== undefined) {
        globalLastStatus = overrides.status
      }
      const p = globalPlayer
      let base: MusicState = { ...DEFAULT_MUSIC_STATE, status: globalLastStatus }
      if (p) {
        try {
          const data = p.getVideoData()
          base = {
            status: globalLastStatus,
            videoId: data?.video_id || undefined,
            title: data?.title || undefined,
            author: data?.author || undefined,
            volume: p.getVolume(),
            duration: p.getDuration(),
            currentTime: p.getCurrentTime(),
            hasPlaylist: globalHasPlaylist,
          }
        } catch {
          // pre-ready or no data yet
        }
      }
      const merged: MusicState = { ...base, ...overrides }
      localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(merged))
    }

    const dispatch = (cmd: MusicCommand) => {
      const p = globalPlayer
      if (!p || !globalReady) {
        pendingCommandsRef.current.push(cmd)
        return
      }
      try {
        switch (cmd.type) {
          case "load":
            // Cue (no autoplay) — operator hits Play when ready.
            publishState({ status: "loading" })
            if (cmd.playlistId) {
              globalHasPlaylist = true
              p.cuePlaylist({ list: cmd.playlistId, listType: "playlist" })
            } else if (cmd.videoId) {
              globalHasPlaylist = false
              p.cueVideoById(cmd.videoId)
            }
            break
          case "play":
            p.playVideo()
            break
          case "pause":
            p.pauseVideo()
            break
          case "next":
            if (globalHasPlaylist) p.nextVideo()
            break
          case "prev":
            if (globalHasPlaylist) p.previousVideo()
            break
          case "volume":
            p.setVolume(Math.max(0, Math.min(100, cmd.value)))
            publishState({ volume: cmd.value })
            break
          case "stop":
            p.stopVideo()
            globalHasPlaylist = false
            publishState({ status: "idle" })
            break
        }
      } catch (e) {
        publishState({ status: "error" })
        console.error("Music command failed", e)
      }
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
      // Audio playback requires a user gesture in this tab. Loading
      // (cueing) doesn't autoplay anymore, so only `play` triggers the
      // overlay.
      if (cmd.type === "play" && !hasGesture()) {
        setNeedsAudioGesture(true)
      }
      dispatch(cmd)
    }

    const hasGesture = () => sessionStorage.getItem("flowwwwGesture") === "1"

    const initPlayer = () => {
      const YT = window.YT
      if (!YT) return
      if (globalPlayer) {
        // Player already exists from a previous mount (StrictMode dev).
        // Drain any queued commands and skip recreating it.
        if (globalReady) {
          const pending = pendingCommandsRef.current
          pendingCommandsRef.current = []
          pending.forEach(dispatch)
        }
        return
      }
      globalPlayer = new YT.Player("yt-player", {
        height: "1",
        width: "1",
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            globalReady = true
            const savedVol = localStorage.getItem("flowwwwMusicVolume")
            if (savedVol != null) {
              const n = Number(savedVol)
              if (!Number.isNaN(n)) globalPlayer?.setVolume(n)
            }
            publishState({ status: "idle" })
            const pending = pendingCommandsRef.current
            pendingCommandsRef.current = []
            pending.forEach(dispatch)
            titlePollRef.current = setInterval(() => publishState({}), 1000)
          },
          onStateChange: (e: { data: number }) => {
            const YTP = window.YT?.PlayerState
            if (!YTP) return
            let status: MusicState["status"] | null = null
            if (e.data === YTP.PLAYING) status = "playing"
            else if (e.data === YTP.PAUSED) status = "paused"
            else if (e.data === YTP.ENDED) status = "ended"
            else if (e.data === YTP.BUFFERING) status = "loading"
            else if (e.data === YTP.CUED) status = "paused"
            // YT also fires UNSTARTED (-1) during track changes; preserve
            // the previous status rather than dropping back to idle.
            if (status === null) publishState({})
            else publishState({ status })
          },
          onError: () => publishState({ status: "error" }),
        },
      }) as YTPlayer
    }

    // Load YouTube IFrame API once
    if (window.YT?.Player) {
      initPlayer()
    } else {
      const existing = document.querySelector(
        "script[src='https://www.youtube.com/iframe_api']",
      )
      if (!existing) {
        const tag = document.createElement("script")
        tag.src = "https://www.youtube.com/iframe_api"
        document.body.appendChild(tag)
      }
      window.onYouTubeIframeAPIReady = initPlayer
    }

    // Listen for commands
    const onStorage = (e: StorageEvent) => {
      if (e.key === MUSIC_COMMAND_KEY) processCommand()
    }
    window.addEventListener("storage", onStorage)
    processCommand()

    return () => {
      window.removeEventListener("storage", onStorage)
      if (titlePollRef.current) clearInterval(titlePollRef.current)
    }
  }, [])

  const backgroundColor = data.backgroundColor || (data.darkMode ? "#000000" : "#FFFFFF")
  const backgroundImage = data.backgroundImage
  const mediaUrl = data.mediaUrl

  return (
    <>
      <SlideStage
        backgroundColor={backgroundColor}
        backgroundImage={backgroundImage}
        mediaUrl={mediaUrl}
        className="w-screen h-screen"
      >
        {data.verses.length > 0 && (
          <SlideContent
            verses={data.verses}
            fontSize={data.fontSize}
            backgroundColor={backgroundColor}
            backgroundImage={backgroundImage}
            defaultVersion={data.version}
          />
        )}
      </SlideStage>

      {/* Hidden YouTube IFrame player — receives commands, audio plays here */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          bottom: 0,
          right: 0,
        }}
      >
        <div id="yt-player" />
      </div>

      {needsAudioGesture && (
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem("flowwwwGesture", "1")
            setNeedsAudioGesture(false)
            // Nudge the player to actually play, in case it was queued
            try {
              globalPlayer?.playVideo()
            } catch {
              // ignore
            }
          }}
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-full bg-white/90 text-black text-sm font-medium shadow-lg hover:bg-white transition-colors"
        >
          Click to enable audio
        </button>
      )}
    </>
  )
}

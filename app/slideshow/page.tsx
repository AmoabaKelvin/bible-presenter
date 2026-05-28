"use client"

import { useState, useEffect, useRef } from "react"
import {
  SlideStage,
  SlideContent,
  type FontSize,
  type SelectedVerse,
} from "@/components/slide-stage"
import { resolveImageUrl } from "@/lib/image-store"
import {
  DEFAULT_MUSIC_STATE,
  MUSIC_COMMAND_KEY,
  MUSIC_PROVIDER_KEY,
  MUSIC_STATE_KEY,
  SLIDESHOW_HEARTBEAT_KEY,
  SLIDESHOW_HEARTBEAT_INTERVAL_MS,
  type MusicCommand,
  type MusicProvider,
  type MusicState,
  isSpotifyLoadCommand,
} from "@/lib/youtube-music"

interface VerseData {
  verses: SelectedVerse[]
  fontSize: FontSize
  darkMode: boolean
  version?: string
  backgroundColor?: string
  // backgroundImage / mediaId carry IndexedDB ids (or legacy direct URLs);
  // each are resolved to this tab's own object URL before rendering.
  backgroundImage?: string
  mediaId?: string
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
    Spotify?: {
      Player: new (opts: SpotifyPlayerOptions) => SpotifyPlayer
    }
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

interface YTPlayer {
  loadVideoById: (id: string) => void
  loadPlaylist: (opts: { list: string; listType: string; index?: number }) => void
  cueVideoById: (id: string) => void
  cuePlaylist: (opts: { list: string; listType: string; index?: number }) => void
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  nextVideo: () => void
  previousVideo: () => void
  playVideoAt: (index: number) => void
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  setVolume: (v: number) => void
  getVolume: () => number
  getVideoData: () => { video_id: string; title: string; author: string }
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState?: () => number
  getPlaylist?: () => string[] | null
  getPlaylistIndex?: () => number
}

interface SpotifyPlayerOptions {
  name: string
  getOAuthToken: (cb: (token: string) => void) => void
  volume?: number
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, cb: (payload: SpotifyEventPayload) => void) => boolean
  removeListener: (event: string) => boolean
  getCurrentState: () => Promise<SpotifyPlaybackState | null>
  setVolume: (volume: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  previousTrack: () => Promise<void>
  nextTrack: () => Promise<void>
  seek: (positionMs: number) => Promise<void>
  activateElement: () => Promise<void>
}

type SpotifyEventPayload =
  | { device_id: string }
  | { message: string }
  | SpotifyPlaybackState
  | null

interface SpotifyPlaybackState {
  paused: boolean
  position: number
  duration: number
  context?: { uri?: string | null } | null
  track_window: {
    current_track?: SpotifyTrack | null
  }
}

interface SpotifyTrack {
  id: string
  uri: string
  name: string
  duration_ms: number
  artists?: { name: string }[]
  album?: { images?: { url: string }[] }
}

// Module-level guard — React StrictMode mounts effects twice in dev,
// which would otherwise create two YT.Player instances racing on the
// same localStorage state. Keep a single player for the lifetime of
// the tab.
let globalPlayer: YTPlayer | null = null
let globalReady = false
let globalHasPlaylist = false
let globalLastStatus: MusicState["status"] = "idle"
let globalYouTubeMetadata: Pick<MusicState, "title" | "author" | "albumArtUrl"> = {}
let globalActiveProvider: MusicProvider = "youtube"
let globalSpotifyPlayer: SpotifyPlayer | null = null
let globalSpotifyReady = false
let globalSpotifyDeviceId: string | null = null
let globalSpotifyInitPromise: Promise<void> | null = null
let globalSpotifyLastStatus: MusicState["status"] = "idle"

export default function SlideshowPage() {
  const [data, setData] = useState<VerseData>({
    verses: [],
    fontSize: "extra-large",
    darkMode: true,
    version: "KJV",
    backgroundColor: "#000000",
  })
  const [needsAudioGesture, setNeedsAudioGesture] = useState(false)
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null)
  const [mediaImageUrl, setMediaImageUrl] = useState<string | null>(null)

  const lastCommandIdRef = useRef<string | null>(null)
  const pendingCommandsRef = useRef<MusicCommand[]>([])
  const titlePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spotifyPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // ── Resolve image ids → this tab's object URLs ─────────────────────
  useEffect(() => {
    let cancelled = false
    resolveImageUrl(data.backgroundImage).then((url) => {
      if (!cancelled) setBgImageUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [data.backgroundImage])

  useEffect(() => {
    let cancelled = false
    resolveImageUrl(data.mediaId).then((url) => {
      if (!cancelled) setMediaImageUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [data.mediaId])

  // ── YouTube IFrame Player ──────────────────────────────────────────
  useEffect(() => {
    try {
      const storedProvider = localStorage.getItem(MUSIC_PROVIDER_KEY)
      if (storedProvider === "youtube" || storedProvider === "spotify") {
        globalActiveProvider = storedProvider
      } else {
        const storedState = localStorage.getItem(MUSIC_STATE_KEY)
        const provider = storedState ? (JSON.parse(storedState) as MusicState).provider : undefined
        if (provider === "youtube" || provider === "spotify") globalActiveProvider = provider
      }
    } catch {
      // ignore corrupt persisted music provider
    }

    // Helper to publish the player's current state to the operator.
    // Status is sticky — only changes when explicitly told. We never
    // let polling overwrite a known status with the default.
    const publishState = (overrides: Partial<MusicState> = {}) => {
      // Only the active provider is allowed to write shared state.
      // Otherwise YouTube events (onReady/onStateChange) and the Spotify
      // listeners fight over MUSIC_STATE_KEY and the operator flickers.
      if (globalActiveProvider !== "youtube") return
      if (overrides.status !== undefined) {
        globalLastStatus = overrides.status
      }
      const p = globalPlayer
      let base: MusicState = {
        ...DEFAULT_MUSIC_STATE,
        provider: "youtube",
        status: globalLastStatus,
      }
      if (p) {
        try {
          const data = p.getVideoData()
          let playlistVideoIds: string[] | undefined
          let playlistIndex: number | undefined
          if (globalHasPlaylist) {
            try {
              const list = p.getPlaylist?.()
              if (Array.isArray(list) && list.length > 0) playlistVideoIds = list
              const idx = p.getPlaylistIndex?.()
              if (typeof idx === "number" && idx >= 0) playlistIndex = idx
            } catch {
              // playlist not loaded yet
            }
          }
          base = {
            provider: "youtube",
            status: globalLastStatus,
            videoId: data?.video_id || undefined,
            title: globalYouTubeMetadata.title || data?.title || undefined,
            author: globalYouTubeMetadata.author || data?.author || undefined,
            albumArtUrl: globalYouTubeMetadata.albumArtUrl,
            volume: p.getVolume(),
            duration: p.getDuration(),
            currentTime: p.getCurrentTime(),
            hasPlaylist: globalHasPlaylist,
            playlistVideoIds,
            playlistIndex,
          }
        } catch {
          // pre-ready or no data yet
        }
      }
      const merged: MusicState = { ...base, ...overrides }
      localStorage.setItem(MUSIC_PROVIDER_KEY, "youtube")
      localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(merged))
    }

    const spotifyStateToMusicState = (
      state: SpotifyPlaybackState | null,
      overrides: Partial<MusicState> = {},
    ): MusicState => {
      if (overrides.status !== undefined) {
        globalSpotifyLastStatus = overrides.status
      } else if (state) {
        globalSpotifyLastStatus = state.paused ? "paused" : "playing"
      }

      const track = state?.track_window.current_track
      const image = track?.album?.images?.[0]?.url
      const savedVolume = localStorage.getItem("flowwwwMusicVolume")
      const volume = savedVolume == null ? DEFAULT_MUSIC_STATE.volume : Number(savedVolume)
      return {
        ...DEFAULT_MUSIC_STATE,
        provider: "spotify",
        status: globalSpotifyLastStatus,
        uri: track?.uri,
        title: track?.name,
        author: track?.artists?.map((artist) => artist.name).join(", "),
        albumArtUrl: image,
        volume: Number.isFinite(volume) ? volume : DEFAULT_MUSIC_STATE.volume,
        duration: state ? state.duration / 1000 : undefined,
        currentTime: state ? state.position / 1000 : undefined,
        hasPlaylist: !!state?.context?.uri,
        ...overrides,
      }
    }

    const publishSpotifyState = async (overrides: Partial<MusicState> = {}) => {
      if (globalActiveProvider !== "spotify") return
      try {
        const state = globalSpotifyPlayer ? await globalSpotifyPlayer.getCurrentState() : null
        localStorage.setItem(MUSIC_PROVIDER_KEY, "spotify")
        localStorage.setItem(
          MUSIC_STATE_KEY,
          JSON.stringify(spotifyStateToMusicState(state, overrides)),
        )
      } catch {
        localStorage.setItem(MUSIC_PROVIDER_KEY, "spotify")
        localStorage.setItem(
          MUSIC_STATE_KEY,
          JSON.stringify(spotifyStateToMusicState(null, overrides)),
        )
      }
    }

    const getSpotifyToken = async () => {
      const res = await fetch("/api/spotify/token", { cache: "no-store" })
      if (!res.ok) throw new Error("Spotify is not connected.")
      const data = (await res.json()) as { accessToken: string }
      return data.accessToken
    }

    const loadSpotifySdk = () => {
      if (window.Spotify?.Player) return Promise.resolve()
      if (globalSpotifyInitPromise) return globalSpotifyInitPromise

      globalSpotifyInitPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector(
          "script[src='https://sdk.scdn.co/spotify-player.js']",
        )
        const timeout = window.setTimeout(() => reject(new Error("Spotify SDK timed out.")), 15_000)
        window.onSpotifyWebPlaybackSDKReady = () => {
          window.clearTimeout(timeout)
          resolve()
        }
        if (!existing) {
          const tag = document.createElement("script")
          tag.src = "https://sdk.scdn.co/spotify-player.js"
          tag.async = true
          tag.onerror = () => {
            window.clearTimeout(timeout)
            reject(new Error("Failed to load Spotify SDK."))
          }
          document.body.appendChild(tag)
        }
      })

      return globalSpotifyInitPromise
    }

    const ensureSpotifyPlayer = async () => {
      if (globalSpotifyPlayer && globalSpotifyReady && globalSpotifyDeviceId) return

      await loadSpotifySdk()
      if (!window.Spotify?.Player) throw new Error("Spotify SDK is unavailable.")

      if (!globalSpotifyPlayer) {
        const savedVol = Number(localStorage.getItem("flowwwwMusicVolume"))
        const initialVolume = Number.isFinite(savedVol) ? savedVol / 100 : DEFAULT_MUSIC_STATE.volume / 100
        globalSpotifyPlayer = new window.Spotify.Player({
          name: "flowwww",
          volume: initialVolume,
          getOAuthToken: (cb) => {
            getSpotifyToken().then(cb).catch(() => cb(""))
          },
        })

        globalSpotifyPlayer.addListener("ready", (payload) => {
          const deviceId = payload && "device_id" in payload ? payload.device_id : null
          globalSpotifyReady = true
          globalSpotifyDeviceId = deviceId
          publishSpotifyState({ status: "paused" })
        })
        globalSpotifyPlayer.addListener("not_ready", () => {
          globalSpotifyReady = false
          publishSpotifyState({ status: "error", errorMessage: "Spotify player is not ready." })
        })
        globalSpotifyPlayer.addListener("player_state_changed", (payload) => {
          if (globalActiveProvider !== "spotify") return
          if (!payload || !("track_window" in payload)) return
          localStorage.setItem(MUSIC_PROVIDER_KEY, "spotify")
          localStorage.setItem(
            MUSIC_STATE_KEY,
            JSON.stringify(spotifyStateToMusicState(payload)),
          )
        })
        globalSpotifyPlayer.addListener("autoplay_failed", () => {
          setNeedsAudioGesture(true)
          publishSpotifyState({ status: "paused", errorMessage: "Click to enable Spotify audio." })
        })
        for (const eventName of ["initialization_error", "authentication_error", "account_error", "playback_error"]) {
          globalSpotifyPlayer.addListener(eventName, (payload) => {
            const message = payload && "message" in payload ? payload.message : "Spotify playback failed."
            publishSpotifyState({ status: "error", errorMessage: message })
          })
        }
      }

      const connected = await globalSpotifyPlayer.connect()
      if (!connected) throw new Error("Spotify player failed to connect.")

      if (!spotifyPollRef.current) {
        spotifyPollRef.current = setInterval(() => {
          if (globalActiveProvider === "spotify") publishSpotifyState({})
        }, 1000)
      }

      const start = Date.now()
      while (!globalSpotifyDeviceId && Date.now() - start < 10_000) {
        await new Promise((resolve) => window.setTimeout(resolve, 100))
      }
      if (!globalSpotifyDeviceId) throw new Error("Spotify player did not provide a device id.")
    }

    const transferSpotifyPlayback = async (play: boolean) => {
      await ensureSpotifyPlayer()
      const token = await getSpotifyToken()
      await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ device_ids: [globalSpotifyDeviceId], play }),
      })
    }

    const startSpotifyPlayback = async (
      cmd: Extract<MusicCommand, { provider: "spotify"; type: "load" }>,
    ) => {
      globalActiveProvider = "spotify"
      localStorage.setItem(MUSIC_PROVIDER_KEY, "spotify")
      await publishSpotifyState({ status: "loading" })
      await transferSpotifyPlayback(false)

      if (cmd.autoplay === false) {
        await publishSpotifyState({ status: "paused", uri: cmd.uri })
        return
      }

      if (!hasGesture()) setNeedsAudioGesture(true)

      const token = await getSpotifyToken()
      const body: Record<string, unknown> = {}
      if (cmd.contextUri) {
        body.context_uri = cmd.contextUri
        if (cmd.offsetUri || cmd.uri) body.offset = { uri: cmd.offsetUri || cmd.uri }
      } else if (cmd.uri.startsWith("spotify:track:") || cmd.uri.startsWith("spotify:episode:")) {
        body.uris = [cmd.uri]
      } else {
        body.context_uri = cmd.uri
      }
      if (cmd.positionMs !== undefined) body.position_ms = Math.max(0, cmd.positionMs)

      const url = new URL("https://api.spotify.com/v1/me/player/play")
      url.searchParams.set("device_id", globalSpotifyDeviceId || "")
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Spotify playback failed (${res.status}).`)
      await publishSpotifyState({ status: "playing", uri: cmd.uri })
    }

    const dispatchSpotifyControl = async (cmd: MusicCommand) => {
      globalActiveProvider = "spotify"
      localStorage.setItem(MUSIC_PROVIDER_KEY, "spotify")
      await ensureSpotifyPlayer()
      switch (cmd.type) {
        case "play":
          await globalSpotifyPlayer?.resume()
          await publishSpotifyState({ status: "playing" })
          break
        case "pause":
          await globalSpotifyPlayer?.pause()
          await publishSpotifyState({ status: "paused" })
          break
        case "next":
          await globalSpotifyPlayer?.nextTrack()
          await publishSpotifyState({ status: "loading" })
          break
        case "prev":
          await globalSpotifyPlayer?.previousTrack()
          await publishSpotifyState({ status: "loading" })
          break
        case "seek":
          await globalSpotifyPlayer?.seek(Math.max(0, cmd.seconds * 1000))
          await publishSpotifyState({ currentTime: cmd.seconds })
          break
        case "volume":
          await globalSpotifyPlayer?.setVolume(Math.max(0, Math.min(100, cmd.value)) / 100)
          await publishSpotifyState({ volume: cmd.value })
          break
        case "stop":
          await globalSpotifyPlayer?.pause()
          await publishSpotifyState({ status: "idle" })
          break
      }
    }

    const dispatch = (cmd: MusicCommand) => {
      if (isSpotifyLoadCommand(cmd)) {
        startSpotifyPlayback(cmd).catch((err) => {
          publishSpotifyState({ status: "error", errorMessage: (err as Error).message })
        })
        return
      }
      if (cmd.provider === "spotify" || (cmd.type !== "load" && globalActiveProvider === "spotify")) {
        dispatchSpotifyControl(cmd).catch((err) => {
          publishSpotifyState({ status: "error", errorMessage: (err as Error).message })
        })
        return
      }

      const p = globalPlayer
      if (!p || !globalReady) {
        pendingCommandsRef.current.push(cmd)
        return
      }
      try {
        switch (cmd.type) {
          case "load":
            globalActiveProvider = "youtube"
            localStorage.setItem(MUSIC_PROVIDER_KEY, "youtube")
            globalYouTubeMetadata = {
              title: cmd.title,
              author: cmd.author,
              albumArtUrl: cmd.thumbnailUrl,
            }
            publishState({ status: "loading" })
            // Browser audio policy requires a real gesture in this output
            // tab. If we have not had one yet, cue the media instead of
            // attempting autoplay, otherwise the YT iframe can stay stuck
            // in a loading state.
            const canAutoplay = !!cmd.autoplay && hasGesture()
            if (cmd.playlistId) {
              globalHasPlaylist = true
              const opts = {
                list: cmd.playlistId,
                listType: "playlist",
                index: cmd.playlistIndex,
              }
              if (canAutoplay) p.loadPlaylist(opts)
              else {
                p.cuePlaylist(opts)
                publishState({ status: "paused" })
              }
            } else if (cmd.videoId) {
              globalHasPlaylist = false
              if (canAutoplay) p.loadVideoById(cmd.videoId)
              else {
                p.cueVideoById(cmd.videoId)
                publishState({ status: "paused", videoId: cmd.videoId })
              }
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
          case "playAt":
            if (globalHasPlaylist) p.playVideoAt(cmd.index)
            break
          case "seek":
            p.seekTo(cmd.seconds, true)
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
      if ((cmd.type === "play" || (cmd.type === "load" && cmd.autoplay)) && !hasGesture()) {
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
        height: "200",
        width: "200",
        // Setting `origin` is required in production for the YT IFrame
        // postMessage handshake — without it `onReady` may never fire
        // on https domains. Bumping the iframe past 1x1 also avoids
        // some browsers' aggressive throttling of zero-size frames.
        playerVars: {
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
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
            // Only publish YouTube state when YouTube is the active
            // provider — otherwise this poll fights the Spotify poll
            // over MUSIC_STATE_KEY and the operator UI flickers.
            titlePollRef.current = setInterval(() => {
              if (globalActiveProvider === "youtube") publishState({})
            }, 1000)
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
          onError: (e: { data: number }) =>
            publishState({ status: "error", errorMessage: `YouTube playback error ${e.data}` }),
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
      if (spotifyPollRef.current) clearInterval(spotifyPollRef.current)
    }
  }, [])

  // ── Heartbeat so the operator can tell the output is open ─────────
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

  const backgroundColor = data.backgroundColor || (data.darkMode ? "#000000" : "#FFFFFF")
  const backgroundImage = bgImageUrl ?? undefined
  const mediaUrl = mediaImageUrl ?? undefined

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

      {/* Hidden YouTube IFrame player — receives commands, audio plays here.
          Kept visually offscreen rather than 1×1 so browsers don't throttle it. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          width: 200,
          height: 200,
          opacity: 0,
          pointerEvents: "none",
          left: -9999,
          top: -9999,
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
            try {
              globalSpotifyPlayer?.activateElement()
            } catch {
              // ignore
            }
            // Nudge the player to actually play, in case it was queued
            try {
              globalPlayer?.playVideo()
            } catch {
              // ignore
            }
            try {
              globalSpotifyPlayer?.resume()
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

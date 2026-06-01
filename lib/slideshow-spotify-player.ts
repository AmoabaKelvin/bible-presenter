import {
  DEFAULT_MUSIC_STATE,
  MUSIC_PROVIDER_KEY,
  MUSIC_STATE_KEY,
  type MusicCommand,
  type MusicProvider,
  type MusicState,
} from "@/lib/music-protocol"

declare global {
  interface Window {
    Spotify?: {
      Player: new (opts: SpotifyPlayerOptions) => SpotifyPlayer
    }
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

interface SpotifyPlayerOptions {
  name: string
  getOAuthToken: (cb: (token: string) => void) => void
  volume?: number
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>
  addListener: (event: string, cb: (payload: SpotifyEventPayload) => void) => boolean
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
  uri: string
  name: string
  artists?: { name: string }[]
  album?: { images?: { url: string }[] }
}

type SpotifyRuntimeOptions = {
  getActiveProvider: () => MusicProvider
  setActiveProvider: (provider: MusicProvider) => void
  setNeedsAudioGesture: (needsGesture: boolean) => void
  hasGesture: () => boolean
}

let globalSpotifyPlayer: SpotifyPlayer | null = null
let globalSpotifyReady = false
let globalSpotifyDeviceId: string | null = null
let globalSpotifyInitPromise: Promise<void> | null = null
let globalSpotifyLastStatus: MusicState["status"] = "idle"
let globalSpotifyPollInterval: ReturnType<typeof setInterval> | null = null

function spotifyStateToMusicState(
  state: SpotifyPlaybackState | null,
  overrides: Partial<MusicState> = {},
): MusicState {
  if (overrides.status !== undefined) {
    globalSpotifyLastStatus = overrides.status
  } else if (state) {
    globalSpotifyLastStatus = state.paused ? "paused" : "playing"
  }

  const track = state?.track_window.current_track
  const savedVolume = localStorage.getItem("flowcastMusicVolume")
  const volume = savedVolume == null ? DEFAULT_MUSIC_STATE.volume : Number(savedVolume)
  return {
    ...DEFAULT_MUSIC_STATE,
    provider: "spotify",
    status: globalSpotifyLastStatus,
    uri: track?.uri,
    title: track?.name,
    author: track?.artists?.map((artist) => artist.name).join(", "),
    albumArtUrl: track?.album?.images?.[0]?.url,
    volume: Number.isFinite(volume) ? volume : DEFAULT_MUSIC_STATE.volume,
    duration: state ? state.duration / 1000 : undefined,
    currentTime: state ? state.position / 1000 : undefined,
    hasPlaylist: !!state?.context?.uri,
    ...overrides,
  }
}

async function getSpotifyToken() {
  const res = await fetch("/api/spotify/token", { cache: "no-store" })
  if (!res.ok) throw new Error("Spotify is not connected.")
  const data = (await res.json()) as { accessToken: string }
  return data.accessToken
}

function loadSpotifySdk() {
  if (window.Spotify?.Player) return Promise.resolve()
  if (globalSpotifyInitPromise) return globalSpotifyInitPromise

  globalSpotifyInitPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector("script[src='https://sdk.scdn.co/spotify-player.js']")
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

export function enableSpotifyAudio() {
  try {
    globalSpotifyPlayer?.activateElement()
  } catch {
    // ignore
  }
  try {
    globalSpotifyPlayer?.resume()
  } catch {
    // ignore
  }
}

export function cleanupSpotifyRuntime() {
  if (globalSpotifyPollInterval) clearInterval(globalSpotifyPollInterval)
  globalSpotifyPollInterval = null
}

export function createSpotifyRuntime({
  getActiveProvider,
  setActiveProvider,
  setNeedsAudioGesture,
  hasGesture,
}: SpotifyRuntimeOptions) {
  const publishState = async (overrides: Partial<MusicState> = {}) => {
    if (getActiveProvider() !== "spotify") return
    try {
      const state = globalSpotifyPlayer ? await globalSpotifyPlayer.getCurrentState() : null
      localStorage.setItem(MUSIC_PROVIDER_KEY, "spotify")
      localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(spotifyStateToMusicState(state, overrides)))
    } catch {
      localStorage.setItem(MUSIC_PROVIDER_KEY, "spotify")
      localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(spotifyStateToMusicState(null, overrides)))
    }
  }

  const ensurePolling = () => {
    if (!globalSpotifyPollInterval) {
      globalSpotifyPollInterval = setInterval(() => {
        if (getActiveProvider() === "spotify") publishState({})
      }, 1000)
    }
  }

  const ensurePlayer = async () => {
    if (globalSpotifyPlayer && globalSpotifyReady && globalSpotifyDeviceId) {
      ensurePolling()
      return
    }

    await loadSpotifySdk()
    if (!window.Spotify?.Player) throw new Error("Spotify SDK is unavailable.")

    if (!globalSpotifyPlayer) {
      const savedVol = Number(localStorage.getItem("flowcastMusicVolume"))
      const initialVolume = Number.isFinite(savedVol)
        ? savedVol / 100
        : DEFAULT_MUSIC_STATE.volume / 100
      globalSpotifyPlayer = new window.Spotify.Player({
        name: "FlowCast",
        volume: initialVolume,
        getOAuthToken: (cb) => {
          getSpotifyToken().then(cb).catch(() => cb(""))
        },
      })

      globalSpotifyPlayer.addListener("ready", (payload) => {
        const deviceId = payload && "device_id" in payload ? payload.device_id : null
        globalSpotifyReady = true
        globalSpotifyDeviceId = deviceId
        publishState({ status: "paused" })
      })
      globalSpotifyPlayer.addListener("not_ready", () => {
        globalSpotifyReady = false
        publishState({ status: "error", errorMessage: "Spotify player is not ready." })
      })
      globalSpotifyPlayer.addListener("player_state_changed", (payload) => {
        if (getActiveProvider() !== "spotify") return
        if (!payload || !("track_window" in payload)) return
        localStorage.setItem(MUSIC_PROVIDER_KEY, "spotify")
        localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(spotifyStateToMusicState(payload)))
      })
      globalSpotifyPlayer.addListener("autoplay_failed", () => {
        setNeedsAudioGesture(true)
        publishState({ status: "paused", errorMessage: "Click to enable Spotify audio." })
      })
      for (const eventName of [
        "initialization_error",
        "authentication_error",
        "account_error",
        "playback_error",
      ]) {
        globalSpotifyPlayer.addListener(eventName, (payload) => {
          const message = payload && "message" in payload ? payload.message : "Spotify playback failed."
          publishState({ status: "error", errorMessage: message })
        })
      }
    }

    const connected = await globalSpotifyPlayer.connect()
    if (!connected) throw new Error("Spotify player failed to connect.")

    ensurePolling()

    const start = Date.now()
    while (!globalSpotifyDeviceId && Date.now() - start < 10_000) {
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }
    if (!globalSpotifyDeviceId) throw new Error("Spotify player did not provide a device id.")
  }

  const transferPlayback = async (play: boolean) => {
    await ensurePlayer()
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

  const startPlayback = async (
    cmd: Extract<MusicCommand, { provider: "spotify"; type: "load" }>,
  ) => {
    setActiveProvider("spotify")
    localStorage.setItem(MUSIC_PROVIDER_KEY, "spotify")
    await publishState({ status: "loading" })
    await transferPlayback(false)

    if (cmd.autoplay === false) {
      await publishState({ status: "paused", uri: cmd.uri })
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
    await publishState({ status: "playing", uri: cmd.uri })
  }

  const dispatchControl = async (cmd: MusicCommand) => {
    setActiveProvider("spotify")
    localStorage.setItem(MUSIC_PROVIDER_KEY, "spotify")
    await ensurePlayer()
    switch (cmd.type) {
      case "play":
        await globalSpotifyPlayer?.resume()
        await publishState({ status: "playing" })
        break
      case "pause":
        await globalSpotifyPlayer?.pause()
        await publishState({ status: "paused" })
        break
      case "next":
        await globalSpotifyPlayer?.nextTrack()
        await publishState({ status: "loading" })
        break
      case "prev":
        await globalSpotifyPlayer?.previousTrack()
        await publishState({ status: "loading" })
        break
      case "seek":
        await globalSpotifyPlayer?.seek(Math.max(0, cmd.seconds * 1000))
        await publishState({ currentTime: cmd.seconds })
        break
      case "volume":
        await globalSpotifyPlayer?.setVolume(Math.max(0, Math.min(100, cmd.value)) / 100)
        await publishState({ volume: cmd.value })
        break
      case "stop":
        await globalSpotifyPlayer?.pause()
        await publishState({ status: "idle" })
        break
    }
  }

  return {
    publishState,
    startPlayback,
    dispatchControl,
  }
}

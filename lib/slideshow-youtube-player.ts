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
    YT?: {
      Player: new (el: string | HTMLElement, opts: Record<string, unknown>) => YTPlayer
      PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 }
    }
    onYouTubeIframeAPIReady?: () => void
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
  getPlaylist?: () => string[] | null
  getPlaylistIndex?: () => number
}

type YouTubeRuntimeOptions = {
  getActiveProvider: () => MusicProvider
  setActiveProvider: (provider: MusicProvider) => void
  hasGesture: () => boolean
}

let globalPlayer: YTPlayer | null = null
let globalReady = false
let globalHasPlaylist = false
let globalLastStatus: MusicState["status"] = "idle"
let globalMetadata: Pick<MusicState, "title" | "author" | "albumArtUrl"> = {}
let globalPendingCommands: MusicCommand[] = []
let globalPollInterval: ReturnType<typeof setInterval> | null = null

export function enableYouTubeAudio() {
  try {
    globalPlayer?.playVideo()
  } catch {
    // ignore
  }
}

export function cleanupYouTubeRuntime() {
  if (globalPollInterval) clearInterval(globalPollInterval)
  globalPollInterval = null
}

export function createYouTubeRuntime({
  getActiveProvider,
  setActiveProvider,
  hasGesture,
}: YouTubeRuntimeOptions) {
  const publishState = (overrides: Partial<MusicState> = {}) => {
    if (getActiveProvider() !== "youtube") return
    if (overrides.status !== undefined) globalLastStatus = overrides.status

    const player = globalPlayer
    let base: MusicState = {
      ...DEFAULT_MUSIC_STATE,
      provider: "youtube",
      status: globalLastStatus,
    }

    if (player) {
      try {
        const data = player.getVideoData()
        let playlistVideoIds: string[] | undefined
        let playlistIndex: number | undefined
        if (globalHasPlaylist) {
          try {
            const list = player.getPlaylist?.()
            if (Array.isArray(list) && list.length > 0) playlistVideoIds = list
            const idx = player.getPlaylistIndex?.()
            if (typeof idx === "number" && idx >= 0) playlistIndex = idx
          } catch {
            // playlist not loaded yet
          }
        }
        base = {
          provider: "youtube",
          status: globalLastStatus,
          videoId: data?.video_id || undefined,
          title: globalMetadata.title || data?.title || undefined,
          author: globalMetadata.author || data?.author || undefined,
          albumArtUrl: globalMetadata.albumArtUrl,
          volume: player.getVolume(),
          duration: player.getDuration(),
          currentTime: player.getCurrentTime(),
          hasPlaylist: globalHasPlaylist,
          playlistVideoIds,
          playlistIndex,
        }
      } catch {
        // pre-ready or no data yet
      }
    }

    localStorage.setItem(MUSIC_PROVIDER_KEY, "youtube")
    localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify({ ...base, ...overrides }))
  }

  const ensurePolling = () => {
    if (!globalPollInterval) {
      globalPollInterval = setInterval(() => {
        if (getActiveProvider() === "youtube") publishState({})
      }, 1000)
    }
  }

  const drainPending = () => {
    const pending = globalPendingCommands
    globalPendingCommands = []
    pending.forEach(dispatch)
  }

  const dispatch = (cmd: MusicCommand) => {
    const player = globalPlayer
    if (!player || !globalReady) {
      globalPendingCommands.push(cmd)
      return
    }
    try {
      switch (cmd.type) {
        case "load": {
          if (cmd.provider === "spotify") return
          setActiveProvider("youtube")
          localStorage.setItem(MUSIC_PROVIDER_KEY, "youtube")
          globalMetadata = {
            title: cmd.title,
            author: cmd.author,
            albumArtUrl: cmd.thumbnailUrl,
          }
          publishState({ status: "loading" })
          const canAutoplay = !!cmd.autoplay && hasGesture()
          if (cmd.playlistId) {
            globalHasPlaylist = true
            const opts = { list: cmd.playlistId, listType: "playlist", index: cmd.playlistIndex }
            if (canAutoplay) player.loadPlaylist(opts)
            else {
              player.cuePlaylist(opts)
              publishState({ status: "paused" })
            }
          } else if (cmd.videoId) {
            globalHasPlaylist = false
            if (canAutoplay) player.loadVideoById(cmd.videoId)
            else {
              player.cueVideoById(cmd.videoId)
              publishState({ status: "paused", videoId: cmd.videoId })
            }
          }
          break
        }
        case "play":
          player.playVideo()
          break
        case "pause":
          player.pauseVideo()
          break
        case "next":
          if (globalHasPlaylist) player.nextVideo()
          break
        case "prev":
          if (globalHasPlaylist) player.previousVideo()
          break
        case "playAt":
          if (globalHasPlaylist) player.playVideoAt(cmd.index)
          break
        case "seek":
          player.seekTo(cmd.seconds, true)
          break
        case "volume":
          player.setVolume(Math.max(0, Math.min(100, cmd.value)))
          publishState({ volume: cmd.value })
          break
        case "stop":
          player.stopVideo()
          globalHasPlaylist = false
          publishState({ status: "idle" })
          break
      }
    } catch (e) {
      publishState({ status: "error" })
      console.error("Music command failed", e)
    }
  }

  const init = () => {
    const YT = window.YT
    if (!YT) return
    if (globalPlayer) {
      if (globalReady) {
        ensurePolling()
        drainPending()
      }
      return
    }
    globalPlayer = new YT.Player("yt-player", {
      height: "200",
      width: "200",
      playerVars: {
        origin: window.location.origin,
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
          const savedVol = localStorage.getItem("flowcastMusicVolume")
          if (savedVol != null) {
            const n = Number(savedVol)
            if (!Number.isNaN(n)) globalPlayer?.setVolume(n)
          }
          publishState({ status: "idle" })
          drainPending()
          ensurePolling()
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
          if (status === null) publishState({})
          else publishState({ status })
        },
        onError: (e: { data: number }) =>
          publishState({ status: "error", errorMessage: `YouTube playback error ${e.data}` }),
      },
    }) as YTPlayer
  }

  const loadSdk = () => {
    if (window.YT?.Player) {
      init()
      return
    }
    const existing = document.querySelector("script[src='https://www.youtube.com/iframe_api']")
    if (!existing) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      document.body.appendChild(tag)
    }
    window.onYouTubeIframeAPIReady = init
  }

  return {
    dispatch,
    loadSdk,
  }
}

export const MUSIC_COMMAND_KEY = "flowcastMusicCommand"
export const MUSIC_STATE_KEY = "flowcastMusicState"
export const MUSIC_URL_KEY = "flowcastMusicUrl"
export const MUSIC_VOLUME_KEY = "flowcastMusicVolume"
export const MUSIC_PROVIDER_KEY = "flowcastMusicProvider"

export const SLIDESHOW_HEARTBEAT_KEY = "flowcastSlideshowHeartbeat"
export const SLIDESHOW_HEARTBEAT_INTERVAL_MS = 2000
export const SLIDESHOW_HEARTBEAT_STALE_MS = 5000

export type MusicCommand =
  | {
      id: string
      type: "load"
      provider?: "youtube"
      url?: string
      videoId?: string
      playlistId?: string
      playlistIndex?: number
      title?: string
      author?: string
      thumbnailUrl?: string
      autoplay?: boolean
    }
  | {
      id: string
      type: "load"
      provider: "spotify"
      uri: string
      contextUri?: string
      offsetUri?: string
      positionMs?: number
      autoplay?: boolean
    }
  | { id: string; type: "play"; provider?: MusicProvider }
  | { id: string; type: "pause"; provider?: MusicProvider }
  | { id: string; type: "next"; provider?: MusicProvider }
  | { id: string; type: "prev"; provider?: MusicProvider }
  | { id: string; type: "playAt"; provider?: MusicProvider; index: number }
  | { id: string; type: "seek"; provider?: MusicProvider; seconds: number }
  | { id: string; type: "volume"; provider?: MusicProvider; value: number }
  | { id: string; type: "stop"; provider?: MusicProvider }

export type MusicCommandInput = MusicCommand extends infer C
  ? C extends { id: string }
    ? Omit<C, "id">
    : never
  : never

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error"
export type MusicProvider = "youtube" | "spotify"

export interface MusicState {
  provider?: MusicProvider
  status: PlayerStatus
  videoId?: string
  uri?: string
  title?: string
  author?: string
  albumArtUrl?: string
  errorMessage?: string
  volume: number
  duration?: number
  currentTime?: number
  hasPlaylist?: boolean
  playlistVideoIds?: string[]
  playlistIndex?: number
}

export const DEFAULT_MUSIC_STATE: MusicState = {
  status: "idle",
  volume: 60,
}

export function isSpotifyLoadCommand(
  cmd: MusicCommand,
): cmd is Extract<MusicCommand, { provider: "spotify"; type: "load" }> {
  return cmd.type === "load" && cmd.provider === "spotify"
}

export function makeCommandId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

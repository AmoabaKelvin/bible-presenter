import type { YouTubePlaylistSummary, YouTubePlaylistTrack } from "@/lib/youtube-account"
import {
  makeSpotifyLoadCommandFromRef,
  type SpotifyLoadOptions,
} from "@/lib/spotify-music"
import type { MusicCommandInput, MusicState } from "@/lib/music-protocol"

export type MusicLoadPlan = {
  musicUrl: string
  optimisticState: MusicState
  command: MusicCommandInput
}

export function makeYouTubePlaylistLoadPlan(
  playlist: YouTubePlaylistSummary,
  currentState: MusicState,
): MusicLoadPlan {
  return {
    musicUrl: playlist.playlistId,
    optimisticState: {
      ...currentState,
      provider: "youtube",
      status: "loading",
      title: playlist.title,
      author: playlist.channelTitle,
      albumArtUrl: playlist.thumbnailUrl,
      uri: undefined,
      videoId: undefined,
      hasPlaylist: true,
      playlistVideoIds: undefined,
      playlistIndex: undefined,
      errorMessage: undefined,
    },
    command: {
      type: "load",
      provider: "youtube",
      playlistId: playlist.playlistId,
      title: playlist.title,
      author: playlist.channelTitle,
      thumbnailUrl: playlist.thumbnailUrl,
      autoplay: true,
    },
  }
}

export function makeYouTubeTrackLoadPlan(
  track: YouTubePlaylistTrack,
  playlist: YouTubePlaylistSummary,
  index: number,
  currentState: MusicState,
): MusicLoadPlan {
  return {
    musicUrl: playlist.playlistId,
    optimisticState: {
      ...currentState,
      provider: "youtube",
      status: "loading",
      title: track.title,
      author: track.author || playlist.channelTitle,
      albumArtUrl: track.thumbnailUrl,
      uri: undefined,
      videoId: track.videoId,
      hasPlaylist: true,
      playlistVideoIds: undefined,
      playlistIndex: index,
      errorMessage: undefined,
    },
    command: {
      type: "load",
      provider: "youtube",
      videoId: track.videoId,
      title: track.title,
      author: track.author || playlist.channelTitle,
      thumbnailUrl: track.thumbnailUrl,
      autoplay: true,
    },
  }
}

export function makeYouTubeVideoLoadPlan(
  track: YouTubePlaylistTrack,
  currentState: MusicState,
): MusicLoadPlan {
  return {
    musicUrl: track.videoId,
    optimisticState: {
      ...currentState,
      provider: "youtube",
      status: "loading",
      title: track.title,
      author: track.author,
      albumArtUrl: track.thumbnailUrl,
      uri: undefined,
      videoId: track.videoId,
      hasPlaylist: false,
      playlistVideoIds: undefined,
      playlistIndex: undefined,
      errorMessage: undefined,
    },
    command: {
      type: "load",
      provider: "youtube",
      videoId: track.videoId,
      autoplay: true,
    },
  }
}

export function makeSpotifyLoadPlan(
  uri: string,
  options: Omit<SpotifyLoadOptions, "uri"> | undefined,
  currentState: MusicState,
): MusicLoadPlan | null {
  const command = makeSpotifyLoadCommandFromRef(uri, options)
  if (!command) return null
  const displayUri = options?.contextUri ?? uri
  return {
    musicUrl: displayUri,
    optimisticState: {
      ...currentState,
      provider: "spotify",
      status: "loading",
      title: undefined,
      author: undefined,
      albumArtUrl: undefined,
      uri: displayUri,
      videoId: undefined,
      hasPlaylist: !!options?.contextUri,
      playlistVideoIds: undefined,
      playlistIndex: undefined,
      errorMessage: undefined,
    },
    command,
  }
}

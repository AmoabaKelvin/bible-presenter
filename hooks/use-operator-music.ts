"use client"

import { useCallback } from "react"
import {
  DEFAULT_MUSIC_STATE,
  MUSIC_COMMAND_KEY,
  makeCommandId,
  type MusicCommand,
  type MusicCommandInput,
} from "@/lib/music-protocol"
import {
  makeSpotifyLoadPlan,
  makeYouTubePlaylistLoadPlan,
  makeYouTubeTrackLoadPlan,
  makeYouTubeVideoLoadPlan,
  type MusicLoadPlan,
} from "@/lib/operator-music-loads"
import type { YouTubePlaylistSummary, YouTubePlaylistTrack } from "@/lib/youtube-account"
import { useMusicAccountStatus } from "@/hooks/use-music-account-status"
import { useOperatorMusicState } from "@/hooks/use-operator-music-state"
import { useSlideshowOnline } from "@/hooks/use-slideshow-online"

interface UseOperatorMusicOptions {
  openOutputWindow: () => void
}

export function useOperatorMusic({ openOutputWindow }: UseOperatorMusicOptions) {
  const { musicUrl, setMusicUrl, musicState, setMusicState, setMusicStateOptimistic } =
    useOperatorMusicState()
  const slideshowOnline = useSlideshowOnline()
  const { spotifyStatus, setSpotifyStatus, youtubeStatus, setYouTubeStatus } =
    useMusicAccountStatus()

  const sendMusicCommand = useCallback((cmd: MusicCommandInput) => {
    const full = { ...cmd, id: makeCommandId() } as MusicCommand
    localStorage.setItem(MUSIC_COMMAND_KEY, JSON.stringify(full))
  }, [])

  const ensureOutput = useCallback(() => {
    if (!slideshowOnline) openOutputWindow()
  }, [openOutputWindow, slideshowOnline])

  const applyLoadPlan = useCallback(
    (plan: MusicLoadPlan) => {
      ensureOutput()
      setMusicUrl(plan.musicUrl)
      setMusicStateOptimistic(plan.optimisticState)
      sendMusicCommand(plan.command)
    },
    [ensureOutput, sendMusicCommand, setMusicStateOptimistic, setMusicUrl],
  )

  const loadYouTubePlaylist = useCallback(
    (playlist: YouTubePlaylistSummary) => {
      applyLoadPlan(makeYouTubePlaylistLoadPlan(playlist, musicState))
    },
    [applyLoadPlan, musicState],
  )

  const loadYouTubeTrack = useCallback(
    (track: YouTubePlaylistTrack, playlist: YouTubePlaylistSummary, index: number) => {
      applyLoadPlan(makeYouTubeTrackLoadPlan(track, playlist, index, musicState))
    },
    [applyLoadPlan, musicState],
  )

  const loadYouTubeVideo = useCallback(
    (track: YouTubePlaylistTrack) => {
      applyLoadPlan(makeYouTubeVideoLoadPlan(track, musicState))
    },
    [applyLoadPlan, musicState],
  )

  const loadSpotify = useCallback(
    (uri: string, options?: { contextUri?: string; offsetUri?: string }) => {
      const plan = makeSpotifyLoadPlan(uri, options, musicState)
      if (plan) applyLoadPlan(plan)
    },
    [applyLoadPlan, musicState],
  )

  const getActiveMusicProvider = useCallback(() => musicState.provider ?? "youtube", [musicState.provider])
  const play = useCallback(
    () => sendMusicCommand({ type: "play", provider: getActiveMusicProvider() }),
    [getActiveMusicProvider, sendMusicCommand],
  )
  const pause = useCallback(
    () => sendMusicCommand({ type: "pause", provider: getActiveMusicProvider() }),
    [getActiveMusicProvider, sendMusicCommand],
  )
  const next = useCallback(
    () => sendMusicCommand({ type: "next", provider: getActiveMusicProvider() }),
    [getActiveMusicProvider, sendMusicCommand],
  )
  const prev = useCallback(
    () => sendMusicCommand({ type: "prev", provider: getActiveMusicProvider() }),
    [getActiveMusicProvider, sendMusicCommand],
  )
  const playAt = useCallback(
    (index: number) =>
      sendMusicCommand({ type: "playAt", provider: getActiveMusicProvider(), index }),
    [getActiveMusicProvider, sendMusicCommand],
  )
  const seek = useCallback(
    (seconds: number) => {
      setMusicState((s) => ({ ...s, currentTime: seconds }))
      sendMusicCommand({ type: "seek", provider: getActiveMusicProvider(), seconds })
    },
    [getActiveMusicProvider, sendMusicCommand, setMusicState],
  )
  const volume = useCallback(
    (value: number) => {
      setMusicState((s) => ({ ...s, volume: value }))
      sendMusicCommand({ type: "volume", provider: getActiveMusicProvider(), value })
    },
    [getActiveMusicProvider, sendMusicCommand, setMusicState],
  )
  const stop = useCallback(() => {
    setMusicUrl(null)
    setMusicState((s) => ({ ...DEFAULT_MUSIC_STATE, volume: s.volume }))
    sendMusicCommand({ type: "stop", provider: getActiveMusicProvider() })
  }, [getActiveMusicProvider, sendMusicCommand, setMusicState, setMusicUrl])

  return {
    musicUrl,
    musicState,
    slideshowOnline,
    spotifyStatus,
    setSpotifyStatus,
    youtubeStatus,
    setYouTubeStatus,
    loadYouTubePlaylist,
    loadYouTubeTrack,
    loadYouTubeVideo,
    loadSpotify,
    play,
    pause,
    next,
    prev,
    playAt,
    seek,
    volume,
    stop,
  }
}

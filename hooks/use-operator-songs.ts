"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Song, SongSlide } from "@/components/operator/types"
import { readPersisted, writePersisted } from "@/lib/persistence"
import {
  deleteSong as deleteSongFromDb,
  getAllSongs,
  putSong,
} from "@/lib/song-store"
import { emptySongSlide, newId } from "@/lib/song-slides"
import { deriveTitle, parseSongLyrics } from "@/lib/song-parse"

const PERSIST_DEBOUNCE_MS = 400

type UseOperatorSongsResult = {
  song: Song | null
  songs: Song[]
  activeSongId: string | null
  newSlideId: string | null
  setTitle: (title: string) => void
  updateSlide: (slideId: string, patch: Partial<Omit<SongSlide, "id">>) => void
  addSlide: (afterSlideId?: string) => void
  deleteSlide: (slideId: string) => void
  moveSlide: (slideId: string, direction: -1 | 1) => void
  createBlankSong: () => void
  createFromPaste: (title: string, lyrics: string) => void
  selectSong: (song: Song) => void
  removeSong: (id: string) => void
}

export function useOperatorSongs(): UseOperatorSongsResult {
  const [loaded, setLoaded] = useState(false)
  const [songs, setSongs] = useState<Song[]>([])
  const [activeSongId, setActiveSongId] = useState<string | null>(null)
  const [newSlideId, setNewSlideId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const all = await getAllSongs()
      if (cancelled) return
      setSongs(all)
      const savedId = readPersisted<string | null>("workspace:songs:activeId")
      if (savedId && all.some((s) => s.id === savedId)) setActiveSongId(savedId)
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const song = useMemo(
    () => songs.find((s) => s.id === activeSongId) ?? null,
    [songs, activeSongId],
  )

  // Persist the open song shortly after it changes; edits only touch it.
  useEffect(() => {
    if (!loaded || !song) return
    const handle = setTimeout(() => void putSong(song), PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [song, loaded])

  useEffect(() => {
    if (!loaded) return
    writePersisted<string | null>("workspace:songs:activeId", activeSongId)
  }, [activeSongId, loaded])

  const editActive = useCallback(
    (updater: (song: Song) => Song) => {
      setSongs((prev) =>
        prev.map((s) => (s.id === activeSongId ? { ...updater(s), updatedAt: Date.now() } : s)),
      )
    },
    [activeSongId],
  )

  const setTitle = useCallback(
    (title: string) => editActive((s) => ({ ...s, title })),
    [editActive],
  )

  const updateSlide = useCallback(
    (slideId: string, patch: Partial<Omit<SongSlide, "id">>) =>
      editActive((s) => ({
        ...s,
        slides: (s.slides ?? []).map((sl) => (sl.id === slideId ? { ...sl, ...patch } : sl)),
      })),
    [editActive],
  )

  const addSlide = useCallback(
    (afterSlideId?: string) => {
      const slide = emptySongSlide()
      setNewSlideId(slide.id)
      editActive((s) => {
        const current = s.slides ?? []
        if (!afterSlideId) return { ...s, slides: [...current, slide] }
        const idx = current.findIndex((sl) => sl.id === afterSlideId)
        const slides = [...current]
        slides.splice(idx + 1, 0, slide)
        return { ...s, slides }
      })
    },
    [editActive],
  )

  const deleteSlide = useCallback(
    (slideId: string) =>
      editActive((s) => {
        const slides = (s.slides ?? []).filter((sl) => sl.id !== slideId)
        return { ...s, slides: slides.length ? slides : [emptySongSlide()] }
      }),
    [editActive],
  )

  const moveSlide = useCallback(
    (slideId: string, direction: -1 | 1) =>
      editActive((s) => {
        const current = s.slides ?? []
        const idx = current.findIndex((sl) => sl.id === slideId)
        const target = idx + direction
        if (idx < 0 || target < 0 || target >= current.length) return s
        const slides = [...current]
        ;[slides[idx], slides[target]] = [slides[target], slides[idx]]
        return { ...s, slides }
      }),
    [editActive],
  )

  const addSong = useCallback((fresh: Song) => {
    setNewSlideId(null)
    void putSong(fresh)
    setSongs((prev) => [fresh, ...prev])
    setActiveSongId(fresh.id)
  }, [])

  const createBlankSong = useCallback(() => {
    const now = Date.now()
    addSong({ id: newId("song"), title: "", slides: [emptySongSlide()], createdAt: now, updatedAt: now })
  }, [addSong])

  const createFromPaste = useCallback(
    (title: string, lyrics: string) => {
      const parsed = parseSongLyrics(lyrics)
      const slides = parsed.length ? parsed : [emptySongSlide()]
      const now = Date.now()
      addSong({
        id: newId("song"),
        title: title.trim() || deriveTitle(slides),
        slides,
        createdAt: now,
        updatedAt: now,
      })
    },
    [addSong],
  )

  const selectSong = useCallback((selected: Song) => {
    setNewSlideId(null)
    setActiveSongId(selected.id)
  }, [])

  const removeSong = useCallback((id: string) => {
    void deleteSongFromDb(id)
    setSongs((prev) => prev.filter((s) => s.id !== id))
    setActiveSongId((current) => (current === id ? null : current))
  }, [])

  return {
    song,
    songs,
    activeSongId,
    newSlideId,
    setTitle,
    updateSlide,
    addSlide,
    deleteSlide,
    moveSlide,
    createBlankSong,
    createFromPaste,
    selectSong,
    removeSong,
  }
}

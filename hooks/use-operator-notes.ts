"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { NoteSlide, SavedNote } from "@/components/operator/types"
import { readLegacyJson, readPersisted, writePersisted } from "@/lib/persistence"
import { emptySlide, newId, normalizeNote } from "@/lib/note-slides"

const NOTES_KEY = "biblePresenterSavedNotes"
const PERSIST_DEBOUNCE_MS = 400

type StoredNote = Partial<SavedNote> & { body?: string }

type UseOperatorNotesResult = {
  note: SavedNote | null
  savedNotes: SavedNote[]
  activeNoteId: string | null
  // The most recently added slide, so the UI can animate it into view.
  newSlideId: string | null
  setDeckTitle: (title: string) => void
  updateSlide: (slideId: string, patch: Partial<Omit<NoteSlide, "id">>) => void
  addSlide: (afterSlideId?: string) => void
  deleteSlide: (slideId: string) => void
  moveSlide: (slideId: string, direction: -1 | 1) => void
  selectNote: (note: SavedNote) => void
  newNote: () => void
  deleteNote: (id: string) => void
}

export function useOperatorNotes(): UseOperatorNotesResult {
  const [loaded, setLoaded] = useState(false)
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [newSlideId, setNewSlideId] = useState<string | null>(null)

  // Load + migrate any persisted notes (legacy single-body notes become
  // single-slide decks).
  useEffect(() => {
    try {
      const stored = readPersisted<StoredNote[]>("notes", {
        legacy: { keys: [NOTES_KEY], read: () => readLegacyJson<StoredNote[]>(NOTES_KEY) },
      })
      const migrated = stored ? stored.map(normalizeNote) : []
      setSavedNotes(migrated)
      const savedId = readPersisted<string | null>("workspace:notes:activeId")
      // Reopen the last-edited deck, or fall back to the most recent one.
      if (savedId && migrated.some((n) => n.id === savedId)) {
        setActiveNoteId(savedId)
      } else if (migrated.length) {
        const recent = [...migrated].sort((a, b) => b.updatedAt - a.updatedAt)[0]
        setActiveNoteId(recent.id)
      }
    } catch {
      // ignore corrupt local state
    }
    setLoaded(true)
  }, [])

  // Debounced persistence of the deck list and the open note.
  useEffect(() => {
    if (!loaded) return
    const handle = setTimeout(() => writePersisted("notes", savedNotes), PERSIST_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [savedNotes, loaded])

  useEffect(() => {
    if (!loaded) return
    writePersisted<string | null>("workspace:notes:activeId", activeNoteId)
  }, [activeNoteId, loaded])

  const note = useMemo(
    () => savedNotes.find((n) => n.id === activeNoteId) ?? null,
    [savedNotes, activeNoteId],
  )

  // Apply an update to the active deck, stamping updatedAt.
  const editActive = useCallback(
    (updater: (note: SavedNote) => SavedNote) => {
      setSavedNotes((prev) =>
        prev.map((n) => (n.id === activeNoteId ? { ...updater(n), updatedAt: Date.now() } : n)),
      )
    },
    [activeNoteId],
  )

  const setDeckTitle = useCallback(
    (title: string) => editActive((n) => ({ ...n, title })),
    [editActive],
  )

  const updateSlide = useCallback(
    (slideId: string, patch: Partial<Omit<NoteSlide, "id">>) =>
      editActive((n) => ({
        ...n,
        slides: (n.slides ?? []).map((s) => (s.id === slideId ? { ...s, ...patch } : s)),
      })),
    [editActive],
  )

  const addSlide = useCallback(
    (afterSlideId?: string) => {
      const slide = emptySlide()
      setNewSlideId(slide.id)
      editActive((n) => {
        const current = n.slides ?? []
        if (!afterSlideId) return { ...n, slides: [...current, slide] }
        const idx = current.findIndex((s) => s.id === afterSlideId)
        const slides = [...current]
        slides.splice(idx + 1, 0, slide)
        return { ...n, slides }
      })
    },
    [editActive],
  )

  const deleteSlide = useCallback(
    (slideId: string) =>
      editActive((n) => {
        const slides = (n.slides ?? []).filter((s) => s.id !== slideId)
        // A deck always keeps at least one slide.
        return { ...n, slides: slides.length ? slides : [emptySlide()] }
      }),
    [editActive],
  )

  const moveSlide = useCallback(
    (slideId: string, direction: -1 | 1) =>
      editActive((n) => {
        const current = n.slides ?? []
        const idx = current.findIndex((s) => s.id === slideId)
        const target = idx + direction
        if (idx < 0 || target < 0 || target >= current.length) return n
        const slides = [...current]
        ;[slides[idx], slides[target]] = [slides[target], slides[idx]]
        return { ...n, slides }
      }),
    [editActive],
  )

  const selectNote = useCallback((selected: SavedNote) => {
    setNewSlideId(null)
    setActiveNoteId(selected.id)
  }, [])

  const newNote = useCallback(() => {
    const now = Date.now()
    const fresh: SavedNote = {
      id: newId("note"),
      title: "",
      slides: [emptySlide()],
      createdAt: now,
      updatedAt: now,
    }
    setSavedNotes((prev) => [fresh, ...prev])
    setActiveNoteId(fresh.id)
  }, [])

  const deleteNote = useCallback(
    (id: string) => {
      setSavedNotes((prev) => prev.filter((n) => n.id !== id))
      setActiveNoteId((current) => (current === id ? null : current))
    },
    [],
  )

  return {
    note,
    savedNotes,
    activeNoteId,
    newSlideId,
    setDeckTitle,
    updateSlide,
    addSlide,
    deleteSlide,
    moveSlide,
    selectNote,
    newNote,
    deleteNote,
  }
}

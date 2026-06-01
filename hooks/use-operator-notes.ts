"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SelectedVerse } from "@/components/slide-stage"
import type { SavedNote } from "@/components/operator/types"
import { readLegacyJson, readPersisted, writePersisted } from "@/lib/persistence"

const NOTES_KEY = "biblePresenterSavedNotes"

type NotesWorkspace = {
  activeNoteId: string | null
  draftTitle: string
  draftBody: string
}

type UseOperatorNotesResult = {
  noteTitle: string
  setNoteTitle: (title: string) => void
  noteText: string
  setNoteText: (text: string) => void
  savedNotes: SavedNote[]
  activeNoteId: string | null
  composeNoteVerse: () => SelectedVerse | null
  selectNote: (note: SavedNote) => void
  newNote: () => void
  deleteNote: (id: string) => void
}

export function useOperatorNotes(): UseOperatorNotesResult {
  const [loaded, setLoaded] = useState(false)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteText, setNoteText] = useState("")
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const activeNoteIdRef = useRef<string | null>(null)
  const savedNotesRef = useRef<SavedNote[]>([])

  useEffect(() => {
    try {
      const sn = readPersisted<SavedNote[]>("notes", {
        legacy: { keys: [NOTES_KEY], read: () => readLegacyJson<SavedNote[]>(NOTES_KEY) },
      })
      if (sn) setSavedNotes(sn)
      const workspace = readPersisted<NotesWorkspace>("workspace:notes")
      if (workspace) {
        activeNoteIdRef.current = workspace.activeNoteId
        setActiveNoteId(workspace.activeNoteId)
        setNoteTitle(workspace.draftTitle)
        setNoteText(workspace.draftBody)
      }
    } catch {
      // ignore corrupt local state
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    savedNotesRef.current = savedNotes
    if (loaded) writePersisted("notes", savedNotes)
  }, [savedNotes, loaded])

  useEffect(() => {
    if (!loaded) return
    const handle = setTimeout(() => {
      writePersisted<NotesWorkspace>("workspace:notes", {
        activeNoteId,
        draftTitle: noteTitle,
        draftBody: noteText,
      })
    }, 400)
    return () => clearTimeout(handle)
  }, [activeNoteId, loaded, noteText, noteTitle])

  const composeNoteVerse = useCallback((): SelectedVerse | null => {
    if (!noteTitle.trim() && !noteText.trim()) return null
    return {
      kind: "note",
      id: `note-${Date.now()}`,
      book: "",
      chapter: 0,
      verse: 0,
      text: noteText.trim(),
      reference: noteTitle.trim(),
    }
  }, [noteTitle, noteText])

  const persistCurrentEditor = useCallback((): string | null => {
    const title = noteTitle.trim()
    const body = noteText.trim()
    if (!title && !body) return null
    const now = Date.now()
    const currentId = activeNoteIdRef.current
    if (currentId) {
      const existing = savedNotesRef.current.find((n) => n.id === currentId)
      if (existing && existing.title === noteTitle && existing.body === noteText) {
        return currentId
      }
      setSavedNotes((prev) =>
        prev.map((n) =>
          n.id === currentId ? { ...n, title: noteTitle, body: noteText, updatedAt: now } : n,
        ),
      )
      return currentId
    }
    const id = `note-${now}-${Math.random().toString(36).slice(2, 7)}`
    activeNoteIdRef.current = id
    setActiveNoteId(id)
    setSavedNotes((prev) => [
      { id, title: noteTitle, body: noteText, createdAt: now, updatedAt: now },
      ...prev,
    ])
    return id
  }, [noteTitle, noteText])

  useEffect(() => {
    if (!loaded) return
    if (!noteTitle.trim() && !noteText.trim()) return
    const currentId = activeNoteIdRef.current
    const active = currentId ? savedNotes.find((n) => n.id === currentId) : undefined
    if (active && active.title === noteTitle && active.body === noteText) return
    const handle = setTimeout(() => persistCurrentEditor(), 600)
    return () => clearTimeout(handle)
  }, [noteTitle, noteText, loaded, savedNotes, persistCurrentEditor])

  const selectNote = useCallback(
    (note: SavedNote) => {
      if (note.id === activeNoteIdRef.current) return
      persistCurrentEditor()
      activeNoteIdRef.current = note.id
      setActiveNoteId(note.id)
      setNoteTitle(note.title)
      setNoteText(note.body)
    },
    [persistCurrentEditor],
  )

  const newNote = useCallback(() => {
    persistCurrentEditor()
    activeNoteIdRef.current = null
    setActiveNoteId(null)
    setNoteTitle("")
    setNoteText("")
  }, [persistCurrentEditor])

  const deleteNote = useCallback((id: string) => {
    setSavedNotes((prev) => prev.filter((n) => n.id !== id))
    if (id === activeNoteIdRef.current) {
      activeNoteIdRef.current = null
      setActiveNoteId(null)
      setNoteTitle("")
      setNoteText("")
    }
  }, [])

  return {
    noteTitle,
    setNoteTitle,
    noteText,
    setNoteText,
    savedNotes,
    activeNoteId,
    composeNoteVerse,
    selectNote,
    newNote,
    deleteNote,
  }
}

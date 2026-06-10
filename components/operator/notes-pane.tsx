"use client"

import { useState } from "react"
import { Plus, ListPlus, PencilLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotesList } from "./notes-list"
import { NoteSlideCard } from "./note-slide-card"
import type { Folder, NoteSlide, SavedNote } from "./types"
import type { SelectedVerse } from "@/components/slide-stage"
import { noteSlideToVerse, slideHasContent } from "@/lib/note-slides"

interface NotesPaneProps {
  note: SavedNote | null
  savedNotes: SavedNote[]
  activeNoteId: string | null
  newSlideId: string | null
  folders: Folder[]
  liveVerses: SelectedVerse[]
  onDeckTitleChange: (title: string) => void
  onSlideChange: (slideId: string, patch: Partial<Pick<NoteSlide, "title" | "body">>) => void
  onAddSlide: () => void
  onDeleteSlide: (slideId: string) => void
  onMoveSlide: (slideId: string, direction: -1 | 1) => void
  onSelectNote: (note: SavedNote) => void
  onNewNote: () => void
  onDeleteNote: (id: string) => void
  onCreateFolder: (name: string) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  onMoveNoteToFolder: (noteId: string, folderId: string | null) => void
  previewSlide: (verse: SelectedVerse) => void
  projectSlide: (verse: SelectedVerse) => void
  addToQueue: (verses: SelectedVerse[]) => void
}

export function NotesPane({
  note,
  savedNotes,
  activeNoteId,
  newSlideId,
  folders,
  liveVerses,
  onDeckTitleChange,
  onSlideChange,
  onAddSlide,
  onDeleteSlide,
  onMoveSlide,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveNoteToFolder,
  previewSlide,
  projectSlide,
  addToQueue,
}: NotesPaneProps) {
  const slides = note?.slides ?? []
  // The format bar shows only for the slide currently being edited.
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null)
  // Mark the card whose content matches what's currently on the live output.
  const liveTexts = new Set(
    liveVerses.filter((v) => v.kind === "note").map((v) => v.text),
  )

  const queueAll = () => {
    const verses = slides.filter(slideHasContent).map(noteSlideToVerse)
    if (verses.length) addToQueue(verses)
  }

  return (
    <div className="h-full flex">
      <NotesList
        notes={savedNotes}
        folders={folders}
        activeNoteId={activeNoteId}
        onSelectNote={onSelectNote}
        onNewNote={onNewNote}
        onDeleteNote={onDeleteNote}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        onMoveNoteToFolder={onMoveNoteToFolder}
      />

      {!note ? (
        <div className="flex-1 grid place-items-center">
          <div className="text-center">
            <div className="size-10 rounded-full bg-accent grid place-items-center mx-auto mb-4">
              <PencilLine className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Build a deck of slides to project — sermon points, announcements, a call to worship.
            </p>
            <Button onClick={onNewNote} size="sm">
              <Plus className="size-3.5 mr-1.5" />
              New slide deck
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
          <div className="h-14 shrink-0 px-6 border-b border-border flex items-center gap-3">
            <input
              value={note.title}
              onChange={(e) => onDeckTitleChange(e.target.value)}
              placeholder="Untitled deck"
              className="flex-1 bg-transparent border-0 outline-none text-[20px] font-semibold tracking-tight placeholder:text-muted-foreground/35"
            />
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {slides.length} {slides.length === 1 ? "slide" : "slides"}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
            <div className="mx-auto w-full max-w-[760px] px-8 py-6 space-y-3">
              {slides.map((slide, i) => (
                <NoteSlideCard
                  key={slide.id}
                  slide={slide}
                  index={i}
                  total={slides.length}
                  isNew={slide.id === newSlideId}
                  isActive={slide.id === activeSlideId}
                  isLive={slide.body.trim() !== "" && liveTexts.has(slide.body.trim())}
                  onActivate={() => setActiveSlideId(slide.id)}
                  onChange={(patch) => onSlideChange(slide.id, patch)}
                  onPreview={() => previewSlide(noteSlideToVerse(slide))}
                  onProject={() => projectSlide(noteSlideToVerse(slide))}
                  onQueue={() => addToQueue([noteSlideToVerse(slide)])}
                  onDelete={() => onDeleteSlide(slide.id)}
                  onMoveUp={() => onMoveSlide(slide.id, -1)}
                  onMoveDown={() => onMoveSlide(slide.id, 1)}
                />
              ))}

              <button
                type="button"
                onClick={() => onAddSlide()}
                className="w-full h-10 grid place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-accent/40 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Plus className="size-4" />
                  Add slide
                </span>
              </button>
            </div>
          </div>

          <div className="shrink-0 border-t border-border px-6 py-2.5 flex items-center justify-end gap-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={queueAll}>
              <ListPlus className="size-3.5 mr-1.5" />
              Queue all slides
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

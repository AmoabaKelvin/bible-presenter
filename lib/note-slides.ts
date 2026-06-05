// Helpers for the note-deck model: id generation, slide creation, conversion
// of a note slide into a projectable SelectedVerse, and migration of any
// persisted note (including the legacy single-body shape) into a deck.

import type { NoteSlide, SavedNote } from "@/components/operator/types"
import type { SelectedVerse } from "@/components/slide-stage"

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function emptySlide(): NoteSlide {
  return { id: newId("slide"), title: "", body: "" }
}

// A slide is presentable if it has any title or body content.
export function slideHasContent(slide: NoteSlide): boolean {
  return slide.title.trim() !== "" || slide.body.trim() !== ""
}

// Project a single note slide: its optional title becomes the reference line,
// its body the slide text. A fresh id keeps queue/history entries distinct.
export function noteSlideToVerse(slide: NoteSlide): SelectedVerse {
  return {
    kind: "note",
    id: newId("note"),
    book: "",
    chapter: 0,
    verse: 0,
    text: slide.body.trim(),
    reference: slide.title.trim(),
  }
}

// Accepts either the deck shape or the legacy { title, body } note and always
// returns a deck. Legacy notes become a single-slide deck.
type StoredNote = Partial<SavedNote> & { body?: string }

export function normalizeNote(raw: StoredNote): SavedNote {
  const now = Date.now()
  const base = {
    id: raw.id ?? newId("note"),
    title: raw.title ?? "",
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  }
  if (Array.isArray(raw.slides)) {
    return {
      ...base,
      slides: raw.slides.map((s) => ({
        id: s.id ?? newId("slide"),
        title: s.title ?? "",
        body: s.body ?? "",
      })),
    }
  }
  return { ...base, slides: [{ id: newId("slide"), title: "", body: raw.body ?? "" }] }
}

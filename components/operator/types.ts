import type { SelectedVerse, FontSize, SlideKind } from "@/components/slide-stage"
import type { PresentationSettings } from "@/lib/presentation-settings"

export type Mode = "bible" | "notes" | "songs" | "media" | "dictionary"

export interface HistoryItem {
  id: string
  kind?: SlideKind
  reference: string
  text: string
  timestamp: number
  version?: string
}

export interface MediaItem {
  id: string
  name: string
  imageId?: string // IndexedDB key (new); dataUrl kept for legacy items
  thumbnailId?: string // Small IndexedDB image for the media grid
  dataUrl?: string
  createdAt: number
}

// One slide within a note. Title is optional (projected as the reference
// line); body is Markdown authored through the WYSIWYG editor.
export interface NoteSlide {
  id: string
  title: string
  body: string
}

// A note is a small deck of slides. `title` names the deck in the sidebar and
// is not projected.
export interface SavedNote {
  id: string
  title: string
  slides: NoteSlide[]
  createdAt: number
  updatedAt: number
}

// One projected lyric slide (a blank-line block from the pasted lyrics).
// `label` is an operator-only hint ("Verse 1", "Chorus") and is never projected.
export interface SongSlide {
  id: string
  label: string
  lines: string[]
}

// A song is an ordered list of lyric slides; the pasted order is the
// performance order (no separate arrangement in the MVP).
export interface Song {
  id: string
  title: string
  slides: SongSlide[]
  createdAt: number
  updatedAt: number
}

export interface VerseData {
  verses: SelectedVerse[]
  fontSize: FontSize
  darkMode: boolean
  version: string
  backgroundColor?: string
  backgroundImage?: string
  // Image references are IndexedDB ids; each tab resolves them locally.
  mediaId?: string
  // Slide style; the projector reads this from durable persistence (see
  // `use-slideshow-projection`) rather than the projection payload, so style
  // tweaks reflow a live slide without re-projecting.
  presentation?: PresentationSettings
}

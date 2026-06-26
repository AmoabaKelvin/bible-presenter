import type { SelectedVerse, FontSize, SlideKind } from "@/components/slide-stage"
import type { PresentationSettings } from "@/lib/presentation-settings"
import type { BackgroundConfig } from "@/lib/background-config"

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
  // Discriminates how the tile renders and whether the item can be projected.
  // Legacy items (uploaded before videos were supported) load as "image".
  kind: "image" | "video"
  imageId?: string // IndexedDB key (new); dataUrl kept for legacy items
  // Videos store only a File System Access handle id (no bytes copied) plus a
  // captured `thumbnailId` poster; they have no `imageId`/`dataUrl`.
  handleId?: string
  thumbnailId?: string // Small IndexedDB image for the media grid
  dataUrl?: string
  createdAt: number
  // Files the item under a media `Folder`; absent/unknown id means "Unfiled".
  folderId?: string
}

// One slide within a note. Title is optional (projected as the reference
// line); body is Markdown authored through the WYSIWYG editor.
export interface NoteSlide {
  id: string
  title: string
  body: string
}

// A one-level folder for grouping notes in the sidebar. Notes reference a
// folder by id; an absent/unknown id means the note is "Unfiled".
export interface Folder {
  id: string
  name: string
  createdAt: number
}

// A note is a small deck of slides. `title` names the deck in the sidebar and
// is not projected. `folderId` optionally files the note under a `Folder`;
// when absent or pointing at a deleted folder the note is treated as Unfiled.
export interface SavedNote {
  id: string
  title: string
  slides: NoteSlide[]
  createdAt: number
  updatedAt: number
  folderId?: string
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

// A "show" is a saved snapshot the operator can return to exactly. It captures
// the queue + cursor, the live scripture, the full background config, the look
// settings, and the bible version. It deliberately does NOT capture the media
// library, notes, or songs — those stay global/shared.
export interface ShowSnapshot {
  queue: SelectedVerse[]
  queueCursor: number
  liveVerses: SelectedVerse[]
  version: string
  presentation: PresentationSettings
  background: BackgroundConfig
}

// A named, persisted entry in the local show library. `snapshot` references
// background imageIds (not embedded blobs); export embeds those bytes.
export interface SavedShow {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  snapshot: ShowSnapshot
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

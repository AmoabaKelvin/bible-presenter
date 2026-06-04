import type { SelectedVerse, FontSize, SlideKind } from "@/components/slide-stage"
import type { PresentationSettings } from "@/lib/presentation-settings"

export type Mode = "bible" | "notes" | "media" | "dictionary"

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

export interface SavedNote {
  id: string
  title: string
  body: string
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

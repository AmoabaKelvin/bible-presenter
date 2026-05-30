import type { SelectedVerse, FontSize } from "@/components/slide-stage"

export type Mode = "bible" | "notes" | "media" | "dictionary"

export interface HistoryItem {
  id: string
  reference: string
  text: string
  timestamp: number
  version?: string
}

export interface MediaItem {
  id: string
  name: string
  imageId?: string // IndexedDB key (new); dataUrl kept for legacy items
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
}

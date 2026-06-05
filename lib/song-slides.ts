// Helpers for songs: id generation, empty slides, and conversion of a song's
// lyric slides into projectable SelectedVerses (kind "song").

import type { Song, SongSlide } from "@/components/operator/types"
import type { SelectedVerse } from "@/components/slide-stage"

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function emptySongSlide(): SongSlide {
  return { id: newId("ss"), label: "", lines: [] }
}

export function songSlideHasContent(slide: SongSlide): boolean {
  return slide.lines.some((line) => line.trim() !== "")
}

// The lyric lines become the slide text; the song title rides along as the
// reference for operator-facing lists (queue/history) but is not shown on the
// projected slide.
export function songSlideToVerse(slide: SongSlide, title: string): SelectedVerse {
  return {
    kind: "song",
    id: newId("song"),
    book: "",
    chapter: 0,
    verse: 0,
    text: slide.lines.join("\n"),
    reference: title,
  }
}

export function songToVerses(song: Song): SelectedVerse[] {
  return song.slides
    .filter(songSlideHasContent)
    .map((slide) => songSlideToVerse(slide, song.title))
}

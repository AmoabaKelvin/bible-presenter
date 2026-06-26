"use client"

import { useCallback, type Dispatch, type SetStateAction } from "react"
import type { SelectedVerse } from "@/components/slide-stage"
import type { BibleBook } from "@/lib/bible-data"
import { parseReference, type ScriptureSearchResult } from "@/lib/scripture-search"
import { scriptureSlideFromSearchResult } from "@/lib/scripture-slides"

type MediaSlide = { id: string; url: string; kind: "image" | "video" } | null

type UseBibleSearchActionsOptions = {
  version: string
  setPreviewVerses: Dispatch<SetStateAction<SelectedVerse[]>>
  setPreviewMedia: Dispatch<SetStateAction<MediaSlide>>
  projectVerses: (verses: SelectedVerse[], syncPreview: boolean) => void
  addToQueue: (verses: SelectedVerse[]) => void
  handleReferenceChange: (
    book: BibleBook | null,
    chapter: number | null,
    verse?: number,
  ) => void
}

export function useBibleSearchActions({
  version,
  setPreviewVerses,
  setPreviewMedia,
  projectVerses,
  addToQueue,
  handleReferenceChange,
}: UseBibleSearchActionsOptions) {
  const verseFromSearchResult = useCallback(
    (result: ScriptureSearchResult): SelectedVerse => {
      return scriptureSlideFromSearchResult(result, version)
    },
    [version],
  )

  const previewSearchResult = useCallback(
    (result: ScriptureSearchResult) => {
      setPreviewMedia(null)
      setPreviewVerses([verseFromSearchResult(result)])
    },
    [setPreviewMedia, setPreviewVerses, verseFromSearchResult],
  )

  const projectSearchResult = useCallback(
    (result: ScriptureSearchResult) => {
      const verse = verseFromSearchResult(result)
      projectVerses([verse], true)
      const parsed = parseReference(result.reference)
      if (parsed) handleReferenceChange(parsed.book, parsed.chapter, parsed.verse)
    },
    [handleReferenceChange, projectVerses, verseFromSearchResult],
  )

  const queueSearchResult = useCallback(
    (result: ScriptureSearchResult) => {
      addToQueue([verseFromSearchResult(result)])
    },
    [addToQueue, verseFromSearchResult],
  )

  return { previewSearchResult, projectSearchResult, queueSearchResult }
}

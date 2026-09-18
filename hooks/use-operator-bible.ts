"use client"

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"
import type { SelectedVerse } from "@/components/slide-stage"
import type { ChapterVerse } from "@/components/operator/chapter-reader"
import type { BibleBook } from "@/lib/bible-data"
import { parseReference, type ScriptureSearchResult } from "@/lib/scripture-search"
import { useBibleChapter } from "@/hooks/use-bible-chapter"
import { useBibleNavigation } from "@/hooks/use-bible-navigation"
import { useBibleSearchActions } from "@/hooks/use-bible-search-actions"
import { useBibleVerseActions } from "@/hooks/use-bible-verse-actions"

type MediaSlide = { id: string; url: string; kind: "image" | "video" } | null

type UseOperatorBibleOptions = {
  version: string
  setPreviewVerses: Dispatch<SetStateAction<SelectedVerse[]>>
  setLiveVerses: Dispatch<SetStateAction<SelectedVerse[]>>
  setPreviewMedia: Dispatch<SetStateAction<MediaSlide>>
  setLiveMedia: Dispatch<SetStateAction<MediaSlide>>
  writeToOutput: (payload: { verses?: SelectedVerse[]; mediaId?: string | null }) => void
  addToHistory: (
    text: string,
    reference: string,
    itemVersion?: string,
    kind?: SelectedVerse["kind"],
  ) => void
  addToQueue: (verses: SelectedVerse[]) => void
}

type UseOperatorBibleResult = {
  selectedBook: BibleBook | null
  selectedChapter: number | null
  selectedVerse: number | null
  rangeStartVerse: number | null
  rangeEndVerse: number | null
  chapterVerses: ChapterVerse[]
  chapterLoading: boolean
  chapterError: string | null
  handleReferenceChange: (
    book: BibleBook | null,
    chapter: number | null,
    verse?: number,
  ) => void
  handleJumpSelect: (book: BibleBook, chapter: number, verse: number) => void
  handleJumpProject: (book: BibleBook, chapter: number, verse: number) => void
  goToReference: (reference: string) => void
  handleSelectVerse: (verse: number, shiftKey: boolean) => void
  handleDoubleClickVerse: (verse: number) => void
  stepSelectedVerse: (delta: number, project?: boolean) => void
  goToPreviousChapter: () => void
  goToNextChapter: () => void
  queueVerseFromChapter: (verseNumber: number) => void
  previewSearchResult: (result: ScriptureSearchResult) => void
  projectSearchResult: (result: ScriptureSearchResult) => void
  queueSearchResult: (result: ScriptureSearchResult) => void
}

export function useOperatorBible({
  version,
  setPreviewVerses,
  setLiveVerses,
  setPreviewMedia,
  setLiveMedia,
  writeToOutput,
  addToHistory,
  addToQueue,
}: UseOperatorBibleOptions): UseOperatorBibleResult {
  const [versionForChapter, setVersionForChapter] = useState(version)
  const [selectedBookForChapter, setSelectedBookForChapter] = useState<BibleBook | null>(null)
  const [selectedChapterForChapter, setSelectedChapterForChapter] = useState<number | null>(null)
  const { chapterVerses: loadedVerses, chapterLoading, chapterError } = useBibleChapter({
    version: versionForChapter,
    selectedBook: selectedBookForChapter,
    selectedChapter: selectedChapterForChapter,
  })
  const {
    chapterVerses,
    selectedBook,
    selectedChapter,
    selectedVerse,
    setSelectedVerse,
    rangeStartVerse,
    setRangeStartVerse,
    rangeEndVerse,
    setRangeEndVerse,
    pendingProjectVerse,
    setPendingProjectVerse,
    buildSelectedVerses,
    handleReferenceChange: handleNavigationReferenceChange,
    handleJumpSelect,
    handleJumpProject,
    goToPreviousChapter,
    goToNextChapter,
  } = useBibleNavigation({
    version,
    chapterVerses: loadedVerses,
    loadedVersion: versionForChapter,
    loadedBook: selectedBookForChapter,
    loadedChapter: selectedChapterForChapter,
    setPreviewVerses,
  })

  useEffect(() => {
    setVersionForChapter(version)
    setSelectedBookForChapter(selectedBook)
    setSelectedChapterForChapter(selectedChapter)
  }, [version, selectedBook, selectedChapter])

  const handleReferenceChange = handleNavigationReferenceChange

  // Drive the bible reader to a reference string (e.g. "John 3:16"), the same
  // end state as typing it into the scripture search box. A range opens at its
  // first verse; unparseable refs are no-ops.
  const goToReference = useCallback(
    (reference: string) => {
      const parsed = parseReference(reference)
      if (parsed) handleReferenceChange(parsed.book, parsed.chapter, parsed.verse)
    },
    [handleReferenceChange],
  )

  const projectVerses = useCallback(
    (verses: SelectedVerse[], syncPreview: boolean) => {
      if (verses.length === 0) return
      setPreviewMedia(null)
      setLiveMedia(null)
      if (syncPreview) setPreviewVerses(verses)
      setLiveVerses(verses)
      writeToOutput({ verses })
      verses.forEach((v) => addToHistory(v.text, v.reference, v.version, v.kind))
    },
    [
      addToHistory,
      setLiveMedia,
      setLiveVerses,
      setPreviewMedia,
      setPreviewVerses,
      writeToOutput,
    ],
  )

  const {
    handleSelectVerse,
    stepSelectedVerse,
    handleDoubleClickVerse,
    queueVerseFromChapter,
  } = useBibleVerseActions({
    selectedBook,
    selectedChapter,
    selectedVerse,
    rangeStartVerse,
    rangeEndVerse,
    pendingProjectVerse,
    chapterVerses,
    buildSelectedVerses,
    projectVerses,
    addToQueue,
    setPreviewVerses,
    setSelectedVerse,
    setRangeStartVerse,
    setRangeEndVerse,
    setPendingProjectVerse,
    handleJumpSelect,
    handleJumpProject,
  })

  const { previewSearchResult, projectSearchResult, queueSearchResult } = useBibleSearchActions({
    version,
    setPreviewVerses,
    setPreviewMedia,
    projectVerses,
    addToQueue,
    handleReferenceChange,
  })

  return {
    selectedBook,
    selectedChapter,
    selectedVerse,
    rangeStartVerse,
    rangeEndVerse,
    chapterVerses,
    chapterLoading,
    chapterError,
    handleReferenceChange,
    handleJumpSelect,
    handleJumpProject,
    goToReference,
    handleSelectVerse,
    handleDoubleClickVerse,
    stepSelectedVerse,
    goToPreviousChapter,
    goToNextChapter,
    queueVerseFromChapter,
    previewSearchResult,
    projectSearchResult,
    queueSearchResult,
  }
}

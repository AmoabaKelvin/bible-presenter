"use client"

import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react"
import type { SelectedVerse } from "@/components/slide-stage"
import type { ChapterVerse } from "@/components/operator/chapter-reader"
import type { BibleBook } from "@/lib/bible-data"

type PendingProjectVerse = { book: BibleBook; chapter: number; verse: number } | null

type UseBibleVerseActionsOptions = {
  selectedBook: BibleBook | null
  selectedChapter: number | null
  selectedVerse: number | null
  rangeStartVerse: number | null
  rangeEndVerse: number | null
  pendingProjectVerse: PendingProjectVerse
  chapterVerses: ChapterVerse[]
  buildSelectedVerses: (start: number, end: number) => SelectedVerse[]
  projectVerses: (verses: SelectedVerse[], syncPreview: boolean) => void
  addToQueue: (verses: SelectedVerse[]) => void
  setPreviewVerses: Dispatch<SetStateAction<SelectedVerse[]>>
  setSelectedVerse: Dispatch<SetStateAction<number | null>>
  setRangeStartVerse: Dispatch<SetStateAction<number | null>>
  setRangeEndVerse: Dispatch<SetStateAction<number | null>>
  setPendingProjectVerse: Dispatch<SetStateAction<PendingProjectVerse>>
}

export function useBibleVerseActions({
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
}: UseBibleVerseActionsOptions) {
  const handleSelectVerse = useCallback(
    (verse: number, shiftKey: boolean) => {
      if (!selectedBook || !selectedChapter) return
      if (shiftKey && rangeStartVerse !== null) {
        const start = Math.min(rangeStartVerse, verse)
        const end = Math.max(rangeStartVerse, verse)
        setRangeStartVerse(start)
        setRangeEndVerse(end)
        setSelectedVerse(verse)
        setPreviewVerses(buildSelectedVerses(start, end))
        return
      }
      setSelectedVerse(verse)
      setRangeStartVerse(verse)
      setRangeEndVerse(null)
      setPreviewVerses(buildSelectedVerses(verse, verse))
    },
    [
      buildSelectedVerses,
      rangeStartVerse,
      selectedBook,
      selectedChapter,
      setPreviewVerses,
      setRangeEndVerse,
      setRangeStartVerse,
      setSelectedVerse,
    ],
  )

  const stepSelectedVerse = useCallback(
    (delta: number) => {
      if (!selectedBook || !selectedChapter || selectedVerse === null) return
      const verseCount = selectedBook.chapters[selectedChapter - 1]
      if (!verseCount) return
      const target = Math.min(Math.max(selectedVerse + delta, 1), verseCount)
      if (target === selectedVerse) return
      setSelectedVerse(target)
      setRangeStartVerse(target)
      setRangeEndVerse(null)
      setPreviewVerses(buildSelectedVerses(target, target))
    },
    [
      buildSelectedVerses,
      selectedBook,
      selectedChapter,
      selectedVerse,
      setPreviewVerses,
      setRangeEndVerse,
      setRangeStartVerse,
      setSelectedVerse,
    ],
  )

  const handleDoubleClickVerse = useCallback(
    (verse: number) => {
      if (!selectedBook || !selectedChapter) return
      if (
        rangeStartVerse !== null &&
        rangeEndVerse !== null &&
        verse >= rangeStartVerse &&
        verse <= rangeEndVerse
      ) {
        projectVerses(buildSelectedVerses(rangeStartVerse, rangeEndVerse), false)
        return
      }
      const list = buildSelectedVerses(verse, verse)
      if (list.length === 0) return
      setSelectedVerse(verse)
      setRangeStartVerse(verse)
      setRangeEndVerse(null)
      projectVerses(list, true)
    },
    [
      buildSelectedVerses,
      projectVerses,
      rangeEndVerse,
      rangeStartVerse,
      selectedBook,
      selectedChapter,
      setRangeEndVerse,
      setRangeStartVerse,
      setSelectedVerse,
    ],
  )

  useEffect(() => {
    if (!pendingProjectVerse) return
    if (chapterVerses.length === 0) return
    if (
      !selectedBook ||
      selectedBook.name !== pendingProjectVerse.book.name ||
      selectedChapter !== pendingProjectVerse.chapter
    ) {
      return
    }
    const { verse } = pendingProjectVerse
    const list = buildSelectedVerses(verse, verse)
    if (list.length === 0) return
    setSelectedVerse(verse)
    setRangeStartVerse(verse)
    setRangeEndVerse(null)
    projectVerses(list, true)
    setPendingProjectVerse(null)
  }, [
    buildSelectedVerses,
    chapterVerses.length,
    pendingProjectVerse,
    projectVerses,
    selectedBook,
    selectedChapter,
    setPendingProjectVerse,
    setRangeEndVerse,
    setRangeStartVerse,
    setSelectedVerse,
  ])

  const queueVerseFromChapter = useCallback(
    (verseNumber: number) => {
      const list = buildSelectedVerses(verseNumber, verseNumber)
      if (list.length === 0) return
      addToQueue(list)
    },
    [addToQueue, buildSelectedVerses],
  )

  return {
    handleSelectVerse,
    stepSelectedVerse,
    handleDoubleClickVerse,
    queueVerseFromChapter,
  }
}

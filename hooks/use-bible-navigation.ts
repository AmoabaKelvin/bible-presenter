"use client"

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"
import type { SelectedVerse } from "@/components/slide-stage"
import type { ChapterVerse } from "@/components/operator/chapter-reader"
import type { BibleBook } from "@/lib/bible-data"
import { getNextChapterRef, getPrevChapterRef } from "@/lib/bible-data"
import { buildScriptureSlides } from "@/lib/scripture-slides"

type PendingProjectVerse = { book: BibleBook; chapter: number; verse: number } | null

type UseBibleNavigationOptions = {
  version: string
  chapterVerses: ChapterVerse[]
  setPreviewVerses: Dispatch<SetStateAction<SelectedVerse[]>>
}

export function useBibleNavigation({
  version,
  chapterVerses,
  setPreviewVerses,
}: UseBibleNavigationOptions) {
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null)
  const [rangeStartVerse, setRangeStartVerse] = useState<number | null>(null)
  const [rangeEndVerse, setRangeEndVerse] = useState<number | null>(null)
  const [pendingVerseSelection, setPendingVerseSelection] = useState<number | null>(null)
  const [pendingProjectVerse, setPendingProjectVerse] = useState<PendingProjectVerse>(null)

  const buildSelectedVerses = useCallback(
    (start: number, end: number): SelectedVerse[] => {
      return buildScriptureSlides({
        book: selectedBook,
        chapter: selectedChapter,
        verses: chapterVerses,
        version,
        start,
        end,
      })
    },
    [chapterVerses, selectedBook, selectedChapter, version],
  )

  const handleReferenceChange = useCallback(
    (book: BibleBook | null, chapter: number | null, verse?: number) => {
      setSelectedBook(book ?? null)
      setSelectedChapter(chapter ?? null)
      setSelectedVerse(null)
      setRangeStartVerse(null)
      setRangeEndVerse(null)
      setPendingVerseSelection(verse ?? null)
    },
    [],
  )

  useEffect(() => {
    if (pendingVerseSelection === null) return
    if (chapterVerses.length === 0) return
    if (!selectedBook || !selectedChapter) return
    setSelectedVerse(pendingVerseSelection)
    setRangeStartVerse(pendingVerseSelection)
    setRangeEndVerse(null)
    setPreviewVerses(buildSelectedVerses(pendingVerseSelection, pendingVerseSelection))
    setPendingVerseSelection(null)
  }, [
    buildSelectedVerses,
    chapterVerses.length,
    pendingVerseSelection,
    selectedBook,
    selectedChapter,
    setPreviewVerses,
  ])

  const handleJumpSelect = useCallback(
    (book: BibleBook, chapter: number, verse: number) => {
      handleReferenceChange(book, chapter, verse)
    },
    [handleReferenceChange],
  )

  const handleJumpProject = useCallback(
    (book: BibleBook, chapter: number, verse: number) => {
      handleReferenceChange(book, chapter)
      setPendingProjectVerse({ book, chapter, verse })
    },
    [handleReferenceChange],
  )

  const goToPreviousChapter = useCallback(() => {
    if (!selectedBook || !selectedChapter) return
    const prev = getPrevChapterRef(selectedBook, selectedChapter)
    if (prev) handleReferenceChange(prev.book, prev.chapter)
  }, [handleReferenceChange, selectedBook, selectedChapter])

  const goToNextChapter = useCallback(() => {
    if (!selectedBook || !selectedChapter) return
    const next = getNextChapterRef(selectedBook, selectedChapter)
    if (next) handleReferenceChange(next.book, next.chapter)
  }, [handleReferenceChange, selectedBook, selectedChapter])

  return {
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
    handleReferenceChange,
    handleJumpSelect,
    handleJumpProject,
    goToPreviousChapter,
    goToNextChapter,
  }
}

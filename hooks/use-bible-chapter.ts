"use client"

import { useEffect, useState } from "react"
import type { ChapterVerse } from "@/components/operator/chapter-reader"
import type { BibleBook } from "@/lib/bible-data"
import { BIBLE_API_BASE, getApiTranslationId, getBookId } from "@/lib/bible-data"
import { getCachedChapter, getVersionMeta, putCachedChapter } from "@/lib/bible-cache"
import { hydrateTranslation } from "@/lib/offline-download"

type UseBibleChapterOptions = {
  version: string
  selectedBook: BibleBook | null
  selectedChapter: number | null
}

// Shared empty array so the "no verses for this chapter yet" case keeps a
// stable reference across renders.
const EMPTY_VERSES: ChapterVerse[] = []

export function useBibleChapter({
  version,
  selectedBook,
  selectedChapter,
}: UseBibleChapterOptions) {
  // Hold the loaded verses together with the chapter they belong to. Verses
  // are only exposed when they match the current selection, so consumers never
  // see a previous chapter's text while a new chapter is still loading — that
  // staleness made projected slides show the right reference with the wrong
  // verse (e.g. "John 2:5" labeling Joshua 1:5's text).
  const [loaded, setLoaded] = useState<{
    book: string
    chapter: number
    verses: ChapterVerse[]
  } | null>(null)
  const [chapterLoading, setChapterLoading] = useState(false)
  const [chapterError, setChapterError] = useState<string | null>(null)

  const chapterVerses: ChapterVerse[] =
    loaded &&
    selectedBook &&
    loaded.book === selectedBook.name &&
    loaded.chapter === selectedChapter
      ? loaded.verses
      : EMPTY_VERSES

  useEffect(() => {
    if (!selectedBook || !selectedChapter) {
      setLoaded(null)
      return
    }
    const verseCount = selectedBook.chapters[selectedChapter - 1]
    if (!verseCount) return

    const controller = new AbortController()
    setChapterLoading(true)
    setChapterError(null)
    ;(async () => {
      try {
        const cached = await getCachedChapter(version, selectedBook.name, selectedChapter)
        if (controller.signal.aborted) return
        if (cached) {
          setLoaded({ book: selectedBook.name, chapter: selectedChapter, verses: cached })
          setChapterLoading(false)
          return
        }
        const bookId = getBookId(selectedBook.name)
        const translation = getApiTranslationId(version)
        const url =
          verseCount === 1
            ? `${BIBLE_API_BASE}/verses/${bookId}.${selectedChapter}.1?translation=${translation}`
            : `${BIBLE_API_BASE}/verses/${bookId}.${selectedChapter}.1-${verseCount}?translation=${translation}`
        const res = await fetch(url, { signal: controller.signal })
        const data = await res.json()
        const verses: ChapterVerse[] = Array.isArray(data.verses)
          ? data.verses.map((v: { number: number; text: string }) => ({
              number: v.number,
              text: String(v.text).trim(),
            }))
          : data.text
            ? [{ number: 1, text: String(data.text).trim() }]
            : []
        if (controller.signal.aborted) return
        if (verses.length === 0) {
          setChapterError("This chapter is not available in the selected translation.")
        } else {
          putCachedChapter(version, selectedBook.name, selectedChapter, verses)
        }
        setLoaded({ book: selectedBook.name, chapter: selectedChapter, verses })
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        setChapterError("Couldn't load this chapter. Please check your connection.")
        setLoaded({ book: selectedBook.name, chapter: selectedChapter, verses: [] })
      } finally {
        setChapterLoading(false)
      }
    })()

    return () => controller.abort()
  }, [selectedBook, selectedChapter, version])

  useEffect(() => {
    ;(async () => {
      try {
        if (await getVersionMeta("KJV")) return
        const res = await fetch("/bibles/kjv.json")
        if (!res.ok) return
        const data = await res.json()
        await hydrateTranslation("KJV", data.chapters)
      } catch {
        // asset may be absent in dev before the fetch script runs - ignore
      }
    })()
  }, [])

  return { chapterVerses, chapterLoading, chapterError }
}

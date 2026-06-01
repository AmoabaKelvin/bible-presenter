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

export function useBibleChapter({
  version,
  selectedBook,
  selectedChapter,
}: UseBibleChapterOptions) {
  const [chapterVerses, setChapterVerses] = useState<ChapterVerse[]>([])
  const [chapterLoading, setChapterLoading] = useState(false)
  const [chapterError, setChapterError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedBook || !selectedChapter) {
      setChapterVerses([])
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
        if (cached) {
          setChapterVerses(cached)
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
        if (verses.length === 0) {
          setChapterError("This chapter is not available in the selected translation.")
        } else {
          putCachedChapter(version, selectedBook.name, selectedChapter, verses)
        }
        setChapterVerses(verses)
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        setChapterError("Couldn't load this chapter. Please check your connection.")
        setChapterVerses([])
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

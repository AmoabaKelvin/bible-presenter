"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

type SelectionHighlight = { top: number; height: number } | null

type UseChapterReaderSelectionOptions = {
  bookName?: string
  chapter: number | null
  verses: readonly unknown[]
  selectedVerse: number | null
  rangeStart: number | null
  rangeEnd: number | null
}

export function useChapterReaderSelection({
  bookName,
  chapter,
  verses,
  selectedVerse,
  rangeStart,
  rangeEnd,
}: UseChapterReaderSelectionOptions) {
  const verseCount = verses.length
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const skipNextScrollRef = useRef(false)
  const [highlight, setHighlight] = useState<SelectionHighlight>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const viewport = el.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null
    if (viewport) viewport.scrollTop = 0
  }, [bookName, chapter])

  useEffect(() => {
    const skip = skipNextScrollRef.current
    skipNextScrollRef.current = false
    if (skip) return
    const list = listRef.current
    if (!list) return
    const target = selectedVerse ?? rangeStart
    if (target == null) return
    const item = list.querySelector<HTMLLIElement>(`[data-verse-number="${target}"]`)
    if (!item) return
    item.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [selectedVerse, rangeStart, verseCount])

  const measureHighlight = useCallback(() => {
    const list = listRef.current
    if (!list || verses.length === 0) return setHighlight(null)
    const start = rangeStart ?? selectedVerse
    const end = rangeEnd ?? start
    if (start == null || end == null) return setHighlight(null)
    const startItem = list.querySelector<HTMLLIElement>(`[data-verse-number="${start}"]`)
    const endItem = list.querySelector<HTMLLIElement>(`[data-verse-number="${end}"]`)
    if (!startItem || !endItem) return setHighlight(null)
    const top = startItem.offsetTop
    setHighlight({ top, height: endItem.offsetTop + endItem.offsetHeight - top })
  }, [selectedVerse, rangeStart, rangeEnd, verses])

  useLayoutEffect(() => {
    measureHighlight()
  }, [measureHighlight])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(() => measureHighlight())
    observer.observe(list)
    window.addEventListener("resize", measureHighlight)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measureHighlight)
    }
  }, [measureHighlight])

  return {
    scrollRef,
    listRef,
    highlight,
    suppressNextAutoScroll: () => {
      skipNextScrollRef.current = true
    },
    allowNextAutoScroll: () => {
      skipNextScrollRef.current = false
    },
  }
}

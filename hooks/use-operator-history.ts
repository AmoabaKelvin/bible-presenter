"use client"

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"
import type { SelectedVerse, SlideKind } from "@/components/slide-stage"
import type { HistoryItem } from "@/components/operator/types"

const HISTORY_KEY = "biblePresenterHistory"

type MediaSlide = { id: string; url: string } | null

type UseOperatorHistoryOptions = {
  version: string
  setPreviewVerses: Dispatch<SetStateAction<SelectedVerse[]>>
  setLiveVerses: Dispatch<SetStateAction<SelectedVerse[]>>
  setPreviewMedia: Dispatch<SetStateAction<MediaSlide>>
  setLiveMedia: Dispatch<SetStateAction<MediaSlide>>
  writeToOutput: (payload: { verses?: SelectedVerse[]; mediaId?: string | null }) => void
}

export function useOperatorHistory({
  version,
  setPreviewVerses,
  setLiveVerses,
  setPreviewMedia,
  setLiveMedia,
  writeToOutput,
}: UseOperatorHistoryOptions) {
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) setHistory(JSON.parse(stored))
    } catch {
      // ignore corrupt local state
    }
  }, [])

  const addToHistory = useCallback(
    (
      text: string,
      reference: string,
      itemVersion?: string,
      kind: SlideKind = "scripture",
    ) => {
      const newItem: HistoryItem = {
        id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind,
        reference,
        text,
        timestamp: Date.now(),
        version: itemVersion,
      }
      setHistory((prev) => {
        const next = [
          newItem,
          ...prev.filter(
            (h) =>
              !(
                h.text === text &&
                h.reference === reference &&
                h.version === itemVersion &&
                (h.kind ?? "scripture") === kind
              ),
          ),
        ].slice(0, 30)
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
        return next
      })
    },
    [],
  )

  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }, [])

  const projectFromHistory = useCallback(
    (item: HistoryItem) => {
      const slide: SelectedVerse = {
        kind: item.kind ?? "scripture",
        id: `history-${Date.now()}`,
        book: "",
        chapter: 0,
        verse: 0,
        text: item.text,
        reference: item.reference,
        version: item.version || version,
      }
      setPreviewMedia(null)
      setLiveMedia(null)
      setPreviewVerses([slide])
      setLiveVerses([slide])
      writeToOutput({ verses: [slide] })
    },
    [setLiveMedia, setLiveVerses, setPreviewMedia, setPreviewVerses, version, writeToOutput],
  )

  return { history, addToHistory, clearHistory, projectFromHistory }
}

"use client"

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"
import type { SelectedVerse } from "@/components/slide-stage"
import { readLegacyJson, readLegacyString, readPersisted, writePersisted } from "@/lib/persistence"

const QUEUE_KEY = "biblePresenterQueue"
const QUEUE_CURSOR_KEY = "biblePresenterQueueCursor"

type MediaSlide = { id: string; url: string } | null

type UseOperatorQueueOptions = {
  previewVerses: SelectedVerse[]
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
}

export function useOperatorQueue({
  previewVerses,
  setPreviewVerses,
  setLiveVerses,
  setPreviewMedia,
  setLiveMedia,
  writeToOutput,
  addToHistory,
}: UseOperatorQueueOptions) {
  const [loaded, setLoaded] = useState(false)
  const [queue, setQueue] = useState<SelectedVerse[]>([])
  const [queueCursor, setQueueCursor] = useState(-1)

  useEffect(() => {
    try {
      const q = readPersisted<SelectedVerse[]>("queue", {
        legacy: { keys: [QUEUE_KEY], read: () => readLegacyJson<SelectedVerse[]>(QUEUE_KEY) },
      })
      if (q) setQueue(q)

      const qc = readPersisted<number>("queueCursor", {
        legacy: {
          keys: [QUEUE_CURSOR_KEY],
          read: () => {
            const raw = readLegacyString(QUEUE_CURSOR_KEY)
            if (raw === null) return null
            const parsed = parseInt(raw, 10)
            return Number.isFinite(parsed) ? parsed : null
          },
        },
      })
      if (qc !== null) setQueueCursor(qc)
    } catch {
      // ignore corrupt local state
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) writePersisted("queue", queue)
  }, [queue, loaded])

  useEffect(() => {
    if (loaded) writePersisted("queueCursor", queueCursor)
  }, [queueCursor, loaded])

  const addToQueue = useCallback((verses: SelectedVerse[]) => {
    if (verses.length === 0) return
    const stamped = verses.map((v) => ({
      ...v,
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }))
    setQueue((q) => [...q, ...stamped])
  }, [])

  const queuePreviewItem = useCallback(() => {
    addToQueue(previewVerses)
  }, [addToQueue, previewVerses])

  const queueRemove = useCallback((id: string) => {
    setQueue((prev) => {
      const idx = prev.findIndex((v) => v.id === id)
      if (idx === -1) return prev
      const next = prev.filter((v) => v.id !== id)
      setQueueCursor((c) => {
        if (next.length === 0) return -1
        if (c === idx) return Math.min(c, next.length - 1)
        if (c > idx) return c - 1
        return c
      })
      return next
    })
  }, [])

  const queueReorder = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return
    setQueue((prev) => {
      if (fromIdx >= prev.length || toIdx >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      setQueueCursor((c) => {
        if (c === fromIdx) return toIdx
        if (c > fromIdx && c <= toIdx) return c - 1
        if (c < fromIdx && c >= toIdx) return c + 1
        return c
      })
      return next
    })
  }, [])

  const queueGoto = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= queue.length) return
      const item = queue[idx]
      setQueueCursor(idx)
      setPreviewMedia(null)
      setLiveMedia(null)
      setPreviewVerses([item])
      setLiveVerses([item])
      writeToOutput({ verses: [item] })
      addToHistory(item.text, item.reference, item.version, item.kind)
    },
    [addToHistory, queue, setLiveMedia, setLiveVerses, setPreviewMedia, setPreviewVerses, writeToOutput],
  )

  const queuePreviewAt = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= queue.length) return
      setPreviewMedia(null)
      setPreviewVerses([queue[idx]])
    },
    [queue, setPreviewMedia, setPreviewVerses],
  )

  const queuePrev = useCallback(() => {
    if (queue.length === 0) return
    const next = queueCursor <= 0 ? 0 : queueCursor - 1
    queueGoto(next)
  }, [queue.length, queueCursor, queueGoto])

  const queueNext = useCallback(() => {
    if (queue.length === 0) return
    const next = queueCursor < 0 ? 0 : Math.min(queueCursor + 1, queue.length - 1)
    queueGoto(next)
  }, [queue.length, queueCursor, queueGoto])

  const clearQueue = useCallback(() => {
    setQueue([])
    setQueueCursor(-1)
  }, [])

  // Replace the whole queue and cursor at once (used to restore a saved show).
  // The persist effects above save the new values.
  const restoreQueue = useCallback((items: SelectedVerse[], cursor: number) => {
    setQueue(items)
    const max = items.length - 1
    setQueueCursor(items.length === 0 ? -1 : Math.min(Math.max(cursor, -1), max))
  }, [])

  return {
    queue,
    queueCursor,
    addToQueue,
    queuePreviewItem,
    queueRemove,
    queueReorder,
    queueGoto,
    queuePreviewAt,
    queuePrev,
    queueNext,
    clearQueue,
    restoreQueue,
  }
}

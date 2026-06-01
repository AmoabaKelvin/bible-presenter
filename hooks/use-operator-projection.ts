"use client"

import {
  useCallback,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react"
import type { FontSize, SelectedVerse, SlideKind } from "@/components/slide-stage"
import type { HistoryItem } from "@/components/operator/types"
import { useOperatorHistory } from "@/hooks/use-operator-history"
import { useOperatorQueue } from "@/hooks/use-operator-queue"
import { usePreviewHighlights } from "@/hooks/use-preview-highlights"
import { useSlideshowOutput, type OutputPayload } from "@/hooks/use-slideshow-output"

type MediaSlide = { id: string; url: string } | null

type UseOperatorProjectionOptions = {
  fontSize: FontSize
  version: string
  previewContentRef: RefObject<HTMLDivElement | null>
}

type UseOperatorProjectionResult = {
  previewVerses: SelectedVerse[]
  setPreviewVerses: Dispatch<SetStateAction<SelectedVerse[]>>
  liveVerses: SelectedVerse[]
  setLiveVerses: Dispatch<SetStateAction<SelectedVerse[]>>
  previewMedia: MediaSlide
  setPreviewMedia: Dispatch<SetStateAction<MediaSlide>>
  liveMedia: MediaSlide
  setLiveMedia: Dispatch<SetStateAction<MediaSlide>>
  queue: SelectedVerse[]
  queueCursor: number
  history: HistoryItem[]
  writeToOutput: (payload: OutputPayload) => void
  openOutputWindow: () => void
  addToHistory: (
    text: string,
    reference: string,
    itemVersion?: string,
    kind?: SlideKind,
  ) => void
  clearHistory: () => void
  projectFromHistory: (item: HistoryItem) => void
  goLive: () => void
  clearLive: () => void
  addToQueue: (verses: SelectedVerse[]) => void
  queuePreviewItem: () => void
  queueRemove: (id: string) => void
  queueReorder: (fromIdx: number, toIdx: number) => void
  queueGoto: (idx: number) => void
  queuePreviewAt: (idx: number) => void
  queuePrev: () => void
  queueNext: () => void
  clearQueue: () => void
  applyHighlight: (color: string) => void
  clearHighlights: () => void
}

export function useOperatorProjection({
  fontSize,
  version,
  previewContentRef,
}: UseOperatorProjectionOptions): UseOperatorProjectionResult {
  const [previewVerses, setPreviewVerses] = useState<SelectedVerse[]>([])
  const [liveVerses, setLiveVerses] = useState<SelectedVerse[]>([])
  const [previewMedia, setPreviewMedia] = useState<MediaSlide>(null)
  const [liveMedia, setLiveMedia] = useState<MediaSlide>(null)
  const { applyHighlight, clearHighlights } = usePreviewHighlights({
    previewContentRef,
    setPreviewVerses,
  })
  const { writeToOutput, openOutputWindow } = useSlideshowOutput({
    fontSize,
    version,
    liveVerses,
    liveMedia,
  })
  const { history, addToHistory, clearHistory, projectFromHistory } = useOperatorHistory({
    version,
    setPreviewVerses,
    setLiveVerses,
    setPreviewMedia,
    setLiveMedia,
    writeToOutput,
  })

  const goLive = useCallback(() => {
    if (previewMedia) {
      setLiveVerses([])
      setLiveMedia(previewMedia)
      writeToOutput({ mediaId: previewMedia.id })
      return
    }
    if (previewVerses.length === 0) return
    setLiveMedia(null)
    setLiveVerses(previewVerses)
    writeToOutput({ verses: previewVerses })
    previewVerses.forEach((v) => addToHistory(v.text, v.reference, v.version, v.kind))
  }, [addToHistory, previewMedia, previewVerses, writeToOutput])

  const clearLive = useCallback(() => {
    setLiveVerses([])
    setLiveMedia(null)
    writeToOutput({})
  }, [writeToOutput])

  const {
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
  } = useOperatorQueue({
    previewVerses,
    setPreviewVerses,
    setLiveVerses,
    setPreviewMedia,
    setLiveMedia,
    writeToOutput,
    addToHistory,
  })

  return {
    previewVerses,
    setPreviewVerses,
    liveVerses,
    setLiveVerses,
    previewMedia,
    setPreviewMedia,
    liveMedia,
    setLiveMedia,
    queue,
    queueCursor,
    history,
    writeToOutput,
    openOutputWindow,
    addToHistory,
    clearHistory,
    projectFromHistory,
    goLive,
    clearLive,
    addToQueue,
    queuePreviewItem,
    queueRemove,
    queueReorder,
    queueGoto,
    queuePreviewAt,
    queuePrev,
    queueNext,
    clearQueue,
    applyHighlight,
    clearHighlights,
  }
}

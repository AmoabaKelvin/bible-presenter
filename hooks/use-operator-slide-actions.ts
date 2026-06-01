"use client"

import { useCallback, useState, type Dispatch, type SetStateAction } from "react"
import type { SelectedVerse } from "@/components/slide-stage"
import type { Mode } from "@/components/operator/types"

type MediaSlide = { id: string; url: string } | null

type UseOperatorSlideActionsOptions = {
  composeNoteVerse: () => SelectedVerse | null
  setMode: Dispatch<SetStateAction<Mode>>
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

export function useOperatorSlideActions({
  composeNoteVerse,
  setMode,
  setPreviewVerses,
  setLiveVerses,
  setPreviewMedia,
  setLiveMedia,
  writeToOutput,
  addToHistory,
  addToQueue,
}: UseOperatorSlideActionsOptions) {
  const [dictionaryQuery, setDictionaryQuery] = useState("")
  const [dictionaryQueryNonce, setDictionaryQueryNonce] = useState(0)

  const previewSlide = useCallback(
    (slide: SelectedVerse) => {
      setPreviewMedia(null)
      setPreviewVerses([slide])
    },
    [setPreviewMedia, setPreviewVerses],
  )

  const projectSlide = useCallback(
    (slide: SelectedVerse) => {
      setPreviewMedia(null)
      setLiveMedia(null)
      setPreviewVerses([slide])
      setLiveVerses([slide])
      writeToOutput({ verses: [slide] })
      addToHistory(slide.text, slide.reference, slide.version, slide.kind)
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

  const queueSlide = useCallback(
    (slide: SelectedVerse) => {
      addToQueue([slide])
    },
    [addToQueue],
  )

  const previewNote = useCallback(() => {
    const slide = composeNoteVerse()
    if (slide) previewSlide(slide)
  }, [composeNoteVerse, previewSlide])

  const projectNote = useCallback(() => {
    const slide = composeNoteVerse()
    if (slide) projectSlide(slide)
  }, [composeNoteVerse, projectSlide])

  const queueNote = useCallback(() => {
    const slide = composeNoteVerse()
    if (slide) queueSlide(slide)
  }, [composeNoteVerse, queueSlide])

  const defineWord = useCallback(
    (word: string) => {
      const trimmed = word.trim()
      if (!trimmed) return
      setDictionaryQuery(trimmed)
      setDictionaryQueryNonce((n) => n + 1)
      setMode("dictionary")
    },
    [setMode],
  )

  const defineSelection = useCallback(() => {
    const text = window.getSelection()?.toString().trim()
    if (text) defineWord(text)
  }, [defineWord])

  return {
    dictionaryQuery,
    dictionaryQueryNonce,
    previewNote,
    projectNote,
    queueNote,
    defineSelection,
    previewDefinition: previewSlide,
    projectDefinition: projectSlide,
    queueDefinition: queueSlide,
  }
}

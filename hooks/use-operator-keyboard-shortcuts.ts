"use client"

import { useEffect } from "react"
import type { Mode } from "@/components/operator/types"

type UseOperatorKeyboardShortcutsOptions = {
  mode: Mode
  selectedVerse: number | null
  selectedBookSelected: boolean
  selectedChapterSelected: boolean
  queueLength: number
  goLive: () => void
  clearLive: () => void
  queuePrev: () => void
  queueNext: () => void
  stepSelectedVerse: (delta: number) => void
  goToPreviousChapter: () => void
  goToNextChapter: () => void
}

export function useOperatorKeyboardShortcuts({
  mode,
  selectedVerse,
  selectedBookSelected,
  selectedChapterSelected,
  queueLength,
  goLive,
  clearLive,
  queuePrev,
  queueNext,
  stepSelectedVerse,
  goToPreviousChapter,
  goToNextChapter,
}: UseOperatorKeyboardShortcutsOptions) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const editable =
        target && (/^(INPUT|TEXTAREA)$/.test(target.tagName) || target.isContentEditable)
      if (editable) return
      if (e.code === "Space") {
        e.preventDefault()
        goLive()
      } else if (e.key === "Escape") {
        e.preventDefault()
        clearLive()
      } else if (e.key === "ArrowRight") {
        if (queueLength === 0) return
        e.preventDefault()
        queueNext()
      } else if (e.key === "ArrowLeft") {
        if (queueLength === 0) return
        e.preventDefault()
        queuePrev()
      } else if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        mode === "bible" &&
        selectedVerse !== null
      ) {
        e.preventDefault()
        stepSelectedVerse(e.key === "ArrowDown" ? 1 : -1)
      } else if (e.key === "]" && selectedBookSelected && selectedChapterSelected) {
        e.preventDefault()
        goToNextChapter()
      } else if (e.key === "[" && selectedBookSelected && selectedChapterSelected) {
        e.preventDefault()
        goToPreviousChapter()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    clearLive,
    goLive,
    goToNextChapter,
    goToPreviousChapter,
    mode,
    queueLength,
    queueNext,
    queuePrev,
    selectedBookSelected,
    selectedChapterSelected,
    selectedVerse,
    stepSelectedVerse,
  ])
}

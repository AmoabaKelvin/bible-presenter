"use client"

import { useCallback, type Dispatch, type RefObject, type SetStateAction } from "react"
import type { SelectedVerse } from "@/components/slide-stage"

type UsePreviewHighlightsOptions = {
  previewContentRef: RefObject<HTMLDivElement | null>
  setPreviewVerses: Dispatch<SetStateAction<SelectedVerse[]>>
}

export function usePreviewHighlights({
  previewContentRef,
  setPreviewVerses,
}: UsePreviewHighlightsOptions) {
  const applyHighlight = useCallback(
    (color: string) => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
      const range = selection.getRangeAt(0)
      const container = previewContentRef.current
      if (!container || !container.contains(range.commonAncestorContainer)) return
      let verseNode: HTMLElement | null = null
      let node: Node | null = range.commonAncestorContainer
      while (node && node !== container) {
        if (node instanceof HTMLElement && node.dataset.verseId) {
          verseNode = node
          break
        }
        node = node.parentNode
      }
      if (!verseNode) return
      const textEl = verseNode.querySelector<HTMLElement>("[data-verse-text]")
      if (!textEl || !textEl.contains(range.commonAncestorContainer)) return
      const mark = document.createElement("mark")
      mark.style.backgroundColor = color
      mark.style.color = "inherit"
      mark.style.padding = "0 2px"
      mark.style.borderRadius = "2px"
      try {
        range.surroundContents(mark)
      } catch {
        const frag = range.extractContents()
        mark.appendChild(frag)
        range.insertNode(mark)
      }
      const id = verseNode.dataset.verseId
      const html = textEl.innerHTML
      setPreviewVerses((prev) => prev.map((v) => (v.id === id ? { ...v, text: html } : v)))
      selection.removeAllRanges()
    },
    [previewContentRef, setPreviewVerses],
  )

  const clearHighlights = useCallback(() => {
    const stripMarks = (html: string) =>
      html.replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, "$1")
    setPreviewVerses((prev) => prev.map((v) => ({ ...v, text: stripMarks(v.text) })))
  }, [setPreviewVerses])

  return { applyHighlight, clearHighlights }
}

import { useLayoutEffect, useRef, useState, type Ref } from "react"
import type { FontSize, SelectedVerse } from "@/components/slide-stage"

const FILL: Record<FontSize, number> = {
  small: 0.5,
  medium: 0.66,
  large: 0.82,
  "extra-large": 0.95,
}

const REF_FS = 100
const REFERENCE_RATIO = 0.46
const NOTE_TITLE_RATIO = 0.8
const REFERENCE_MARGIN_RATIO = 0.34
const NOTE_TITLE_MARGIN_RATIO = 0.3
const GAP_RATIO = 0.34

interface UseSlideTextFitOptions {
  verses: SelectedVerse[]
  fontSize: FontSize
  availableHeight: number
  innerRef?: Ref<HTMLDivElement>
}

export function useSlideTextFit({
  verses,
  fontSize,
  availableHeight,
  innerRef,
}: UseSlideTextFitOptions) {
  const measureRef = useRef<HTMLDivElement | null>(null)
  const [fillFs, setFillFs] = useState<number | null>(null)
  const [candidate, setCandidate] = useState(REF_FS)
  const iterRef = useRef(0)

  useLayoutEffect(() => {
    setFillFs(null)
    setCandidate(REF_FS)
    iterRef.current = 0
  }, [verses])

  useLayoutEffect(() => {
    if (fillFs !== null) return
    const el = measureRef.current
    if (!el) return
    const h = el.scrollHeight
    if (!h) return

    const ratio = availableHeight / h
    const next = candidate * Math.sqrt(ratio)
    iterRef.current += 1

    if (Math.abs(ratio - 1) < 0.02 || iterRef.current >= 8) {
      setFillFs(Math.min(candidate, next))
    } else {
      setCandidate(next)
    }
  }, [availableHeight, verses, fillFs, candidate])

  const setRefs = (node: HTMLDivElement | null) => {
    measureRef.current = node
    if (!innerRef) return
    if (typeof innerRef === "function") {
      innerRef(node)
    } else {
      ;(innerRef as { current: HTMLDivElement | null }).current = node
    }
  }

  const measuring = fillFs === null
  const verseFs = measuring ? candidate : fillFs * FILL[fontSize]

  return {
    measuring,
    setRefs,
    verseFs,
    refFs: verseFs * REFERENCE_RATIO,
    noteTitleFs: verseFs * NOTE_TITLE_RATIO,
    refMt: verseFs * REFERENCE_MARGIN_RATIO,
    noteTitleMb: verseFs * NOTE_TITLE_MARGIN_RATIO,
    gap: verseFs * GAP_RATIO,
  }
}
